import { expect, test } from 'bun:test'
import { SQL } from 'bun'
import { existsSync } from 'node:fs'
import { startPostgres } from './postgres.ts'

test('startPostgres runs a private cluster and removes it on stop', async () => {
  const cluster = await startPostgres()
  try {
    const sql = new SQL(cluster.url)
    try {
      await sql`create table probe (id int primary key)`
      await sql`insert into probe values (1)`
      const rows = await sql`select id, current_setting('port') as port from probe`
      expect(rows).toEqual([{ id: 1, port: String(cluster.port) }])
    } finally {
      await sql.close()
    }
  } finally {
    await cluster.stop()
  }
  expect(existsSync(cluster.dir)).toBe(false)
}, 60_000)
