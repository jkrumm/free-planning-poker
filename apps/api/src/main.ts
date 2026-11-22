import { roomServerOptions } from './app/compose.ts'
import { parseEnv } from './env.ts'
import { createApiTelemetry } from './telemetry.ts'
import { serveBun } from './ws/bun.transport.ts'

const env = parseEnv(process.env)
const telemetry = createApiTelemetry(env)
const server = await serveBun(roomServerOptions(env, { now: Date.now, telemetry: telemetry.port }))
telemetry.server.observeLoad(server.runtime.stats)

console.log(`fpp api ${env.version} (${env.commit}) on port ${server.port}`)
