/**
 * The native mode of the suite (`E2E_MODE=native`, the default of `make e2e`): the room app and the API built as the
 * Dockerfile builds them, run as plain processes on a private PostgreSQL, with no Docker engine. The image mode
 * (`E2E_MODE=image`, CI) proves the shipped artifact; this one proves the same code without a VM.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import { startPostgres } from './postgres.ts'

const root = resolve(import.meta.dirname, '../..')
const BUN = process.env['BUN'] ?? 'bun'
/** The API drains in 20 s (ARCHITECTURE.md, Server); the rest is slack. */
const STOP_TIMEOUT_MS = 30_000
const START_TIMEOUT_MS = 60_000

/** Where a build writes: the same files the Dockerfile copies into the image. */
const MAIN = resolve(root, 'apps/api/dist/main.js')
const ROOM_APP = resolve(root, 'apps/room/dist')
const MIGRATIONS = resolve(root, 'apps/api/drizzle')

/** `bun run build` of the room app, then of the API: the two commands of the Dockerfile's build stage. */
export function buildNative(): Promise<number> {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    FPP_UMAMI_WEBSITE_ID: '',
    FPP_UMAMI_DOMAINS: '',
  }
  const build = (name: string) =>
    new Promise<number>((done) => {
      const child = spawn(BUN, ['run', '--filter', name, 'build'], {
        cwd: root,
        env,
        stdio: 'inherit',
      })
      child.on('error', () => done(127))
      child.on('close', (code) => done(code ?? 1))
    })
  return build('@fpp/room').then((code) => (code === 0 ? build('@fpp/api') : code))
}

export type Api = {
  /** What the process printed so far, for a failure's report. */
  output(): string
  /** SIGTERM and the drain; resolves with the exit code (0 is a clean drain). */
  stop(): Promise<number | null>
  /** SIGKILL, for a process that is exiting. */
  killSync(): void
}

/** Starts the built API on `port` against `databaseUrl`, and resolves once it listens (it logs `on port` last). */
export function startApi(options: {
  readonly port: number
  readonly databaseUrl: string
  readonly visitorKey: string
}): Promise<Api> {
  const baseURL = `http://127.0.0.1:${options.port}`
  // Only what the process is given: nothing of the caller's environment (OTLP, a client-IP header) leaks in.
  const env = {
    PATH: process.env['PATH'] ?? '',
    HOME: process.env['HOME'] ?? '',
    NODE_ENV: 'production',
    PORT: String(options.port),
    DATABASE_URL: options.databaseUrl,
    VISITOR_KEY: options.visitorKey,
    ALLOWED_ORIGINS: baseURL,
    ROOM_APP_DIR: ROOM_APP,
    MIGRATE_ON_START: 'true',
    MIGRATIONS_DIR: MIGRATIONS,
  }
  const child: ChildProcess = spawn(BUN, [MAIN], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  const exited = new Promise<number | null>((done) => child.once('close', (code) => done(code)))
  const collect = (chunk: Buffer) => {
    output += chunk.toString()
  }
  child.stdout?.on('data', collect)
  child.stderr?.on('data', collect)

  const api: Api = {
    output: () => output,
    stop: async () => {
      if (child.exitCode !== null || child.signalCode !== null) return exited
      child.kill('SIGTERM')
      const hung = setTimeout(() => child.kill('SIGKILL'), STOP_TIMEOUT_MS)
      try {
        return await exited
      } finally {
        clearTimeout(hung)
      }
    },
    killSync: () => void child.kill('SIGKILL'),
  }
  return new Promise((resolveApi, reject) => {
    const hang = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`the API did not listen in ${START_TIMEOUT_MS / 1000} s:\n${output}`))
    }, START_TIMEOUT_MS)
    child.stdout?.on('data', () => {
      if (!/ on port \d+/.test(output)) return
      clearTimeout(hang)
      resolveApi(api)
    })
    child.once('close', (code) => {
      clearTimeout(hang)
      reject(new Error(`the API exited with ${code} before it listened:\n${output}`))
    })
  })
}

export type NativeStack = {
  /** The API process that runs now: `replaceApi` swaps it. */
  current(): Api
  /** What a deploy does: SIGTERM, wait for the drain to exit 0, then a new process on the same port and database. */
  replaceApi(): Promise<void>
  stop(): Promise<void>
}

/** A private Postgres and an API process on `port`, with the exit guard that leaves nothing behind. */
export async function startNative(options: { readonly port: number }): Promise<NativeStack> {
  const postgres = await startPostgres()
  const visitorKey = randomBytes(32).toString('hex')
  const launch = () => startApi({ port: options.port, databaseUrl: postgres.url, visitorKey })
  let api: Api
  try {
    api = await launch()
  } catch (error) {
    await postgres.stop()
    throw error
  }
  let stopped = false
  const guard = () => {
    if (stopped) return
    api.killSync()
    postgres.stopSync()
  }
  process.once('exit', guard)
  const stack: NativeStack = {
    current: () => api,
    replaceApi: async () => {
      const code = await api.stop()
      if (code !== 0) throw new Error(`the API drained with exit code ${code}:\n${api.output()}`)
      api = await launch()
    },
    stop: async () => {
      if (stopped) return
      stopped = true
      process.removeListener('exit', guard)
      await api.stop()
      await postgres.stop()
    },
  }
  return stack
}
