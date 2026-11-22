import { createHmac } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { Executor } from './client.ts'
import { VISITOR_DAY_RETENTION } from './holds.ts'
import { statDaily, visitorDay } from './schema.ts'
import { at, interval, rowsOf } from './sql.ts'

/** The calendar day (UTC) of an instant, as `YYYY-MM-DD`. */
export const utcDay = (when: Date): string => when.toISOString().slice(0, 10)

/**
 * The one function that turns a device id into what `visitor_day` stores: HMAC-SHA256 under a server secret,
 * truncated to 16 bytes. A copy of the database cannot be matched to a browser without the key.
 */
export function hashVisitor(args: {
  readonly key: string | Uint8Array
  readonly deviceId: string
}): Uint8Array {
  const digest = createHmac('sha256', args.key).update(args.deviceId).digest()
  return new Uint8Array(digest.subarray(0, 16))
}

/** Records that a device estimated on a day; a repeat is ignored. Returns whether a row was added. */
export async function recordEstimatingDay(
  db: Executor,
  args: { readonly day: string; readonly visitor: Uint8Array },
): Promise<boolean> {
  const rows = await db
    .insert(visitorDay)
    .values({ day: args.day, visitor: args.visitor })
    .onConflictDoNothing()
    .returning({ day: visitorDay.day })
  return rows.length > 0
}

/** Deletes estimating days older than 13 months, the one scheduled deletion; returns how many. */
export async function deleteEstimatingDaysBefore(
  db: Executor,
  args: { readonly now: Date },
): Promise<number> {
  const rows = rowsOf<{ day: string }>(
    await db.execute(sql`
      DELETE FROM fpp.visitor_day
      WHERE day < (${at(args.now)} AT TIME ZONE 'UTC')::date - ${interval(VISITOR_DAY_RETENTION)}
      RETURNING day`),
  )
  return rows.length
}

/** Writes one rollup value; a rerun of the rollup for the same day and metric replaces it. */
export async function upsertDailyStat(
  db: Executor,
  args: {
    readonly day: string
    readonly metric: string
    readonly dimension?: string
    readonly value: number
  },
): Promise<void> {
  const dimension = args.dimension ?? ''
  await db
    .insert(statDaily)
    .values({ day: args.day, metric: args.metric, dimension, value: args.value })
    .onConflictDoUpdate({
      target: [statDaily.day, statDaily.metric, statDaily.dimension],
      set: { value: args.value },
    })
}
