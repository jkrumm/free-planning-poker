/**
 * A deploy mid-round, as RollHook makes it: process B starts on the same database while A still serves, then A is
 * stopped. With SIGTERM, A drains: its clients get 4002, resume on B with their seats and hidden votes, and A exits 0
 * inside the deadline. With SIGKILL, every vote whose snapshot window had closed before the kill is still there
 * (docs/v9/ARCHITECTURE.md, Server: Ownership and handoff).
 */
import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test'
import { CLOSE_CODES } from '@fpp/room-core/types'
import { freePort } from '@fpp/test-kit/port'
import { startPostgres, type PostgresCluster } from '@fpp/test-kit/postgres'
import type { DbClient } from '../../src/db/client.ts'
import { DRAIN_DEADLINE_MS } from '../../src/ws/edge.ts'
import { createRoom, eventOf, prepare, roomIdOf, spawnApi, storedSeq, until } from '../api.ts'
import { join, type TestClient } from '../contract/client.ts'

/** The longest pause a client may see between losing A and its welcome on B. */
const MAX_GAP_MS = 5_000

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
  const id = `h${(ids += 1)}`
  client.send({ frame: 'cmd', id, type, payload })
  return client.next('ack', (frame) => frame.id === id)
}
const lastSeq = (client: TestClient) =>
  Math.max(...client.frames.map((frame) => ('seq' in frame ? frame.seq : 0)))

const NAMES = ['Ann', 'Ben', 'Cid']
const CARDS = ['1', '5', '13']

/** Three seats on A, each with a hidden vote acknowledged; B already serves the same database. */
async function midRound() {
  const a = await spawn()
  const slug = await createRoom(a)
  const roomId = await roomIdOf(db, slug)
  const seats = []
  for (const name of NAMES) {
    const joined = await join(a.ws(slug), { name })
    open.push(joined.client)
    seats.push(joined)
  }
  const round = seats[0]!.welcome.view.activity.current
  for (const [index, seat] of seats.entries())
    await cmd(seat.client, 'poker.vote', { round, card: CARDS[index]! })
  const b = await spawn()
  expect((await b.http('/health')).status).toBe(200)
  return { a, b, slug, roomId, seats, round }
}

/** Each client resumes on B the moment A lets it go; its view holds its seat and its own vote, and the reveal all. */
async function resumeOnB(scene: Awaited<ReturnType<typeof midRound>>) {
  const { b, slug, seats, round } = scene
  const resumed = await Promise.all(
    seats.map(async (seat, index) => {
      const closed = await seat.client.closed
      const lost = Date.now()
      const back = await join(b.ws(slug), {
        name: NAMES[index]!,
        seatToken: seat.welcome.seatToken,
      })
      open.push(back.client)
      return { ...back, closed, gap: Date.now() - lost, index }
    }),
  )
  for (const back of resumed) {
    expect(back.welcome.seat).toBe(seats[back.index]!.welcome.seat)
    const current = back.welcome.view.activity.rounds.find((candidate) => candidate.id === round)
    const own = current?.votes.find((vote) => vote.seat === back.welcome.seat)
    expect(own?.card?.label).toBe(CARDS[back.index])
  }
  await cmd(resumed[0]!.client, 'poker.reveal', { round })
  for (const back of resumed) {
    const revealed = await eventOf(back.client, 'poker.revealed')
    expect(revealed.payload.votes.map((vote) => vote.card.label).toSorted()).toEqual(
      CARDS.toSorted(),
    )
  }
  return resumed
}

test('on SIGTERM mid-round the clients get 4002, resume on B with their seats and votes, and A exits 0 in time', async () => {
  const scene = await midRound()
  const signalled = Date.now()
  const exited = scene.a.kill('SIGTERM').then((code) => ({ code, after: Date.now() - signalled }))
  const resumed = await resumeOnB(scene)
  for (const back of resumed) {
    expect(back.closed.code).toBe(CLOSE_CODES.draining)
    expect(back.gap).toBeLessThan(MAX_GAP_MS)
  }
  const { code, after } = await exited
  expect(code).toBe(0)
  expect(after).toBeLessThan(DRAIN_DEADLINE_MS)
}, 40_000)

test('on SIGKILL mid-round every vote whose snapshot window closed before the kill is there after the resume', async () => {
  const scene = await midRound()
  // The window closes for a vote when the debounced snapshot holding it is stored.
  const voted = lastSeq(scene.seats[2]!.client)
  await until(async () => (await storedSeq(db, scene.roomId)) >= voted)
  await scene.a.kill('SIGKILL')
  await resumeOnB(scene)
}, 40_000)
