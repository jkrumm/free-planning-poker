import { roomServerOptions } from './app/compose.ts'
import { parseEnv } from './env.ts'
import { serveBun } from './ws/bun.transport.ts'

const env = parseEnv(process.env)
const server = await serveBun(roomServerOptions(env, { now: Date.now }))

console.log(`fpp api ${env.version} (${env.commit}) on port ${server.port}`)
