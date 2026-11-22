/**
 * Two containers that start together run the migrations one after the other (docs/development.md, Image): both
 * finish, the journal holds each migration once, and nothing fails on a table that already exists.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { startPostgres, type PostgresCluster } from '@fpp/test-kit/postgres'
import { sql } from 'drizzle-orm'
import { createDb, migrateOnStart } from './client.ts'
import { rowsOf } from './sql.ts'

const MIGRATIONS = new URL('../../drizzle', import.meta.url).pathname

let cluster: PostgresCluster

beforeAll(async () => {
  cluster = await startPostgres()
}, 60_000)

afterAll(async () => {
  await cluster?.stop()
})

test('eight starts at once apply every migration once', async () => {
  const starts = Array.from({ length: 8 }, () =>
    migrateOnStart({ url: cluster.url, migrationsFolder: MIGRATIONS }),
  )
  expect((await Promise.allSettled(starts)).map((start) => start.status)).toEqual(
    Array.from({ length: 8 }, () => 'fulfilled'),
  )
  const client = createDb({ url: cluster.url, max: 1 })
  try {
    const rows = rowsOf<{ n: string }>(
      await client.db.execute(sql`SELECT count(*) AS n FROM fpp.__drizzle_migrations`),
    )
    const journal = JSON.parse(await readFile(`${MIGRATIONS}/meta/_journal.json`, 'utf8')) as {
      entries: unknown[]
    }
    expect(Number(rows[0]?.n)).toBe(journal.entries.length)
  } finally {
    await client.close()
  }
}, 60_000)
