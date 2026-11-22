/**
 * How the API waits on Postgres (docs/v9/ARCHITECTURE.md, Server: Effect, where I/O fails). Every repository call runs
 * through `Database.run`, which turns a rejection into a typed error: `DbUnavailable` for a connection that failed or
 * timed out, which is retried, and `DbDefect` for anything else, which is a bug and never retried.
 */
import { Data, Effect, Schedule, type Scope } from 'effect'
import { createDb, type Db, type DbClient } from './client.ts'

/** Postgres could not be reached, or a statement took longer than `STATEMENT_TIMEOUT`. */
export class DbUnavailable extends Data.TaggedError('DbUnavailable')<{ readonly cause: unknown }> {}

/** A statement failed for a reason other than the connection: a bug, reported once, never retried. */
export class DbDefect extends Data.TaggedError('DbDefect')<{ readonly cause: unknown }> {}

export type DbError = DbUnavailable | DbDefect

/** Longest wait on one statement or transaction before it counts as an outage. */
export const STATEMENT_TIMEOUT = '10 seconds'

/** SQLSTATE class 08 (connection exception), 57P01 to 57P03 (the server shut down or is starting). */
const CONNECTION_STATE = /^(08|57P0[123])/
/** Bun SQL's own codes for a connection that failed, closed or timed out. */
const CONNECTION_CODE =
  /^(ERR_POSTGRES_(CONNECTION|IDLE_TIMEOUT|LIFETIME_TIMEOUT)|ECONN|EPIPE|ETIMEDOUT)/
/** What Bun 1.4.2's pool throws after an outage when it has lost its connections for good. */
const BROKEN_POOL = 'connection must be a PostgresSQLConnection'

/** Whether an error (or one of its causes; Drizzle wraps the driver's) says the connection failed. */
export function isConnectionError(error: unknown): boolean {
  let cause = error
  for (let depth = 0; depth < 5 && typeof cause === 'object' && cause !== null; depth += 1) {
    const { code, errno, message } = cause as { code?: unknown; errno?: unknown; message?: unknown }
    if (typeof code === 'string' && CONNECTION_CODE.test(code)) return true
    if (typeof errno === 'string' && CONNECTION_STATE.test(errno)) return true
    if (message === BROKEN_POOL) return true
    cause = (cause as { cause?: unknown }).cause
  }
  return false
}

/**
 * Exponential from 100 ms, never more than 5 s apart, jittered so the rooms of one process do not retry in step.
 * Retries only an outage: a `DbDefect` ends the effect at once.
 */
const backoff = Schedule.min([
  Schedule.exponential('100 millis'),
  Schedule.spaced('5 seconds'),
]).pipe(Schedule.jittered)

const outage = (error: DbError) => error instanceof DbUnavailable

/** For a write that must land: retried for as long as the outage lasts. */
export const retryWhileDown = <A, R>(effect: Effect.Effect<A, DbError, R>) =>
  Effect.retry(effect, { schedule: backoff, while: outage })

/** How long someone waiting on an answer (a claim, an HTTP route) waits out an outage before being told. */
export const BRIEF_WAIT = '2 seconds'

/** For a caller who is waiting: retried for `BRIEF_WAIT`, then the outage is the answer. */
export const retryBriefly = <A, R>(effect: Effect.Effect<A, DbError, R>) =>
  Effect.retry(effect, {
    schedule: Schedule.max([backoff, Schedule.during(BRIEF_WAIT)]),
    while: outage,
  })

export type Database = {
  /** One repository call or transaction on the current pool, as a typed effect. */
  readonly run: <A>(work: (db: Db) => Promise<A>) => Effect.Effect<A, DbError>
}

/** Lets go of a pool without waiting: closing one that an outage broke can hang. */
const drop = (client: DbClient) => {
  client.close().catch(() => {})
}

/**
 * The pool, acquired in a scope and closed with it. Bun's pool does not always recover from an outage (it keeps
 * throwing `BROKEN_POOL` after Postgres is back), so a connection error replaces the pool before the next attempt;
 * the old one is closed without waiting, as closing a broken pool can hang.
 */
export function acquireDatabase(options: {
  readonly url: string
  readonly max?: number
}): Effect.Effect<Database, never, Scope.Scope> {
  const connect = () =>
    createDb({ url: options.url, ...(options.max === undefined ? {} : { max: options.max }) })
  return Effect.acquireRelease(
    Effect.sync(() => {
      let client = connect()
      let generation = 0
      const replace = (seen: number) =>
        Effect.sync(() => {
          if (seen !== generation) return
          const broken = client
          client = connect()
          generation += 1
          drop(broken)
        })
      const database: Database & { readonly close: () => DbClient } = {
        run: (work) =>
          Effect.suspend(() => {
            const seen = generation
            const db = client.db
            return Effect.tryPromise({
              try: () => work(db),
              catch: (cause) =>
                isConnectionError(cause) ? new DbUnavailable({ cause }) : new DbDefect({ cause }),
            }).pipe(
              Effect.timeoutOrElse({
                duration: STATEMENT_TIMEOUT,
                orElse: () => Effect.fail(new DbUnavailable({ cause: 'statement timeout' })),
              }),
              Effect.tapError((error) => (outage(error) ? replace(seen) : Effect.void)),
            )
          }),
        close: () => client,
      }
      return database
    }),
    // A pool that cannot finish closing must not hold the shutdown.
    (database) =>
      Effect.promise(() =>
        database
          .close()
          .close()
          .catch(() => {}),
      ).pipe(Effect.timeoutOrElse({ duration: '2 seconds', orElse: () => Effect.void })),
  )
}

/**
 * Runs promise-returning tasks one after another per key: the writes of one room keep their order (its topic row is
 * written before a round that names it), while different rooms do not wait on each other.
 */
export function serialQueue() {
  const tails = new Map<string, Promise<unknown>>()
  return {
    run<A>(key: string, task: () => Promise<A>): Promise<A> {
      const previous = tails.get(key) ?? Promise.resolve()
      const result = previous.then(task, task)
      const tail = result.then(
        () => undefined,
        () => undefined,
      )
      tails.set(key, tail)
      void tail.then(() => tails.get(key) === tail && tails.delete(key))
      return result
    },
    /** Resolves when every task queued so far has ended. */
    idle: (): Promise<void> => Promise.all(tails.values()).then(() => undefined),
  }
}
