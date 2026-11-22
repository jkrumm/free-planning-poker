/**
 * The API on Postgres in this process: what reaches the database when a room plays, what a cold room starts from, and
 * the routes for rooms, addresses and the lock (docs/v9/ARCHITECTURE.md, Server, Data model, HTTP API).
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { ACCESS_CODE_ALPHABET, CLOSE_CODES } from '@fpp/room-core/types'
import { freePort } from '@fpp/test-kit/port'
import { startPostgres, type PostgresCluster } from '@fpp/test-kit/postgres'
import { sql } from 'drizzle-orm'
import type { DbClient } from '../src/db/client.ts'
import { createRoom, eventOf, prepare, query, roomIdOf, startApi, storedSeq, until } from './api.ts'
import { hello, join, TestClient } from './contract/client.ts'

const DAY = 24 * 60 * 60 * 1000

let cluster: PostgresCluster
let db: DbClient
let api: Awaited<ReturnType<typeof startApi>>
/** Added to the wall clock: lets a test move past a hold without waiting for it. */
let offset = 0
const open: TestClient[] = []

const track = <T extends { client: TestClient }>(joined: T) => {
  open.push(joined.client)
  return joined
}

beforeAll(async () => {
  cluster = await startPostgres()
  db = await prepare(cluster.url)
  api = await startApi(cluster.url, await freePort(), { now: () => Date.now() + offset })
}, 60_000)

afterEach(() => {
  for (const client of open.splice(0)) client.close()
})

afterAll(async () => {
  await api?.stop()
  await db?.close()
  await cluster?.stop()
})

let ids = 0
const cmd = (client: TestClient, type: string, payload: Record<string, unknown>) => {
  const id = `c${(ids += 1)}`
  client.send({ frame: 'cmd', id, type, payload })
  return client.next('ack', (frame) => frame.id === id)
}
const event = eventOf
const count = async (statement: ReturnType<typeof sql>) =>
  Number((await query<{ n: string }>(db, statement))[0]?.n ?? 0)
const auth = (token: string) => ({ authorization: `Bearer ${token}` })
const put = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  api.http(path, { method: 'PUT', body: JSON.stringify(body), headers })

describe('a room in play', () => {
  test('a reveal stores one round row and one vote row per voter, by seat index', async () => {
    const slug = await createRoom(api)
    const alice = track(await join(api.ws(slug), { name: 'Alice' }))
    const bob = track(await join(api.ws(slug), { name: 'Bob' }))
    const round = alice.welcome.view.activity.current
    await cmd(alice.client, 'poker.vote', { round, card: '3' })
    await cmd(bob.client, 'poker.vote', { round, card: '5' })
    await cmd(alice.client, 'poker.reveal', { round })
    const roomId = await roomIdOf(db, slug)
    await until(
      async () =>
        (await count(sql`SELECT count(*) AS n FROM fpp.round WHERE room_id = ${roomId}`)) > 0,
    )
    expect(await count(sql`SELECT count(*) AS n FROM fpp.round WHERE room_id = ${roomId}`)).toBe(1)
    const votes = await query<{ seat: number; label: string; value: number }>(
      db,
      sql`SELECT v.seat, v.label, v.value FROM fpp.round_vote v JOIN fpp.round r ON r.id = v.round_id
          WHERE r.room_id = ${roomId} ORDER BY v.seat`,
    )
    expect(votes).toEqual([
      { seat: 0, label: '3', value: 3 },
      { seat: 1, label: '5', value: 5 },
    ])
  })

  test('a queue of three topics and a decided value survive the deletion of the snapshot row', async () => {
    const slug = await createRoom(api)
    const roomId = await roomIdOf(db, slug)
    const alice = track(await join(api.ws(slug), { name: 'Alice' }))
    const round = alice.welcome.view.activity.current
    await cmd(alice.client, 'topic.add', {
      topics: ['First', 'Second', 'Third'].map((title) => ({ title, url: null, ref: null })),
    })
    await cmd(alice.client, 'poker.vote', { round, card: '8' })
    await cmd(alice.client, 'poker.reveal', { round })
    await event(alice.client, 'topic.decided')
    await until(
      async () =>
        (await count(
          sql`SELECT count(*) AS n FROM fpp.topic WHERE room_id = ${roomId} AND final_value = 8`,
        )) === 1,
    )
    // The room is given up once nobody is in it; its snapshot row is then deleted, as the expiry would.
    alice.client.close()
    await until(async () => (await storedSeq(db, roomId)) >= 0)
    const restarted = await startApi(cluster.url, await freePort())
    try {
      await db.db.execute(sql`DELETE FROM fpp.room_snapshot WHERE room_id = ${roomId}`)
      const back = track(await join(restarted.ws(slug), { name: 'Alice' }))
      const topics = back.welcome.view.topics
      expect(topics.map((topic) => [topic.title, topic.state])).toEqual([
        [null, 'active'],
        ['First', 'queued'],
        ['Second', 'queued'],
        ['Third', 'queued'],
      ])
      expect(topics[0]?.final).toMatchObject({ label: '8', value: 8, decidedBy: 'agreed', round })
      const current = back.welcome.view.activity.rounds.find(
        (entry) => entry.id === back.welcome.view.activity.current,
      )
      expect(current).toMatchObject({ no: 2, attempt: 2, state: 'voting' })
    } finally {
      await restarted.stop()
    }
  })

  test('a device that votes twice on one day leaves one visitor_day row, and not its id', async () => {
    const slug = await createRoom(api)
    const client = track({ client: await TestClient.open(api.ws(slug)) }).client
    const device = 'device-0123456789abcdef'
    client.send({ ...hello({ name: 'Dora' }), device })
    const welcome = await client.next('welcome')
    const round = welcome.view.activity.current
    const before = await count(sql`SELECT count(*) AS n FROM fpp.visitor_day`)
    await cmd(client, 'poker.vote', { round, card: '3' })
    await cmd(client, 'poker.vote', { round, card: '5' })
    await until(async () => (await count(sql`SELECT count(*) AS n FROM fpp.visitor_day`)) > before)
    const rows = await query<{ visitor: Uint8Array }>(db, sql`SELECT visitor FROM fpp.visitor_day`)
    expect(rows).toHaveLength(before + 1)
    for (const row of rows) {
      expect(row.visitor).toHaveLength(16)
      expect(Buffer.from(row.visitor).toString('utf8')).not.toContain(device.slice(0, 8))
    }
  })
})

describe('the lock', () => {
  test('a locked room shows only its state, access mode and age; the code seats, sign-out voids the seats', async () => {
    const slug = await createRoom(api)
    const alice = track(await join(api.ws(slug), { name: 'Alice' }))
    const bob = track(await join(api.ws(slug), { name: 'Bob' }))
    const locked = await put(
      `/rooms/${slug}/access`,
      { access: 'locked', code: '  café au lait ' },
      auth(alice.welcome.seatToken),
    )
    expect(locked.status).toBe(200)
    expect(await locked.json()).toEqual({ access: 'locked', code: 'café au lait' })
    expect(await event(bob.client, 'room.accessChanged')).toMatchObject({
      payload: { access: 'locked', code: 'café au lait' },
    })

    const lookup = await api.http(`/rooms/${slug}`)
    const body = (await lookup.json()) as Record<string, unknown>
    expect(Object.keys(body).toSorted()).toEqual(['access', 'createdAt', 'state'])
    expect(body).toMatchObject({ state: 'held', access: 'locked' })

    const stranger = await TestClient.open(api.ws(slug))
    open.push(stranger)
    stranger.send(hello({ name: 'Eve' }))
    expect((await stranger.closed).code).toBe(CLOSE_CODES.access_required)
    const carol = track(await join(api.ws(slug), { name: 'Carol', code: 'CAFÉ AU LAIT' }))
    expect(String(carol.welcome.view.room.code)).toBe('café au lait')

    const replaced = await put(
      `/rooms/${slug}/access`,
      { access: 'locked', code: 'new-word', signOut: true },
      auth(alice.welcome.seatToken),
    )
    expect(replaced.status).toBe(200)
    expect((await bob.client.closed).code).toBe(CLOSE_CODES.expired)
    const again = await TestClient.open(api.ws(slug))
    open.push(again)
    again.send(hello({ name: 'Bob', seatToken: bob.welcome.seatToken }))
    expect((await again.closed).code).toBe(CLOSE_CODES.expired)
  })

  test('a generated code has six characters of the alphabet and opens the room in hello', async () => {
    const slug = await createRoom(api)
    const alice = track(await join(api.ws(slug), { name: 'Alice' }))
    const response = await put(
      `/rooms/${slug}/access`,
      { access: 'locked' },
      auth(alice.welcome.seatToken),
    )
    const { code } = (await response.json()) as { code: string }
    expect(code).toHaveLength(6)
    for (const char of code) expect(ACCESS_CODE_ALPHABET).toContain(char)
    const bob = track(await join(api.ws(slug), { name: 'Bob', code }))
    expect(bob.welcome.view.room).toMatchObject({ access: 'locked', code })
  })

  test('changing the lock or the name needs a player seated in that room', async () => {
    const slug = await createRoom(api)
    const other = await createRoom(api)
    const alice = track(await join(api.ws(slug), { name: 'Alice' }))
    const sam = track(await join(api.ws(slug), { name: 'Sam' }))
    await cmd(sam.client, 'seat.setRole', { seat: sam.welcome.seat, role: 'spectator' })
    const outsider = track(await join(api.ws(other), { name: 'Olga' }))
    const cases: [Record<string, string>, string][] = [
      [{}, 'not_seated'],
      [{ authorization: 'Basic abc' }, 'not_seated'],
      [auth(outsider.welcome.seatToken), 'not_seated'],
      [auth(sam.welcome.seatToken), 'not_player'],
    ]
    for (const [headers, error] of cases) {
      const access = await put(`/rooms/${slug}/access`, { access: 'locked' }, headers)
      expect([access.status, await access.json()]).toEqual([403, { error }])
      const name = await put(`/rooms/${slug}/name`, { name: 'taken-by-nobody' }, headers)
      expect([name.status, await name.json()]).toEqual([403, { error }])
    }
    const ok = await put(`/rooms/${slug}/access`, { access: 'open' }, auth(alice.welcome.seatToken))
    expect(ok.status).toBe(200)
  })
})

describe('numbers and names', () => {
  test('an unknown address is free, an open room shows its name and seat counts', async () => {
    expect(await (await api.http('/rooms/900001')).json()).toEqual({ state: 'free' })
    expect((await api.http('/rooms/Not%20A%20Slug')).status).toBe(400)
    const slug = await createRoom(api)
    expect(slug).toMatch(/^\d{6}$/)
    track(await join(api.ws(slug), { name: 'Alice' }))
    const body = (await (await api.http(`/rooms/${slug}`)).json()) as Record<string, unknown>
    expect(body).toMatchObject({
      state: 'held',
      access: 'open',
      name: slug,
      seats: { players: 1, spectators: 0 },
    })
    expect(JSON.stringify(body)).not.toContain('Alice')
  })

  test('a held name is a 409, a broken one a 400, and a released one makes a new room', async () => {
    const first = await api.http('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name: 'team-alpha' }),
    })
    expect(first.status).toBe(201)
    expect(await first.json()).toMatchObject({ slug: 'team-alpha', name: 'team-alpha' })
    for (const name of ['Team Alpha', '123456', 'ab', 'a'.repeat(31)]) {
      const broken = await api.http('/rooms', { method: 'POST', body: JSON.stringify({ name }) })
      expect([broken.status, await broken.json()]).toEqual([400, { error: 'invalid_name' }])
    }
    const second = await api.http('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name: 'team-alpha' }),
    })
    expect([second.status, await second.json()]).toEqual([409, { error: 'name_held' }])

    const firstRoom = await roomIdOf(db, 'team-alpha')
    const alice = track(await join(api.ws('team-alpha'), { name: 'Alice' }))
    const round = alice.welcome.view.activity.current
    await cmd(alice.client, 'poker.vote', { round, card: '2' })
    await cmd(alice.client, 'poker.reveal', { round })
    const rounds = sql`SELECT count(*) AS n FROM fpp.round WHERE room_id = ${firstRoom}`
    await until(async () => (await count(rounds)) === 1)
    alice.client.close()

    offset += 7 * 30 * DAY
    try {
      const reused = await api.http('/rooms', {
        method: 'POST',
        body: JSON.stringify({ name: 'team-alpha' }),
      })
      expect(reused.status).toBe(201)
      expect(await roomIdOf(db, 'team-alpha')).not.toBe(firstRoom)
      expect(await count(rounds)).toBe(1)
    } finally {
      offset -= 7 * 30 * DAY
    }
  })

  test('a renamed room answers under its old name for 30 days, with its new name as primary', async () => {
    const created = await api.http('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name: 'rename-old' }),
    })
    const { number } = (await created.json()) as { number: string }
    const alice = track(await join(api.ws('rename-old'), { name: 'Alice' }))
    const renamed = await put(
      '/rooms/rename-old/name',
      { name: 'rename-new' },
      auth(alice.welcome.seatToken),
    )
    expect([renamed.status, await renamed.json()]).toEqual([200, { slug: 'rename-new' }])
    expect(await event(alice.client, 'room.slugChanged')).toMatchObject({
      payload: { slug: 'rename-new' },
    })
    alice.client.close()

    offset += 29 * DAY
    try {
      expect(await (await api.http('/rooms/rename-old')).json()).toMatchObject({
        state: 'held',
        primary: 'rename-new',
      })
      expect(await (await api.http(`/rooms/${number}`)).json()).toMatchObject({
        state: 'held',
        primary: 'rename-new',
      })
      offset += 2 * DAY
      expect(await (await api.http('/rooms/rename-old')).json()).toMatchObject({
        state: 'released',
        primary: 'rename-new',
      })
      expect(await (await api.http('/rooms/rename-new')).json()).toMatchObject({ state: 'held' })
    } finally {
      offset -= 31 * DAY
    }
  })
})
