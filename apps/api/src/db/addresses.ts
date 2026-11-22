import { sql } from 'drizzle-orm'
import type { Executor } from './client.ts'
import { HOLD_RENEWAL_STEP, NAME_HOLD, NUMBER_HOLD, REPLACED_ADDRESS_GRACE } from './holds.ts'
import { at, interval, rowsOf } from './sql.ts'

export type AddressKind = 'number' | 'name'

const holdOf = (kind: AddressKind) => interval(kind === 'number' ? NUMBER_HOLD : NAME_HOLD)

/**
 * Which of the drawn candidates can be taken right now: one never used first, else the one released longest ago.
 * One query, one round trip (Room model, "A room is reached by a number").
 */
export async function findClaimable(
  db: Executor,
  args: { readonly candidates: readonly string[]; readonly now: Date },
): Promise<string | null> {
  if (args.candidates.length === 0) return null
  const list = sql.join(
    args.candidates.map((slug) => sql`${slug}`),
    sql`, `,
  )
  const rows = rowsOf<{ slug: string }>(
    await db.execute(sql`
      SELECT c.slug
      FROM unnest(ARRAY[${list}]::text[]) AS c(slug)
      LEFT JOIN fpp.room_slug s ON s.slug = c.slug
      WHERE s.slug IS NULL OR s.release_at < ${at(args.now)}
      ORDER BY s.release_at NULLS FIRST, c.slug
      LIMIT 1`),
  )
  return rows[0]?.slug ?? null
}

/**
 * Takes an address as the room's primary one, for a room that has none yet. A free address is inserted, a released
 * one changes hands (the room that held it keeps its rows), a held one returns null. One statement, so two rooms
 * never get the same address. A room that already holds the address may claim it again, which renews the hold.
 * To change a room that has a primary address, use `bookName`.
 */
export async function claimAddress(
  db: Executor,
  args: {
    readonly roomId: number
    readonly slug: string
    readonly kind: AddressKind
    readonly now: Date
  },
): Promise<string | null> {
  const rows = rowsOf<{ slug: string }>(
    await db.execute(sql`
      INSERT INTO fpp.room_slug (slug, room_id, kind, is_primary, release_at)
      VALUES (${args.slug}, ${args.roomId}, ${args.kind}, true, ${at(args.now)} + ${holdOf(args.kind)})
      ON CONFLICT (slug) DO UPDATE
        SET room_id = EXCLUDED.room_id, kind = EXCLUDED.kind,
            is_primary = true, release_at = EXCLUDED.release_at
        WHERE fpp.room_slug.release_at < ${at(args.now)} OR fpp.room_slug.room_id = EXCLUDED.room_id
      RETURNING slug`),
  )
  return rows[0]?.slug ?? null
}

/**
 * Books a name for the room or changes it: the name becomes the primary address and the one it replaces stays valid
 * for 30 days. Returns null, and changes nothing, when another room holds the name.
 */
export async function bookName(
  db: Executor,
  args: { readonly roomId: number; readonly name: string; readonly now: Date },
): Promise<string | null> {
  return db.transaction(async (tx) => {
    // One rename of a room at a time: the demote and the promote below are two statements.
    const locked = rowsOf<{ id: unknown }>(
      await tx.execute(sql`SELECT id FROM fpp.room WHERE id = ${args.roomId} FOR UPDATE`),
    )
    if (locked.length === 0) throw new Error(`room ${args.roomId} does not exist`)

    const taken = rowsOf<{ slug: string }>(
      await tx.execute(sql`
        INSERT INTO fpp.room_slug (slug, room_id, kind, is_primary, release_at)
        VALUES (${args.name}, ${args.roomId}, 'name', false, ${at(args.now)} + ${holdOf('name')})
        ON CONFLICT (slug) DO UPDATE
          SET room_id = EXCLUDED.room_id, kind = 'name', is_primary = false, release_at = EXCLUDED.release_at
          WHERE fpp.room_slug.release_at < ${at(args.now)} OR fpp.room_slug.room_id = EXCLUDED.room_id
        RETURNING slug`),
    )
    if (taken.length === 0) return null

    await tx.execute(sql`
      UPDATE fpp.room_slug
      SET is_primary = false,
          release_at = LEAST(release_at, ${at(args.now)} + ${interval(REPLACED_ADDRESS_GRACE)})
      WHERE room_id = ${args.roomId} AND is_primary AND slug <> ${args.name}`)
    await tx.execute(sql`UPDATE fpp.room_slug SET is_primary = true WHERE slug = ${args.name}`)
    return args.name
  })
}

export type ResolvedAddress = {
  readonly roomId: number
  readonly kind: AddressKind
  /** The address the room shows; any other address of the room redirects to it. */
  readonly primarySlug: string | null
  /** Its release date has passed: it still leads to the room until another room is given it. */
  readonly released: boolean
  /** A device that remembers the room compares this, to notice an address that now leads to a stranger's table. */
  readonly roomCreatedAt: Date
}

/** Which room an address leads to, and the room's primary address; null for an address nobody ever held. */
export async function resolveAddress(
  db: Executor,
  args: { readonly slug: string; readonly now: Date },
): Promise<ResolvedAddress | null> {
  const rows = rowsOf<{
    room_id: string | number
    kind: AddressKind
    released: boolean
    primary_slug: string | null
    created_at: Date
  }>(
    await db.execute(sql`
      SELECT s.room_id, s.kind, s.release_at < ${at(args.now)} AS released,
             p.slug AS primary_slug, r.created_at
      FROM fpp.room_slug s
      JOIN fpp.room r ON r.id = s.room_id
      LEFT JOIN fpp.room_slug p ON p.room_id = s.room_id AND p.is_primary
      WHERE s.slug = ${args.slug}`),
  )
  const row = rows[0]
  if (!row) return null
  return {
    roomId: Number(row.room_id),
    kind: row.kind,
    primarySlug: row.primary_slug,
    released: row.released,
    roomCreatedAt: new Date(row.created_at),
  }
}

/**
 * A visit holds the room's primary address again: its release date moves forward, at most once a day. Returns
 * whether it wrote. The room id is part of the match, so a visit through an address another room has since taken
 * extends nothing.
 */
export async function touchAddress(
  db: Executor,
  args: { readonly roomId: number; readonly slug: string; readonly now: Date },
): Promise<boolean> {
  const renewed = sql`${at(args.now)} + CASE kind WHEN 'number' THEN ${interval(NUMBER_HOLD)} ELSE ${interval(NAME_HOLD)} END`
  const rows = rowsOf<{ slug: string }>(
    await db.execute(sql`
      UPDATE fpp.room_slug
      SET release_at = ${renewed}
      WHERE slug = ${args.slug} AND room_id = ${args.roomId} AND is_primary
        AND release_at < ${renewed} - ${interval(HOLD_RENEWAL_STEP)}
      RETURNING slug`),
  )
  return rows.length > 0
}
