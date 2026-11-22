/**
 * `GET /api/stats` (docs/v9/ARCHITECTURE.md, HTTP API): the public figures behind the statistics page, from the daily
 * rollups. What it holds lives behind `StatsApi`, which the composition root implements and caches. The answer is public
 * and carries a `Cache-Control` of `STATS_MAX_AGE_SECONDS`.
 */
import { Elysia, t } from 'elysia'
import type { Static } from 'typebox'

/** How long a browser or the edge may reuse an answer, and how long the process reuses its own. */
export const STATS_MAX_AGE_SECONDS = 60
/** Beyond the max age an answer may be served while a fresh one is fetched. */
export const STATS_STALE_WHILE_REVALIDATE_SECONDS = 300
export const STATS_CACHE_CONTROL = `public, max-age=${STATS_MAX_AGE_SECONDS}, stale-while-revalidate=${STATS_STALE_WHILE_REVALIDATE_SECONDS}`

/** The contract's version: a field added keeps it, a field changed or removed raises it. */
export const STATS_VERSION = 1

const Span = t.Object({
  from: t.String(),
  to: t.String(),
  rounds: t.Number(),
  votes: t.Number(),
  roomsCreated: t.Number(),
})

const Change = t.Union([t.Number(), t.Null()])

export const StatsBody = t.Object({
  version: t.Literal(STATS_VERSION),
  /** ISO 8601: when the figures were read from the rollups (the rollups themselves are rolled hourly). */
  computedAt: t.String(),
  totals: t.Object({
    rounds: t.Number(),
    votes: t.Number(),
    roomsCreated: t.Number(),
    consensusRounds: t.Number(),
  }),
  /** Rounds with consensus over rounds; null before the first round. */
  consensusRate: Change,
  /** The last 52 weeks, oldest first, the current one last; `week` is the Monday (UTC). */
  weeks: t.Array(t.Object({ week: t.String(), rounds: t.Number(), consensus: t.Number() })),
  /** Votes per card of the built-in decks, per deck most played first. */
  cards: t.Array(t.Object({ deck: t.String(), label: t.String(), votes: t.Number() })),
  /** Rounds per weekday (1 Monday to 7 Sunday) and UTC hour over the last 52 weeks: always 168 cells. */
  heatmap: t.Array(t.Object({ weekday: t.Integer(), hour: t.Integer(), rounds: t.Number() })),
  /** Rooms with a live runtime on the process that answered, as of `computedAt`. */
  tablesOpen: t.Integer(),
  weekOverWeek: t.Object({
    workingDays: t.Integer(),
    current: Span,
    previous: Span,
    change: t.Object({ rounds: Change, votes: Change, roomsCreated: Change }),
  }),
})

export type StatsBody = Static<typeof StatsBody>

export type StatsApi = {
  readonly read: () => Promise<
    | { readonly ok: true; readonly stats: StatsBody }
    | { readonly ok: false; readonly error: 'unavailable' }
  >
}

export function statsRoutes(api: StatsApi) {
  return new Elysia().get(
    '/stats',
    {
      response: {
        200: StatsBody,
        503: t.Object({ error: t.Literal('unavailable') }),
      },
    },
    async ({ set, status }) => {
      const result = await api.read()
      if (result.ok) {
        set.headers['cache-control'] = STATS_CACHE_CONTROL
        return status(200, result.stats)
      }
      set.headers['cache-control'] = 'no-store'
      return status(503, { error: result.error })
    },
  )
}
