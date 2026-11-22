import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { startPostgres } from '@fpp/test-kit/postgres'
import type { PostgresCluster } from '@fpp/test-kit/postgres'
import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { createApp } from '../http/app.ts'
import { NO_ROOMS } from '../../test/support.ts'
import { postgresStats } from '../app/stats.ts'
import { rollupTick } from '../jobs/rollup.ts'
import { createDb, runMigrations } from './client.ts'
import type { DbClient } from './client.ts'
import { DbDefect, type Database } from './resilience.ts'
import { computeDay, readStats, rollupDay } from './rollups.ts'
import { rowsOf } from './sql.ts'
import { METRIC } from './stat-metrics.ts'
import { upsertDailyStat } from './visitors.ts'
import { addDays } from './stat-calendar.ts'
import { EXPECTED, FIXTURE_DAYS, seedFixture, type DayFigures } from '../../test/stat-fixture.ts'

const MIGRATIONS = new URL('../../drizzle', import.meta.url).pathname

let cluster: PostgresCluster
let client: DbClient
const clients: DbClient[] = []

const at = (iso: string) => () => new Date(iso)

const databaseOf = (on: DbClient): Database => ({
  run: (work) =>
    Effect.tryPromise({ try: () => work(on.db), catch: (cause) => new DbDefect({ cause }) }),
})

beforeAll(async () => {
  cluster = await startPostgres()
  client = createDb({ url: cluster.url })
  clients.push(client)
  await runMigrations(client.db, MIGRATIONS)
  await seedFixture(client)
}, 60_000)

afterAll(async () => {
  await Promise.all(clients.map((one) => one.close()))
  await cluster?.stop()
})

type StatRow = { day: string; metric: string; dimension: string; value: number }

const statRows = async (where = sql`true`): Promise<StatRow[]> =>
  rowsOf<{ day: string; metric: string; dimension: string; value: number }>(
    await client.db.execute(sql`
      SELECT day::text AS day, metric, dimension, value FROM fpp.stat_daily WHERE ${where}
      ORDER BY day, metric, dimension`),
  )

/** What a day's rows say, in the shape of the hand-counted fixture. */
function figuresOf(rows: readonly StatRow[], day: string): DayFigures {
  const of = (metric: string) =>
    rows.find((row) => row.day === day && row.metric === metric && row.dimension === '')?.value ??
    -1
  const dims = (metric: string) =>
    Object.fromEntries(
      rows
        .filter((row) => row.day === day && row.metric === metric)
        .map((row) => [row.dimension, row.value]),
    )
  return {
    rounds: of(METRIC.rounds),
    votes: of(METRIC.votes),
    consensus: of(METRIC.roundsConsensus),
    created: of(METRIC.roomsCreated),
    active: of(METRIC.roomsActive),
    estimators: of(METRIC.estimators),
    estimatorsNew: of(METRIC.estimatorsNew),
    hours: dims(METRIC.roundsByHour),
    cards: dims(METRIC.cardVotes),
  }
}

describe('the daily rollup', () => {
  test('rolls ten seeded days into exactly the hand-counted rows, and a second run changes nothing', async () => {
    for (const day of FIXTURE_DAYS) expect(await rollupDay(client.db, { day })).toBe(true)
    const first = await statRows()
    for (const day of FIXTURE_DAYS) expect(figuresOf(first, day)).toEqual(EXPECTED[day]!)

    for (const day of FIXTURE_DAYS) expect(await rollupDay(client.db, { day })).toBe(true)
    expect(await statRows()).toEqual(first)
    // Seven scalars a day, the sparse hours and the cards.
    const sparse = Object.values(EXPECTED).reduce(
      (n, d) => n + Object.keys(d.hours).length + Object.keys(d.cards).length,
      0,
    )
    expect(first).toHaveLength(FIXTURE_DAYS.length * 7 + sparse)
  })

  test('a day is the UTC day: a round at exactly midnight belongs to the day it opens', async () => {
    const rows = await computeDay(client.db, '2026-06-04')
    expect(rows.find((row) => row.metric === METRIC.rounds)?.value).toBe(1)
    expect(
      await computeDay(client.db, '2026-06-03').then(
        (r) => r.find((x) => x.metric === METRIC.rounds)?.value,
      ),
    ).toBe(2)
  })

  test("replacing a day leaves the importer's rows and drops a dimension that is gone", async () => {
    await upsertDailyStat(client.db, {
      day: '2026-06-01',
      metric: METRIC.pageViews,
      dimension: '/',
      value: 7,
    })
    await upsertDailyStat(client.db, {
      day: '2026-06-01',
      metric: METRIC.cardVotes,
      dimension: 'fibonacci/99',
      value: 1,
    })
    await rollupDay(client.db, { day: '2026-06-01' })
    const rows = await statRows(sql`day = '2026-06-01'`)
    expect(rows.find((row) => row.metric === METRIC.pageViews)?.value).toBe(7)
    expect(rows.some((row) => row.dimension === 'fibonacci/99')).toBe(false)
    expect(figuresOf(rows, '2026-06-01')).toEqual(EXPECTED['2026-06-01']!)
    await client.db.execute(sql`DELETE FROM fpp.stat_daily WHERE metric = ${METRIC.pageViews}`)
  })
})

describe('the tick', () => {
  test('fills the days it missed, then rolls today, and yesterday once more after midnight', async () => {
    await client.db.execute(sql`DELETE FROM fpp.stat_daily`)
    const database = databaseOf(client)
    const tick = (iso: string) => Effect.runPromise(rollupTick({ database, now: at(iso) }))

    expect(await tick('2026-06-10T12:00:00Z')).toEqual({
      days: [...FIXTURE_DAYS],
      contended: false,
    })
    expect(await tick('2026-06-10T13:00:00Z')).toEqual({ days: ['2026-06-10'], contended: false })
    expect(await tick('2026-06-11T00:30:00Z')).toEqual({
      days: ['2026-06-10', '2026-06-11'],
      contended: false,
    })
    expect(await tick('2026-06-11T01:30:00Z')).toEqual({ days: ['2026-06-11'], contended: false })
    // The process was down for two days.
    expect(await tick('2026-06-13T09:00:00Z')).toEqual({
      days: ['2026-06-11', '2026-06-12', '2026-06-13'],
      contended: false,
    })
    const rows = await statRows()
    for (const day of FIXTURE_DAYS) expect(figuresOf(rows, day)).toEqual(EXPECTED[day]!)
  })

  test('two runners on one database: while one rolls a day the other does nothing', async () => {
    const other = createDb({ url: cluster.url, max: 3 })
    clients.push(other)
    const a = databaseOf(client)
    const b = databaseOf(other)
    const now = at('2026-06-13T10:00:00Z')

    let entered!: () => void
    const inside = new Promise<void>((resolve) => (entered = resolve))
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    let ranByA = 0
    let ranByB = 0

    const first = Effect.runPromise(
      rollupTick({
        database: a,
        now,
        compute: async (db, day) => {
          ranByA += 1
          entered()
          await gate
          return computeDay(db, day)
        },
      }),
    )
    await inside
    const second = await Effect.runPromise(
      rollupTick({
        database: b,
        now,
        compute: async (db, day) => {
          ranByB += 1
          return computeDay(db, day)
        },
      }),
    )
    expect(second).toEqual({ days: [], contended: true })
    expect(ranByB).toBe(0)
    release()
    expect(await first).toEqual({ days: ['2026-06-13'], contended: false })
    expect(ranByA).toBe(1)

    // The lock is released with the transaction: the other runner works at its next tick.
    expect(await Effect.runPromise(rollupTick({ database: b, now }))).toEqual({
      days: ['2026-06-13'],
      contended: false,
    })
  })
})

describe('the public figures', () => {
  test('totals, weeks, cards, heatmap and week over week from the rolled days', async () => {
    for (const day of FIXTURE_DAYS) await rollupDay(client.db, { day })
    const stats = await readStats(client.db, { today: '2026-06-10' })
    expect(stats.totals).toEqual({ rounds: 10, votes: 23, roomsCreated: 2, consensusRounds: 5 })
    expect(stats.consensusRate).toBe(0.5)
    expect(stats.weeks).toHaveLength(52)
    expect(stats.weeks.at(-1)).toEqual({ week: '2026-06-08', rounds: 3, consensus: 2 })
    expect(stats.weeks.at(-2)).toEqual({ week: '2026-06-01', rounds: 7, consensus: 3 })
    expect(stats.heatmap).toHaveLength(168)
    // 2026-06-01 is a Monday: 09:00 holds two rounds; Saturday 12:00 one; Monday 08:00 (the 8th and the 10th, a Wednesday).
    const cell = (weekday: number, hour: number) =>
      stats.heatmap.find((c) => c.weekday === weekday && c.hour === hour)?.rounds
    expect(cell(1, 9)).toBe(2)
    expect(cell(6, 12)).toBe(1)
    expect(cell(1, 8)).toBe(2)
    expect(cell(3, 8)).toBe(1)
    expect(cell(3, 0)).toBe(1)
    expect(cell(3, 23)).toBe(1)
    expect(stats.cards.filter((c) => c.deck === 'fibonacci').slice(0, 2)).toEqual([
      { deck: 'fibonacci', label: '5', votes: 9 },
      { deck: 'fibonacci', label: '8', votes: 3 },
    ])
    expect(stats.cards.some((c) => c.deck === 'custom')).toBe(false)
    // Wednesday the 10th: Monday to Wednesday of both weeks.
    expect(stats.weekOverWeek.workingDays).toBe(3)
    expect(stats.weekOverWeek.current).toEqual({
      from: '2026-06-08',
      to: '2026-06-10',
      rounds: 3,
      votes: 5,
      roomsCreated: 0,
    })
    expect(stats.weekOverWeek.previous).toEqual({
      from: '2026-06-01',
      to: '2026-06-03',
      rounds: 5,
      votes: 14,
      roomsCreated: 2,
    })
    expect(stats.weekOverWeek.change).toEqual({
      rounds: -0.4,
      votes: (5 - 14) / 14,
      roomsCreated: -1,
    })
  })

  test('week over week is null where the previous span has nothing', async () => {
    const stats = await readStats(client.db, { today: '2026-06-02' })
    expect(stats.weekOverWeek.previous.rounds).toBe(0)
    expect(stats.weekOverWeek.change.rounds).toBeNull()
  })

  test('answers over a year of rollups, and the time it takes is printed', async () => {
    const year = createDb({ url: cluster.url, max: 2 })
    clients.push(year)
    await year.db.execute(sql`DELETE FROM fpp.stat_daily`)
    const last = '2026-06-10'
    const decks = ['fibonacci', 'modified-fibonacci', 't-shirt', 'powers-of-two']
    await year.db.execute(sql`
      INSERT INTO fpp.stat_daily (day, metric, dimension, value)
      SELECT d::date, m.metric, '', (extract(doy FROM d)::int % 50 + 1)
      FROM generate_series(${last}::date - 364, ${last}::date, interval '1 day') AS d,
           (VALUES ('rounds'), ('votes'), ('rounds_consensus'), ('rooms_created'), ('rooms_active'),
                   ('estimators'), ('estimators_new')) AS m(metric)`)
    await year.db.execute(sql`
      INSERT INTO fpp.stat_daily (day, metric, dimension, value)
      SELECT d::date, 'rounds_by_hour', lpad(h::text, 2, '0'), (h + 1)
      FROM generate_series(${last}::date - 364, ${last}::date, interval '1 day') AS d, generate_series(0, 23) AS h`)
    for (const deck of decks)
      await year.db.execute(sql`
        INSERT INTO fpp.stat_daily (day, metric, dimension, value)
        SELECT d::date, 'card_votes', ${deck} || '/' || c, (length(c) + 1)
        FROM generate_series(${last}::date - 364, ${last}::date, interval '1 day') AS d,
             unnest(ARRAY['1','2','3','5','8','13','21','34','55','89','?','coffee']) AS c`)
    const [{ n }] = rowsOf<{ n: string }>(
      await year.db.execute(sql`SELECT count(*) AS n FROM fpp.stat_daily`),
    ) as [{ n: string }]

    const stats = postgresStats({
      database: databaseOf(year),
      now: () => new Date(`${last}T12:00:00Z`),
      tablesOpen: () => 0,
      failed: (error) => {
        throw error
      },
    })
    const app = createApp({
      build: { version: 'test', commit: 'test' },
      rooms: NO_ROOMS,
      stats,
      health: async () => 'ok',
    })
    const get = () => app.handle(new Request('http://localhost/api/stats'))
    const started = performance.now()
    const cold = await get()
    const coldMs = performance.now() - started
    const warmStarted = performance.now()
    const warm = await get()
    const warmMs = performance.now() - warmStarted
    console.log(
      `stats over ${n} rollup rows (365 days): cold ${coldMs.toFixed(1)} ms, cached ${warmMs.toFixed(2)} ms`,
    )
    expect(cold.status).toBe(200)
    expect(((await cold.json()) as { weeks: unknown[] }).weeks).toHaveLength(52)
    expect(warm.status).toBe(200)
    expect(addDays(last, 0)).toBe(last)
    // A generous bound: the figure is in the pull request, this only catches a query that scans the world.
    expect(coldMs).toBeLessThan(2000)
  })
})
