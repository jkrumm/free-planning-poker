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

/** Applies every migration in `migrationsFolder` that has not run yet; the journal lives in schema `fpp`. */
export async function runMigrations(db: Db, migrationsFolder: string): Promise<void> {
  await migrate(db, {
    migrationsFolder,
    migrationsSchema: 'fpp',
    migrationsTable: '__drizzle_migrations',
  })
}
