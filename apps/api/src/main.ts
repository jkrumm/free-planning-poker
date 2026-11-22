import { composeApi } from './app/compose.ts'
import { parseEnv } from './env.ts'
import { createSpa } from './http/spa.ts'
import { createApiTelemetry } from './telemetry.ts'
import { serveBun } from './ws/bun.transport.ts'
import { DRAIN_DEADLINE_MS } from './ws/edge.ts'

const env = parseEnv(process.env)
const telemetry = createApiTelemetry(env)
const api = await composeApi(env, { now: Date.now, telemetry })
const server = await serveBun(api.options)
telemetry.server.observeLoad(server.runtime.stats)

/**
 * The drain on SIGTERM (docs/v9/ARCHITECTURE.md, Server: Ownership and handoff): health answers 503, every socket
 * closes with 4002 and every room is written and given up for the next process, then the process exits, within
 * `DRAIN_DEADLINE_MS` and the last writes' `FLUSH_WAIT`.
 */
async function shutdown() {
  let code = 0
  try {
    api.drain()
    await server.stop(DRAIN_DEADLINE_MS)
    await api.close()
  } catch (error) {
    telemetry.server.recordError(error, { component: 'api', action: 'shutdown' }, 'high')
    code = 1
  }
  await telemetry.server.shutdown()
  process.exit(code)
}

let stopping = false
process.on('SIGTERM', () => {
  if (stopping) return
  stopping = true
  void shutdown()
})

if (createSpa(env.roomAppDir) === undefined)
  console.warn(
    `no room app at ${env.roomAppDir}: /room answers 404 (build it with bun run --filter @fpp/room build)`,
  )
console.log(`fpp api ${env.version} (${env.commit}) on port ${server.port}`)
