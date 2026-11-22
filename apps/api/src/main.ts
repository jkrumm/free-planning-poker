import { composeApi } from './app/compose.ts'
import { parseEnv } from './env.ts'
import { createApiTelemetry } from './telemetry.ts'
import { serveBun } from './ws/bun.transport.ts'

const env = parseEnv(process.env)
const telemetry = createApiTelemetry(env)
const api = await composeApi(env, { now: Date.now, telemetry })
const server = await serveBun(api.options)
telemetry.server.observeLoad(server.runtime.stats)

console.log(`fpp api ${env.version} (${env.commit}) on port ${server.port}`)
