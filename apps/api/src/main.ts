import { parseEnv } from './env.ts'
import { createApp } from './http/app.ts'

const env = parseEnv(process.env)
const app = createApp({ build: { version: env.version, commit: env.commit } }).listen(env.port)

console.log(`fpp api ${env.version} (${env.commit}) on port ${app.server?.port}`)
