/**
 * The importer's reads and writes on Postgres: plain functions on an `Executor`, as the repositories of `src/db` are.
 * Every write is keyed so that a second run finds its rows and adds none: rooms by v1's id, addresses by the address,
 * topics and rounds by their stable ids, `visitor_day` by its key, and `stat_daily` rows by theirs, rewritten only
 * where the value differs.
 */
import { sql, type SQL } from 'drizzle-orm'
import type { Executor } from '../../db/client.ts'
import { NAME_HOLD, NUMBER_HOLD, VISITOR_DAY_RETENTION } from '../../db/holds.ts'
import { room, statDaily, topic } from '../../db/schema.ts'
import { at, interval, rowsOf } from '../../db/sql.ts'
import { recordEstimatingDays } from '../../db/visitors.ts'
import {
  V1_DECK,
  type PlannedRoom,
  type PlannedRound,
  type PlannedSlug,
  type PlannedStat,
} from './plan.ts'

/** The tables the import writes, and the one it must leave alone (`round_vote`: v1 kept no vote per seat). */
export const TARGET_TABLES = [
  'room',
  'room_slug',
  'topic',
  'round',
  'round_vote',
  'visitor_day',
  'stat_daily',
] as const
export type TargetTable = (typeof TARGET_TABLES)[number]

const list = (values: readonly (string | number)[]): SQL =>
  sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )

/** Rows per table now. */
export async function countRows(db: Executor): Promise<Record<TargetTable, number>> {
  const counts = {} as Record<TargetTable, number>
  for (const table of TARGET_TABLES) {
    const [row] = rowsOf<{ n: string | number }>(
      await db.execute(sql`SELECT count(*) AS n FROM ${sql.raw(`fpp.${table}`)}`),
    )
    counts[table] = Number(row?.n ?? 0)
  }
  return counts
}

/** Rooms of another origin than v1: a target that holds any is refused unless the caller says otherwise. */
export async function otherOriginRooms(db: Executor): Promise<number> {
  const [row] = rowsOf<{ n: string | number }>(
    await db.execute(sql`SELECT count(*) AS n FROM fpp.room WHERE origin <> 'v1'`),
  )
  return Number(row?.n ?? 0)
}

/** The first day `visitor_day` keeps at `now`: the sweep deletes the days before it (`deleteEstimatingDaysBefore`). */
export async function retainedFrom(db: Executor, now: Date): Promise<string> {
  const [row] = rowsOf<{ day: string }>(
    await db.execute(
      sql`SELECT ((${at(now)} AT TIME ZONE 'UTC')::date - ${interval(VISITOR_DAY_RETENTION)})::date::text AS day`,
    ),
  )
  if (row === undefined) throw new Error('no retention day')
  return row.day
}

/** Of these ids, the rooms that exist with another origin than v1. */
export async function foreignRoomIds(db: Executor, ids: readonly number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set()
  const rows = rowsOf<{ id: string | number }>(
    await db.execute(sql`SELECT id FROM fpp.room WHERE origin <> 'v1' AND id IN (${list(ids)})`),
  )
  return new Set(rows.map((row) => Number(row.id)))
}

/** Of these addresses, the ones a room holds, with that room. */
export async function heldAddresses(
  db: Executor,
  slugs: readonly string[],
): Promise<Map<string, number>> {
  if (slugs.length === 0) return new Map()
  const rows = rowsOf<{ slug: string; room_id: string | number }>(
    await db.execute(sql`SELECT slug, room_id FROM fpp.room_slug WHERE slug IN (${list(slugs)})`),
  )
  return new Map(rows.map((row) => [row.slug, Number(row.room_id)]))
}

/** Writes rooms with v1's ids; returns how many were new. */
export async function insertRooms(db: Executor, rooms: readonly PlannedRoom[]): Promise<number> {
  if (rooms.length === 0) return 0
  const rows = await db
    .insert(room)
    .values(rooms.map((r) => ({ ...r, origin: 'v1' as const })))
    .onConflictDoNothing({ target: room.id })
    .returning({ id: room.id })
  return rows.length
}

/** Writes addresses, each released at the room's last use plus its hold (`holds.ts`); returns how many were new. */
export async function insertAddresses(
  db: Executor,
  slugs: readonly PlannedSlug[],
): Promise<number> {
  if (slugs.length === 0) return 0
  const values = sql.join(
    slugs.map(
      (s) =>
        sql`(${s.slug}, ${s.roomId}, ${s.kind}, ${s.primary}, ${at(s.lastUsedAt)} + ${interval(
          s.kind === 'number' ? NUMBER_HOLD : NAME_HOLD,
        )})`,
    ),
    sql`, `,
  )
  const rows = rowsOf<{ slug: string }>(
    await db.execute(sql`
      INSERT INTO fpp.room_slug (slug, room_id, kind, is_primary, release_at) VALUES ${values}
      ON CONFLICT (slug) DO NOTHING RETURNING slug`),
  )
  return rows.length
}

/** Writes one untitled, finished topic per round; returns how many were new. */
export async function insertTopics(db: Executor, rounds: readonly PlannedRound[]): Promise<number> {
  if (rounds.length === 0) return 0
  const rows = await db
    .insert(topic)
    .values(
      rounds.map((r) => ({
        id: r.topicId,
        roomId: r.roomId,
        position: r.no,
        title: '',
        state: 'done' as const,
        createdAt: r.startedAt,
      })),
    )
    .onConflictDoNothing({ target: topic.id })
    .returning({ id: topic.id })
  return rows.length
}

/**
 * Writes the rounds with v1's summary and no distribution. jsonb goes in as objects through raw SQL, so it is stored as
 * jsonb and not as a JSON string (`src/db/AGENTS.md`). Returns how many were new.
 */
export async function insertRounds(db: Executor, rounds: readonly PlannedRound[]): Promise<number> {
  if (rounds.length === 0) return 0
  const deck = { id: V1_DECK }
  const values = sql.join(
    rounds.map(
      (r) =>
        sql`(${r.id}, ${r.roomId}, ${r.topicId}, ${r.no}, 1, ${deck}::jsonb, ${at(r.startedAt)}, ${at(
          r.revealedAt,
        )}, ${r.players}, ${r.spectators}, '[]'::jsonb, ${r.consensus}, ${r.autoReveal}, ${
          r.summary === null ? null : sql`${r.summary}::jsonb`
        })`,
    ),
    sql`, `,
  )
  const rows = rowsOf<{ id: string }>(
    await db.execute(sql`
      INSERT INTO fpp.round (id, room_id, topic_id, no, attempt, deck, started_at, revealed_at, players, spectators,
                             distribution, consensus, auto_reveal, summary)
      VALUES ${values}
      ON CONFLICT (id) DO NOTHING RETURNING id`),
  )
  return rows.length
}

/** Writes estimating days as the API records them; returns how many were new. */
export const insertVisitorDays = recordEstimatingDays

/** Writes daily rows, rewriting a row only where its value differs; returns how many changed. */
export async function upsertStats(db: Executor, stats: readonly PlannedStat[]): Promise<number> {
  if (stats.length === 0) return 0
  const rows = await db
    .insert(statDaily)
    .values([...stats])
    .onConflictDoUpdate({
      target: [statDaily.day, statDaily.metric, statDaily.dimension],
      set: { value: sql`excluded.value` },
      setWhere: sql`${statDaily.value} IS DISTINCT FROM excluded.value`,
    })
    .returning({ day: statDaily.day })
  return rows.length
}

/** New v9 rooms take ids after v1's: the identity moves past the highest id, never back. */
export async function advanceRoomIds(db: Executor): Promise<void> {
  await db.execute(sql`
    SELECT setval(seq, GREATEST((SELECT coalesce(max(id), 1) FROM fpp.room), coalesce(pg_sequence_last_value(seq::regclass), 1)))
    FROM (SELECT pg_get_serial_sequence('fpp."room"', 'id') AS seq) s`)
}
