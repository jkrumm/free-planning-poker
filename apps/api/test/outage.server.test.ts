/**
 * The fault test (rule `effect.md`): Postgres stops for 60 s in the middle of a round. The room plays on from memory,
 * every command is acknowledged, what must be stored waits, and it is all there once Postgres is back. During the
 * outage `POST /api/rooms` answers 503 and the health route reports degraded.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { freePort } from '@fpp/test-kit/port'
import { startPostgres, type PostgresCluster } from '@fpp/test-kit/postgres'
import { sql } from 'drizzle-orm'
import type { DbClient } from '../src/db/client.ts'
import { createRoom, eventOf, prepare, query, roomIdOf, startApi, storedSeq, until } from './api.ts'
import { join, ORIGIN, type TestClient, upgradeStatus } from './contract/client.ts'

/** The length of the outage is what this test is about, so it is waited out on the wall clock. */
const OUTAGE_MS = 60_000

let cluster: PostgresCluster
let db: DbClient
let api: Awaited<ReturnType<typeof startApi>>
const open: TestClient[] = []

beforeAll(async () => {
  cluster = await startPostgres()
  db = await prepare(cluster.url)
  api = await startApi(cluster.url, await freePort())
}, 60_000)

afterAll(async () => {
  for (const client of open) client.close()
  await api?.stop()
  await db?.close()
  await cluster?.stop()
})

let ids = 0
const cmd = (client: TestClient, type: string, payload: Record<string, unknown>) => {
  const id = `o${(ids += 1)}`
  client.send({ frame: 'cmd', id, type, payload })
  return client.next('ack', (frame) => frame.id === id)
}
const lastSeq = (client: TestClient) =>
  Math.max(...client.frames.map((frame) => ('seq' in frame ? frame.seq : 0)))
const health = async () => ((await (await api.http('/health')).json()) as { status: string }).status

test(
  'a round survives 60 s without Postgres: acknowledged, revealed, and stored once it is back',
  async () => {
    const slug = await createRoom(api)
    const roomId = await roomIdOf(db, slug)
    const alice = await join(api.ws(slug), { name: 'Alice' })
    const bob = await join(api.ws(slug), { name: 'Bob' })
    open.push(alice.client, bob.client)
    const round = alice.welcome.view.activity.current
    await cmd(alice.client, 'poker.vote', { round, card: '3' })
    await until(async () => (await storedSeq(db, roomId)) >= lastSeq(alice.client))

    await cluster.halt()
    const halted = Date.now()
    await cmd(bob.client, 'poker.vote', { round, card: '8' })
    await cmd(alice.client, 'poker.vote', { round, card: '5' })
    await cmd(alice.client, 'topic.add', { topics: [{ title: 'Later', url: null, ref: null }] })
    await cmd(alice.client, 'poker.reveal', { round })
    await eventOf(bob.client, 'poker.revealed')

    const created = await api.http('/rooms', { method: 'POST', body: '{}' })
    expect([created.status, await created.json()]).toEqual([503, { error: 'unavailable' }])
    expect(await health()).toBe('degraded')
    // An address this process never resolved cannot be looked up now: the upgrade says try again.
    expect(await upgradeStatus(api.port, '/api/ws/900002', ORIGIN)).toBe(503)

    await Bun.sleep(Math.max(0, OUTAGE_MS - (Date.now() - halted)))
    await cluster.resume()

    const latest = lastSeq(alice.client)
    await until(async () => (await storedSeq(db, roomId)) >= latest, 30_000)
    await until(
      async () =>
        (
          await query<{ n: string }>(
            db,
            sql`SELECT count(*) AS n FROM fpp.round WHERE room_id = ${roomId}`,
          )
        )[0]?.n === '1',
      30_000,
    )
    const votes = await query<{ seat: number; label: string }>(
      db,
      sql`SELECT v.seat, v.label FROM fpp.round_vote v JOIN fpp.round r ON r.id = v.round_id
          WHERE r.room_id = ${roomId} ORDER BY v.seat`,
    )
    expect(votes).toEqual([
      { seat: 0, label: '5' },
      { seat: 1, label: '8' },
    ])
    const titles = await query<{ title: string }>(
      db,
      sql`SELECT title FROM fpp.topic WHERE room_id = ${roomId} AND state = 'queued'`,
    )
    expect(titles).toEqual([{ title: 'Later' }])
    expect(await health()).toBe('ok')
    expect((await api.http('/rooms', { method: 'POST', body: '{}' })).status).toBe(201)
  },
  OUTAGE_MS + 90_000,
)
