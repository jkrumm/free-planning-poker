/**
 * The daily rollup (docs/v9/ARCHITECTURE.md, Server: the jobs). Every hour it rolls today into `stat_daily`; on the
 * first tick of a new UTC day it rolls yesterday once more, and after a stop it catches up on the days it missed. A day
 * is rolled in one transaction under an advisory lock, so while two containers overlap in a handoff only one works.
 */
import { Effect, Schedule } from 'effect'
import { type Database, retryWhileDown } from '../db/resilience.ts'
import { type ComputeDay, firstDayToRoll, rollupDay } from '../db/rollups.ts'
import { daysFrom } from '../db/stat-calendar.ts'
import { utcDay } from '../db/visitors.ts'

export const ROLLUP_EVERY = '1 hour'

export type RollupDeps = {
  readonly database: Database
  readonly now: () => Date
  /** The computation of one day; the rollup's own unless a test brings another. */
  readonly compute?: ComputeDay
}

/** One tick: the days it rolled, and whether it stopped because another process held the lock. */
export const rollupTick = (deps: RollupDeps) =>
  Effect.gen(function* () {
    const today = utcDay(deps.now())
    const first = yield* retryWhileDown(deps.database.run((db) => firstDayToRoll(db, today)))
    const rolled: string[] = []
    for (const day of daysFrom(first, today)) {
      const ran = yield* retryWhileDown(
        deps.database.run((db) =>
          rollupDay(db, deps.compute === undefined ? { day } : { day, compute: deps.compute }),
        ),
      )
      if (!ran) return { days: rolled, contended: true }
      rolled.push(day)
    }
    return { days: rolled, contended: false }
  })

/** A tick whose failure is reported and answered with nothing rolled: the next tick runs anyway. */
export const rollupOnce = (deps: RollupDeps & { readonly failed: (error: unknown) => void }) =>
  rollupTick(deps).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        deps.failed(error)
        return { days: [] as string[], contended: false }
      }),
    ),
  )

/** Ticks at once, then every hour, until its scope closes. */
export const rollupJob = (deps: Parameters<typeof rollupOnce>[0]) =>
  rollupOnce(deps).pipe(Effect.repeat(Schedule.spaced(ROLLUP_EVERY)), Effect.asVoid)
