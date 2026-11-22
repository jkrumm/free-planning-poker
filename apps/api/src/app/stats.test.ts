import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { DbDefect, type Database } from '../db/resilience.ts'
import type { RolledStats } from '../db/rollups.ts'
import { postgresStats } from './stats.ts'

const rolled = {
  totals: { rounds: 1, votes: 2, roomsCreated: 1, consensusRounds: 1 },
  consensusRate: 1,
  weeks: [],
  cards: [],
  heatmap: [],
  weekOverWeek: {
    workingDays: 1,
    current: { from: '2026-06-08', to: '2026-06-08', rounds: 0, votes: 0, roomsCreated: 0 },
    previous: { from: '2026-06-01', to: '2026-06-01', rounds: 0, votes: 0, roomsCreated: 0 },
    change: { rounds: null, votes: null, roomsCreated: null },
  },
} satisfies RolledStats

function setup() {
  const reported: unknown[] = []
  const state = { reads: 0, down: false, now: Date.parse('2026-06-08T12:00:00Z'), open: 3 }
  const database: Database = {
    run: <A>() => {
      state.reads += 1
      return (
        state.down ? Effect.fail(new DbDefect({ cause: 'down' })) : Effect.succeed(rolled)
      ) as Effect.Effect<A, DbDefect>
    },
  }
  const stats = postgresStats({
    database,
    now: () => new Date(state.now),
    tablesOpen: () => state.open,
    failed: (error) => reported.push(error),
  })
  return { state, stats, reported }
}

test('a second call within the age is answered from the cache; the first after it reads again', async () => {
  const { state, stats } = setup()
  const first = await stats.read()
  state.open = 9
  state.now += 59_000
  const second = await stats.read()
  expect(state.reads).toBe(1)
  expect(second).toEqual(first)
  expect(first.ok && first.stats.tablesOpen).toBe(3)
  state.now += 2_000
  const third = await stats.read()
  expect(state.reads).toBe(2)
  expect(third.ok && third.stats.tablesOpen).toBe(9)
})

test('calls that arrive together share one read', async () => {
  const { state, stats } = setup()
  await Promise.all([stats.read(), stats.read(), stats.read()])
  expect(state.reads).toBe(1)
})

// A failing read is a defect here, which is not retried, so the test waits on no clock.
test('when the read fails the last answer is served as it was; with none, 503; the failure is reported', async () => {
  const { state, stats, reported } = setup()
  state.down = true
  expect(await stats.read()).toEqual({ ok: false, error: 'unavailable' })
  state.down = false
  const good = await stats.read()
  state.down = true
  state.now += 3_600_000
  expect(await stats.read()).toEqual(good)
  expect(reported).toHaveLength(2)
})
