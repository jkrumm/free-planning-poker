/**
 * The room server's options from the parsed environment: what `main.ts` serves. Rooms live in memory until
 * `v9-api-persistence` puts them in Postgres.
 */
import type { RuntimeTelemetry } from '@fpp/room-core/server'
import type { Env } from '../env.ts'
import { createApp } from '../http/app.ts'
import { timerClock } from '../ws/clock.ts'
import type { RoomServerOptions } from '../ws/edge.ts'
import { memoryRooms } from './memory-rooms.ts'
import { systemIds, systemSecrets } from './system.ts'

export function roomServerOptions(
  env: Env,
  deps: { readonly now: () => number; readonly telemetry: RuntimeTelemetry },
): RoomServerOptions {
  const rooms = memoryRooms()
  return {
    port: env.port,
    origins: env.origins,
    ...(env.clientIpHeader === undefined ? {} : { clientIpHeader: env.clientIpHeader }),
    http: createApp({ build: { version: env.version, commit: env.commit } }),
    rooms: rooms.directory,
    ports: {
      clock: timerClock({
        now: deps.now,
        failed: (error) => deps.telemetry.failure(error, { action: 'timer' }),
      }),
      ids: systemIds,
      secrets: systemSecrets,
      store: rooms.store,
      history: rooms.history,
      telemetry: deps.telemetry,
    },
    runtime: { build: env.version },
  }
}
