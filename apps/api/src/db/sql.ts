import { sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'

/** A point in time as a statement parameter: the application's clock, never Postgres's `now()`, so tests need no sleep. */
export const at = (when: Date): SQL => sql`${when.toISOString()}::timestamptz`

/** A fixed interval literal from holds.ts (a constant of this module, never user input). */
export const interval = (literal: string): SQL => sql.raw(`interval '${literal}'`)

/** The rows of a raw statement; the bun-sql driver returns them as the array itself. */
export function rowsOf<Row>(result: unknown): Row[] {
  if (!Array.isArray(result)) throw new Error('unexpected result shape of a raw statement')
  return result as Row[]
}
