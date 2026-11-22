import { expect, test } from 'bun:test'
import { NO_MESSAGES, NO_ROOMS } from '../../test/support.ts'
import { createApp } from './app.ts'
import { STATS_CACHE_CONTROL, STATS_VERSION, type StatsApi, type StatsBody } from './stats.ts'

const figures = { rounds: 3, votes: 5, roomsCreated: 0 }
const body: StatsBody = {
  version: STATS_VERSION,
  computedAt: '2026-06-10T12:00:00.000Z',
  totals: { rounds: 10, votes: 30, roomsCreated: 2, consensusRounds: 5 },
  consensusRate: 0.5,
  weeks: [{ week: '2026-06-08', rounds: 3, consensus: 2 }],
  cards: [{ deck: 'fibonacci', label: '5', votes: 9 }],
  heatmap: [{ weekday: 1, hour: 9, rounds: 2 }],
  tablesOpen: 4,
  weekOverWeek: {
    workingDays: 3,
    current: { from: '2026-06-08', to: '2026-06-10', ...figures },
    previous: { from: '2026-06-01', to: '2026-06-03', ...figures },
    change: { rounds: 0, votes: null, roomsCreated: null },
  },
}

const appOf = (stats: StatsApi) =>
  createApp({
    build: { version: '9.0.0', commit: 'abc123' },
    rooms: NO_ROOMS,
    messages: NO_MESSAGES,
    origins: new Set(),
    client: () => 'test',
    stats,
    health: async () => 'ok',
  })

test('GET /api/stats carries the documented fields and a public Cache-Control', async () => {
  const response = await appOf({ read: async () => ({ ok: true, stats: body }) }).handle(
    new Request('http://localhost/api/stats'),
  )
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe(STATS_CACHE_CONTROL)
  expect(STATS_CACHE_CONTROL).toBe('public, max-age=60, stale-while-revalidate=300')
  const json = (await response.json()) as StatsBody
  expect(Object.keys(json).toSorted()).toEqual(
    [
      'cards',
      'computedAt',
      'consensusRate',
      'heatmap',
      'tablesOpen',
      'totals',
      'version',
      'weekOverWeek',
      'weeks',
    ].toSorted(),
  )
  expect(json).toEqual(body)
})

test('GET /api/stats answers 503 and is not cached while the figures cannot be read', async () => {
  const response = await appOf({ read: async () => ({ ok: false, error: 'unavailable' }) }).handle(
    new Request('http://localhost/api/stats'),
  )
  expect(response.status).toBe(503)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual({ error: 'unavailable' })
})
