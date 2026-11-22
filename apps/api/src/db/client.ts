import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import type { BunSQLDatabase, BunSQLQueryResultHKT } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import * as schema from './schema.ts'

export type Db = BunSQLDatabase<typeof schema>

/** A `Db` or a transaction of it: the repositories run on either, so a caller can group them in one transaction. */
export type Executor = PgDatabase<BunSQLQueryResultHKT, typeof schema>

export type DbClient = { readonly db: Db; close(): Promise<void> }

/** Connects to `url`. The caller owns the environment: this adapter reads none. */
export function createDb(options: { readonly url: string; readonly max?: number }): DbClient {
  const db = drizzle({ connection: { url: options.url, max: options.max ?? 10 }, schema })
  return { db, close: () => db.$client.close() }
}

/** The two-integer key of the migration lock: this application's namespace (the rollup's), then the job. */
const LOCK_NAMESPACE = 1_718_775_904
const LOCK_MIGRATE = 2

/** Applies every migration in `migrationsFolder` that has not run yet; the journal lives in schema `fpp`. */
export async function runMigrations(db: Db, migrationsFolder: string): Promise<void> {
  await migrate(db, {
    migrationsFolder,
    migrationsSchema: 'fpp',
    migrationsTable: '__drizzle_migrations',
  })
}

/**
 * The migrations as a starting container runs them: under a session advisory lock held on a connection of its own,
 * so two containers that start together apply them one after the other and the second finds nothing left to do.
 * Closing the lock's connection releases the lock, also when this process dies.
 */
export async function migrateOnStart(options: {
  readonly url: string
  readonly migrationsFolder: string
}): Promise<void> {
  const lock = createDb({ url: options.url, max: 1 })
  const work = createDb({ url: options.url, max: 1 })
  try {
    await lock.db.execute(sql`SELECT pg_advisory_lock(${LOCK_NAMESPACE}, ${LOCK_MIGRATE})`)
    await runMigrations(work.db, options.migrationsFolder)
  } finally {
    await work.close()
    await lock.close()
  }
}
