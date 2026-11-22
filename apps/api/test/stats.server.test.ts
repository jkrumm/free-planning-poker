/**
 * The statistics through the API as composed: the rollup job starts with the process and rolls what the database
 * holds, and `GET /api/stats` answers from the rollups, with the tables the process runs, and from its cache after.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { freePort } from '@fpp/test-kit/port'
import { startPostgres, type PostgresCluster } from '@fpp/test-kit/postgres'
import { sql } from 'drizzle-orm'
import type { DbClient } from '../src/db/client.ts'
import { STATS_CACHE_CONTROL, type StatsBody } from '../src/http/stats.ts'
import { prepare, query, startApi, until } from './api.ts'
import { FIXTURE_DAYS, seedFixture } from './stat-fixture.ts'

let cluster: PostgresCluster
let db: DbClient
let api: Awaited<ReturnType<typeof startApi>>
let clock = Date.parse('2026-06-10T12:00:00Z')

beforeAll(async () => {
  cluster = await startPostgres()
  db = await prepare(cluster.url)
  await seedFixture(db)
  api = await startApi(cluster.url, await freePort(), { now: () => clock })
}, 60_000)

afterAll(async () => {
  await api?.stop()
  await db?.close()
  await cluster?.stop()
})

test('the job rolls the seeded days at start, and GET /api/stats answers from them, then from its cache', async () => {
  await until(async () => {
    const [row] = await query<{ n: string }>(
      db,
      sql`SELECT count(*) AS n FROM fpp.stat_daily WHERE metric = 'rounds'`,
    )
    return Number(row?.n) === FIXTURE_DAYS.length
  })

  const first = await api.http('/stats')
  expect(first.status).toBe(200)
  expect(first.headers.get('cache-control')).toBe(STATS_CACHE_CONTROL)
  const stats = (await first.json()) as StatsBody
  expect(stats.version).toBe(1)
  expect(stats.computedAt).toBe('2026-06-10T12:00:00.000Z')
  expect(stats.totals).toEqual({ rounds: 10, votes: 23, roomsCreated: 2, consensusRounds: 5 })
  expect(stats.heatmap).toHaveLength(168)
  expect(stats.weeks).toHaveLength(52)
  expect(stats.tablesOpen).toBe(0)
  expect(stats.weekOverWeek.workingDays).toBe(3)

  // Within the age the answer is the same one, although the database has moved on.
  await db.db.execute(sql`DELETE FROM fpp.stat_daily`)
  clock += 30_000
  expect(await (await api.http('/stats')).json()).toEqual(stats)

  clock += 31_000
  const later = (await (await api.http('/stats')).json()) as StatsBody
  expect(later.totals.rounds).toBe(0)
  expect(later.computedAt).toBe('2026-06-10T12:01:01.000Z')
})
