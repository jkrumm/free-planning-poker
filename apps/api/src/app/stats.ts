/**
 * What `GET /api/stats` does with Postgres and the live rooms (docs/v9/ARCHITECTURE.md, HTTP API): the figures are read
 * from the rollups, with the number of open tables from the running rooms, and the answer is kept in the process for
 * `STATS_MAX_AGE_SECONDS` so a burst of requests reads Postgres once. While Postgres is away the last answer is served
 * as it was, its `computedAt` telling its age.
 */
import { Effect } from 'effect'
import { DbDefect, type Database, retryBriefly } from '../db/resilience.ts'
import { readStats } from '../db/rollups.ts'
import { utcDay } from '../db/visitors.ts'
import {
  STATS_MAX_AGE_SECONDS,
  STATS_VERSION,
  type StatsApi,
  type StatsBody,
} from '../http/stats.ts'

export type StatsDeps = {
  readonly database: Database
  readonly now: () => Date
  /**
   * Tables open right now: the rooms the answering process runs. A room has one owner at a time (invariant 12), so the
   * processes of a handoff never count one room twice; the room still on the old process is missed until it moves, and
   * the old process answers 503 on health, so the proxy sends the page to the new one.
   */
  readonly tablesOpen: () => number
  /** A bug below the route, reported once. */
  readonly failed: (error: unknown) => void
}

export function postgresStats(deps: StatsDeps): StatsApi {
  let kept: { readonly at: number; readonly stats: StatsBody } | undefined
  let loading: ReturnType<StatsApi['read']> | undefined

  const load = (): ReturnType<StatsApi['read']> => {
    const now = deps.now()
    return Effect.runPromise(
      retryBriefly(deps.database.run((db) => readStats(db, { today: utcDay(now) }))).pipe(
        Effect.match({
          onFailure: (error) => {
            if (error instanceof DbDefect) deps.failed(error.cause)
            return kept === undefined
              ? ({ ok: false, error: 'unavailable' } as const)
              : ({ ok: true, stats: kept.stats } as const)
          },
          onSuccess: (rolled) => {
            const stats: StatsBody = {
              version: STATS_VERSION,
              computedAt: now.toISOString(),
              ...rolled,
              tablesOpen: deps.tablesOpen(),
            }
            kept = { at: now.getTime(), stats }
            return { ok: true, stats } as const
          },
        }),
      ),
    )
  }

  return {
    read: () => {
      if (kept !== undefined && deps.now().getTime() - kept.at < STATS_MAX_AGE_SECONDS * 1000)
        return Promise.resolve({ ok: true, stats: kept.stats })
      loading ??= load().finally(() => {
        loading = undefined
      })
      return loading
    },
  }
}
