/**
 * The hourly sweep (docs/v9/ARCHITECTURE.md, Server: Expiry): live snapshots past their lifetime, and estimating days
 * older than 13 months, the schema's one scheduled deletion. Nothing here deletes a room, a round or a vote.
 */
import { Effect, Schedule } from 'effect'
import { type Database, retryWhileDown } from '../db/resilience.ts'
import { sweepSnapshots } from '../db/rooms.ts'
import { deleteEstimatingDaysBefore } from '../db/visitors.ts'

const SWEEP_EVERY = '1 hour'

/** One sweep; what it deleted. An outage waits, a bug is reported and the next sweep runs anyway. */
const sweepOnce = (deps: {
  readonly database: Database
  readonly now: () => Date
  readonly failed: (error: unknown) => void
}) =>
  retryWhileDown(
    deps.database.run(async (db) => {
      const now = deps.now()
      return {
        snapshots: await sweepSnapshots(db, { now }),
        visitorDays: await deleteEstimatingDaysBefore(db, { now }),
      }
    }),
  ).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        deps.failed(error)
        return { snapshots: 0, visitorDays: 0 }
      }),
    ),
  )

/** Sweeps at once, then every hour, until its scope closes. */
export const expiryJob = (deps: Parameters<typeof sweepOnce>[0]) =>
  sweepOnce(deps).pipe(Effect.repeat(Schedule.spaced(SWEEP_EVERY)), Effect.asVoid)
