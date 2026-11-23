/**
 * The API on a private Postgres for the server tier: in this process (`startApi`), or as its own process from
 * `src/main.ts` (`spawnApi`), which a test can kill. The test passes the port in, from `freePort()`.
 */
import { sql } from 'drizzle-orm'
import { composeApi } from '../src/app/compose.ts'
import { createDb, type DbClient, runMigrations } from '../src/db/client.ts'
import { rowsOf } from '../src/db/sql.ts'
import { parseEnv } from '../src/env.ts'
import { createApiTelemetry } from '../src/telemetry.ts'
import { serveBun } from '../src/ws/bun.transport.ts'
import type { ServerFrame } from '@fpp/room-core/types'
import { ORIGIN, type TestClient } from './contract/client.ts'
import { ENV } from './support.ts'

const MIGRATIONS = new URL('../drizzle', import.meta.url).pathname
const MAIN = new URL('../src/main.ts', import.meta.url).pathname

/** Applies the migrations and returns a client for the test's own queries. */
export async function prepare(url: string): Promise<DbClient> {
  const client = createDb({ url, max: 2 })
  await runMigrations(client.db, MIGRATIONS)
  return client
}

const envFor = (url: string, port: number) => ({
  ...ENV,
  DATABASE_URL: url,
  PORT: String(port),
  ALLOWED_ORIGINS: ORIGIN,
  APP_VERSION: 'test',
})

/** What both kinds of API offer a test: its socket and HTTP addresses. */
export type Endpoint = {
  readonly port: number
  readonly ws: (slug: string) => string
  readonly http: (path: string, init?: RequestInit) => Promise<Response>
}

const endpoint = (port: number): Endpoint => ({
  port,
  ws: (slug) => `ws://127.0.0.1:${port}/api/ws/${slug}`,
  http: (path, init) =>
    fetch(`http://127.0.0.1:${port}/api${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    }),
})

export async function startApi(
  url: string,
  port: number,
  options: { readonly now?: () => number } = {},
) {
  const env = parseEnv(envFor(url, port))
  const api = await composeApi(env, {
    now: options.now ?? Date.now,
    telemetry: createApiTelemetry(env),
  })
  const server = await serveBun({ ...api.options, hostname: '127.0.0.1' })
  return {
    ...endpoint(port),
    server,
    async stop() {
      await server.stop()
      await api.close()
    },
  }
}

export async function spawnApi(url: string, port: number) {
  // The Bun that runs the test runs the API too, so a test proves the pinned release where the runner is pinned.
  const child = Bun.spawn([process.execPath, MAIN], {
    env: { ...process.env, ...envFor(url, port) },
    stdout: 'pipe',
    stderr: 'inherit',
  })
  // The process says it listens once it does; nothing else is printed before that line.
  const reader = child.stdout.getReader()
  let text = ''
  while (!text.includes(' on port ')) {
    const { value, done } = await reader.read()
    if (done) throw new Error(`the API exited before it listened: ${text}`)
    text += new TextDecoder().decode(value)
  }
  reader.releaseLock()
  return {
    ...endpoint(port),
    child,
    /** Sends the signal; resolves with the exit code once the process has exited. */
    kill: (signal: 'SIGKILL' | 'SIGTERM' = 'SIGKILL') => {
      child.kill(signal)
      return child.exited
    },
  }
}

/**
 * Resolves once `probe` holds, checking every 20 ms: the wait on a condition another process (or the store's writer)
 * makes true, such as a row Postgres holds. Fails after `timeoutMs`.
 */
export async function until(probe: () => Promise<boolean>, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!(await probe())) {
    if (Date.now() > deadline) throw new Error('the condition did not hold in time')
    await Bun.sleep(20)
  }
}

export const query = async <Row>(client: DbClient, statement: ReturnType<typeof sql>) =>
  rowsOf<Row>(await client.db.execute(statement))

/** The room id an address leads to. */
export async function roomIdOf(client: DbClient, slug: string): Promise<number> {
  const [row] = await query<{ room_id: string }>(
    client,
    sql`SELECT room_id FROM fpp.room_slug WHERE slug = ${slug}`,
  )
  if (row === undefined) throw new Error(`no room at ${slug}`)
  return Number(row.room_id)
}

/** The seq of a room's stored snapshot, or -1 without one. */
export async function storedSeq(client: DbClient, roomId: number): Promise<number> {
  const [row] = await query<{ seq: string | null }>(
    client,
    sql`SELECT (state->>'seq') AS seq FROM fpp.room_snapshot WHERE room_id = ${roomId}`,
  )
  return row?.seq === null || row?.seq === undefined ? -1 : Number(row.seq)
}

type Evt = Extract<ServerFrame, { frame: 'evt' }>

/** An event of the room, received before or after the last frame the client waited for. */
export function eventOf<T extends Evt['type']>(
  client: TestClient,
  type: T,
): Promise<Extract<Evt, { type: T }>> {
  const seen = client.frames.find((frame) => frame.frame === 'evt' && frame.type === type)
  if (seen !== undefined) return Promise.resolve(seen as Extract<Evt, { type: T }>)
  return client.next('evt', (frame) => frame.type === type) as Promise<Extract<Evt, { type: T }>>
}

/** Creates a room over HTTP; its primary address. */
export async function createRoom(api: Endpoint, name?: string): Promise<string> {
  const response = await api.http('/rooms', {
    method: 'POST',
    body: JSON.stringify(name === undefined ? {} : { name }),
  })
  if (response.status !== 201) throw new Error(`POST /rooms answered ${response.status}`)
  return ((await response.json()) as { slug: string }).slug
}
