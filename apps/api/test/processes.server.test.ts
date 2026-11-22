/**
 * The API as its own process on a private Postgres: a killed process loses no round (the snapshot written before the
 * kill restores it), and of two processes on one database only the one that claimed a room last may write it
 * (docs/v9/ARCHITECTURE.md, Server: Ownership and handoff; invariant 12).
 */
import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test'
import { CLOSE_CODES } from '@fpp/room-core/types'
import { freePort } from '@fpp/test-kit/port'
import { startPostgres, type PostgresCluster } from '@fpp/test-kit/postgres'
import type { DbClient } from '../src/db/client.ts'
import { createRoom, eventOf, prepare, roomIdOf, spawnApi, storedSeq, until } from './api.ts'
import { join, type TestClient } from './contract/client.ts'

let cluster: PostgresCluster
let db: DbClient
const processes: Awaited<ReturnType<typeof spawnApi>>[] = []
const open: TestClient[] = []

const spawn = async () => {
  const api = await spawnApi(cluster.url, await freePort())
  processes.push(api)
  return api
}

beforeAll(async () => {
  cluster = await startPostgres()
  db = await prepare(cluster.url)
}, 60_000)

afterEach(async () => {
  for (const client of open.splice(0)) client.close()
  for (const api of processes.splice(0)) await api.kill()
})

afterAll(async () => {
  await db?.close()
  await cluster?.stop()
})

let ids = 0
const cmd = (client: TestClient, type: string, payload: Record<string, unknown>) => {
  const id = `p${(ids += 1)}`
  client.send({ frame: 'cmd', id, type, payload })
  return client.next('ack', (frame) => frame.id === id)
}
const lastSeq = (client: TestClient) =>
  Math.max(...client.frames.map((frame) => ('seq' in frame ? frame.seq : 0)))

test('a round with three hidden votes survives SIGKILL: the seats resume and the reveal shows every value', async () => {
  const first = await spawn()
  const slug = await createRoom(first)
  const roomId = await roomIdOf(db, slug)
  const names = ['Ann', 'Ben', 'Cid']
  const cards = ['1', '5', '13']
  const seats = []
  for (const name of names) {
    const joined = await join(first.ws(slug), { name })
    open.push(joined.client)
    seats.push(joined)
  }
  const round = seats[0]!.welcome.view.activity.current
  for (const [index, seat] of seats.entries())
    await cmd(seat.client, 'poker.vote', { round, card: cards[index]! })
  // The kill comes after the snapshot window: the store holds every vote.
  const voted = lastSeq(seats[2]!.client)
  await until(async () => (await storedSeq(db, roomId)) >= voted)
  await first.kill('SIGKILL')

  const second = await spawn()
  const resumed = []
  for (const [index, seat] of seats.entries()) {
    const back = await join(second.ws(slug), {
      name: names[index]!,
      seatToken: seat.welcome.seatToken,
    })
    open.push(back.client)
    expect(back.welcome.seat).toBe(seat.welcome.seat)
    resumed.push(back)
  }
  await cmd(resumed[0]!.client, 'poker.reveal', { round })
  for (const back of resumed) {
    const revealed = await eventOf(back.client, 'poker.revealed')
    expect(revealed.payload.votes.map((vote) => vote.card.label).toSorted()).toEqual(
      cards.toSorted(),
    )
  }
}, 30_000)

test("of two processes on one database, the first's next write after the second's claim is lost and closes its sockets with 4002 within 1 s", async () => {
  const first = await spawn()
  const second = await spawn()
  const slug = await createRoom(first)
  const roomId = await roomIdOf(db, slug)
  const alice = await join(first.ws(slug), { name: 'Alice' })
  open.push(alice.client)
  await until(async () => (await storedSeq(db, roomId)) >= lastSeq(alice.client))
  // The second process claims the room: the epoch moves on.
  const bob = await join(second.ws(slug), { name: 'Bob' })
  open.push(bob.client)

  const round = alice.welcome.view.activity.current
  await cmd(alice.client, 'poker.vote', { round, card: '3' })
  const acked = Date.now()
  const closed = await alice.client.closed
  expect(closed.code).toBe(CLOSE_CODES.draining)
  expect(Date.now() - acked).toBeLessThan(1_000)
}, 30_000)
