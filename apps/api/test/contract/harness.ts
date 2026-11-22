/**
 * One room server for the transport contract suite and the bake-off: an adapter, rooms in memory and the production
 * clock, ids and secrets. Tests pass the port in from `freePort()`.
 */
import { DEFAULT_SETTINGS, type RuntimeTelemetry } from '@fpp/room-core/server'
import { telemetryRecorder } from '@fpp/room-core/sim'
import { DECKS } from '@fpp/room-core/types'
import { memoryRooms } from '../../src/app/memory-rooms.ts'
import { systemIds, systemSecrets } from '../../src/app/system.ts'
import { createApp } from '../../src/http/app.ts'
import { timerClock } from '../../src/ws/clock.ts'
import type { RoomServer, RoomServerOptions } from '../../src/ws/edge.ts'
import { serveBun } from '../../src/ws/bun.transport.ts'
import { NO_ROOMS, NO_STATS } from '../support.ts'
import { ORIGIN } from './client.ts'

/**
 * The adapters the suite runs against: the bake-off's winner (docs/v9/evidence/transport.md). A candidate for a later
 * bake-off joins here and runs the same suite.
 */
export const ADAPTERS = {
  bun: serveBun,
} as const satisfies Record<string, (options: RoomServerOptions) => Promise<RoomServer>>

export type AdapterName = keyof typeof ADAPTERS

/** T-shirt cards, no countdown: a vote's label (`XXL`) appears in no id, and a reveal lands at once. */
export const SETTINGS = { ...DEFAULT_SETTINGS, deck: DECKS['t-shirt'], revealCountdown: 0 }

export async function startServer(
  adapter: AdapterName,
  port: number,
  options: { readonly clientIpHeader?: string; readonly telemetry?: RuntimeTelemetry } = {},
) {
  const rooms = memoryRooms()
  const recorder = telemetryRecorder()
  const telemetry = options.telemetry ?? recorder
  const clock = timerClock({
    now: Date.now,
    failed: (error) => telemetry.failure(error, { action: 'timer' }),
  })
  const server = await ADAPTERS[adapter]({
    port,
    hostname: '127.0.0.1',
    origins: [ORIGIN],
    ...(options.clientIpHeader === undefined ? {} : { clientIpHeader: options.clientIpHeader }),
    http: () =>
      createApp({
        build: { version: 'contract', commit: 'contract' },
        rooms: NO_ROOMS,
        stats: NO_STATS,
        health: async () => 'ok',
      }),
    rooms: rooms.directory,
    ports: {
      clock,
      ids: systemIds,
      secrets: systemSecrets,
      store: rooms.store,
      history: rooms.history,
      telemetry,
    },
    runtime: { build: 'contract' },
  })
  return {
    server,
    rooms,
    telemetry: recorder,
    url: (slug: string) => `ws://127.0.0.1:${server.port}/api/ws/${slug}`,
    async stop() {
      await server.stop()
      clock.stop()
    },
  }
}

export type Started = Awaited<ReturnType<typeof startServer>>
