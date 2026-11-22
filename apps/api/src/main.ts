import { memoryRooms } from './app/memory-rooms.ts'
import { consoleTelemetry, systemIds, systemSecrets } from './app/system.ts'
import { parseEnv } from './env.ts'
import { createApp } from './http/app.ts'
import { serveBun } from './ws/bun.transport.ts'
import { timerClock } from './ws/clock.ts'

const env = parseEnv(process.env)
// Rooms live in memory until v9-api-persistence puts them in Postgres.
const rooms = memoryRooms()
const server = await serveBun({
  port: env.port,
  origins: env.origins,
  ...(env.clientIpHeader === undefined ? {} : { clientIpHeader: env.clientIpHeader }),
  http: createApp({ build: { version: env.version, commit: env.commit } }),
  rooms: rooms.directory,
  ports: {
    clock: timerClock({
      now: Date.now,
      failed: (error) => consoleTelemetry.failure(error, { action: 'timer' }),
    }),
    ids: systemIds,
    secrets: systemSecrets,
    store: rooms.store,
    history: rooms.history,
    telemetry: consoleTelemetry,
  },
  runtime: { build: env.version },
})

console.log(`fpp api ${env.version} (${env.commit}) on port ${server.port}`)
