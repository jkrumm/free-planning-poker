/**
 * The composition root (docs/v9/ARCHITECTURE.md, Server): what `main.ts` serves, from the parsed environment. The
 * pool, the adapters on it and the expiry job are acquired in one scope and released in reverse when it closes:
 * the job stops, the writes still waiting get `FLUSH_WAIT` to land, then the pool closes.
 */
import type { RoomRuntime } from '@fpp/room-core/server'
import { Effect, Exit, Scope } from 'effect'
import { postgresHistory } from '../db/history.ts'
import { acquireDatabase } from '../db/resilience.ts'
import { postgresStore } from '../db/store.ts'
import type { Env } from '../env.ts'
import { createApp } from '../http/app.ts'
import { clientOf } from '../ws/edge.ts'
import { createSpa } from '../http/spa.ts'
import { expiryJob } from '../jobs/expiry.ts'
import { rollupJob } from '../jobs/rollup.ts'
import type { ApiTelemetry } from '../telemetry.ts'
import { timerClock } from '../ws/clock.ts'
import type { RoomServerOptions } from '../ws/edge.ts'
import { createMessages } from './messages.ts'
import { postgresRooms } from './rooms.ts'
import { postgresStats } from './stats.ts'
import { systemIds, systemSecrets } from './system.ts'

/** How long closing the scope waits for snapshot and history writes still in flight. */
const FLUSH_WAIT = '5 seconds'

export type Api = {
  readonly options: RoomServerOptions
  /** From now on `/api/health` answers 503: the first step of the drain on SIGTERM. */
  readonly drain: () => void
  /** Releases everything `composeApi` acquired, in reverse. Call it after the server has stopped. */
  readonly close: () => Promise<void>
}

type Deps = { readonly now: () => number; readonly telemetry: ApiTelemetry }

const compose = (env: Env, deps: Deps, state: { draining: boolean }) =>
  Effect.gen(function* () {
    const now = () => new Date(deps.now())
    const { server, port: telemetry } = deps.telemetry
    const failed = (component: string, action: string) => (error: unknown) =>
      server.recordError(error, { component, action }, 'high')
    const database = yield* acquireDatabase({ url: env.databaseUrl })
    const store = postgresStore({ database, owner: crypto.randomUUID(), now })
    const history = postgresHistory({ database, visitorKey: env.visitorKey, now })
    yield* Effect.addFinalizer(() =>
      Effect.promise(() => Promise.all([store.idle(), history.idle()])).pipe(
        Effect.timeoutOrElse({ duration: FLUSH_WAIT, orElse: () => Effect.void }),
        Effect.ensuring(
          Effect.sync(() => {
            store.abort()
            history.abort()
          }),
        ),
      ),
    )
    yield* Effect.forkScoped(expiryJob({ database, now, failed: failed('expiry', 'sweep') }))
    yield* Effect.forkScoped(rollupJob({ database, now, failed: failed('rollup', 'tick') }))
    const clock = timerClock({
      now: deps.now,
      failed: (error) => telemetry.failure(error, { action: 'timer' }),
    })
    yield* Effect.addFinalizer(() => Effect.sync(() => clock.stop()))

    let runtime: RoomRuntime | undefined
    const rooms = postgresRooms({
      database,
      ids: systemIds,
      now,
      runtime: () => runtime,
      exhausted: server.numbersExhausted,
      failed: failed('rooms', 'route'),
    })
    const stats = postgresStats({
      database,
      now,
      tablesOpen: () => runtime?.stats().rooms ?? 0,
      failed: failed('stats', 'read'),
    })
    const messages = createMessages({
      gateway: env.emailGateway,
      door: env.feedbackDoor,
      now: deps.now,
      failed: (error, at) => server.recordError(error, at, 'high'),
    })
    const origins = new Set(env.origins)
    const spa = createSpa(env.roomAppDir)
    const options: RoomServerOptions = {
      port: env.port,
      ...(spa === undefined ? {} : { spa }),
      origins: env.origins,
      ...(env.clientIpHeader === undefined ? {} : { clientIpHeader: env.clientIpHeader }),
      http: (live) => {
        runtime = live
        return createApp({
          build: { version: env.version, commit: env.commit },
          rooms: rooms.api,
          stats,
          messages,
          origins,
          client: clientOf(env.clientIpHeader),
          health: () => (state.draining ? Promise.resolve('draining') : rooms.health()),
        })
      },
      rooms: rooms.directory,
      ports: { clock, ids: systemIds, secrets: systemSecrets, store, history, telemetry },
      runtime: { build: env.version },
    }
    return options
  })

/** Builds the room server's options on Postgres. */
export async function composeApi(env: Env, deps: Deps): Promise<Api> {
  const scope = Scope.makeUnsafe()
  const state = { draining: false }
  const options = await Effect.runPromise(compose(env, deps, state).pipe(Scope.provide(scope)))
  return {
    options,
    drain: () => {
      state.draining = true
    },
    close: () => Effect.runPromise(Scope.close(scope, Exit.void)),
  }
}
