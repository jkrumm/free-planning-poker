import { eq, sql } from 'drizzle-orm'
import type { Executor } from './client.ts'
import { SNAPSHOT_TTL_MS } from './holds.ts'
import { room } from './schema.ts'
import { at, rowsOf } from './sql.ts'
import { loadOpenTopics } from './topics.ts'

export type RoomRow = typeof room.$inferSelect
export type RoomInput = Partial<
  Pick<
    typeof room.$inferInsert,
    'name' | 'settings' | 'access' | 'accessCode' | 'origin' | 'createdAt'
  >
>

export async function createRoom(db: Executor, input: RoomInput = {}): Promise<number> {
  const [row] = await db.insert(room).values(input).returning({ id: room.id })
  if (!row) throw new Error('room insert returned no row')
  return row.id
}

/** A room as a cold start sees it: the row and its open topics (queued or active), without a live snapshot. */
export async function loadRoom(db: Executor, roomId: number) {
  const [row] = await db.select().from(room).where(eq(room.id, roomId))
  if (!row) return null
  return { room: row, openTopics: await loadOpenTopics(db, { roomId }) }
}

export type RoomClaim = {
  readonly epoch: number
  readonly seq: number
  /** The live state to restore; null for a room with no snapshot or an expired one. */
  readonly state: unknown
}

const expiry = (now: Date) => at(new Date(now.getTime() + SNAPSHOT_TTL_MS))

/**
 * Takes ownership of a room: the epoch goes up by one and `owner` is set, in one statement, so two claims never
 * share an epoch (invariant 12). An expired snapshot is not restored, but its epoch is kept: fencing never resets.
 */
export async function claimRoom(
  db: Executor,
  args: { readonly roomId: number; readonly owner: string; readonly now: Date },
): Promise<RoomClaim> {
  const rows = rowsOf<{ epoch: string | number; seq: string | number; state: string | null }>(
    await db.execute(sql`
      INSERT INTO fpp.room_snapshot (room_id, state, seq, epoch, owner, updated_at, expires_at)
      VALUES (${args.roomId}, NULL, 0, 1, ${args.owner}, ${at(args.now)}, ${expiry(args.now)})
      ON CONFLICT (room_id) DO UPDATE
        SET epoch = fpp.room_snapshot.epoch + 1,
            owner = EXCLUDED.owner,
            state = CASE WHEN fpp.room_snapshot.expires_at < ${at(args.now)} THEN NULL ELSE fpp.room_snapshot.state END,
            seq = CASE WHEN fpp.room_snapshot.expires_at < ${at(args.now)} THEN 0 ELSE fpp.room_snapshot.seq END,
            updated_at = EXCLUDED.updated_at,
            expires_at = EXCLUDED.expires_at
      RETURNING epoch, seq, state::text AS state`),
  )
  const row = rows[0]
  if (!row) throw new Error('room claim returned no row')
  // The driver hands raw jsonb back as text; parsing it here keeps the type of the state in one place.
  return {
    epoch: Number(row.epoch),
    seq: Number(row.seq),
    state: row.state === null ? null : (JSON.parse(row.state) as unknown),
  }
}

export type Ownership = 'owned' | 'lost'

/**
 * Writes the live snapshot only where this process still owns the room: the epoch and the owner match. `lost` means
 * another process has claimed it and nothing was written; the caller closes the room's sockets with 4002.
 */
export async function writeSnapshot(
  db: Executor,
  args: {
    readonly roomId: number
    readonly epoch: number
    readonly owner: string
    readonly state: unknown
    readonly seq: number
    readonly now: Date
  },
): Promise<Ownership> {
  const rows = rowsOf<{ room_id: unknown }>(
    await db.execute(sql`
      UPDATE fpp.room_snapshot
      SET state = ${args.state}::jsonb, seq = ${args.seq},
          updated_at = ${at(args.now)}, expires_at = ${expiry(args.now)}
      WHERE room_id = ${args.roomId} AND epoch = ${args.epoch} AND owner = ${args.owner}
      RETURNING room_id`),
  )
  return rows.length > 0 ? 'owned' : 'lost'
}

/** Gives the room up (on drain): the snapshot stays for the next claim, the owner is cleared. */
export async function releaseRoom(
  db: Executor,
  args: { readonly roomId: number; readonly epoch: number; readonly owner: string },
): Promise<Ownership> {
  const rows = rowsOf<{ room_id: unknown }>(
    await db.execute(sql`
      UPDATE fpp.room_snapshot SET owner = NULL
      WHERE room_id = ${args.roomId} AND epoch = ${args.epoch} AND owner = ${args.owner}
      RETURNING room_id`),
  )
  return rows.length > 0 ? 'owned' : 'lost'
}

/** Deletes the snapshots whose lifetime has passed, and nothing else; returns how many. */
export async function sweepSnapshots(db: Executor, args: { readonly now: Date }): Promise<number> {
  const rows = rowsOf<{ room_id: unknown }>(
    await db.execute(sql`
      DELETE FROM fpp.room_snapshot WHERE expires_at < ${at(args.now)} RETURNING room_id`),
  )
  return rows.length
}
