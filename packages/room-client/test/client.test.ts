/**
 * The client's connection machine on a fake clock and sockets driven by hand (docs/plan.yaml, v9-room-client,
 * acceptance 2): when it says reconnecting, what each close code ends in, and how a vote waits and returns.
 */
import { describe, expect, test } from 'bun:test'
import { createRoomClient, type ClientPorts, type RoomLookup } from '../src/index.ts'
import {
  fakeClock,
  fakeSockets,
  memoryStorage,
  portsOf,
  signalsOf,
  SLUG,
  table,
  welcomeFrame,
  type MemoryStorage,
} from './support.ts'

type Start = {
  readonly storage?: MemoryStorage
  readonly code?: string
  readonly lookup?: ClientPorts['lookup']
  readonly room?: ReturnType<typeof table>
}

function start(options: Start = {}) {
  const clock = fakeClock()
  const sockets = fakeSockets()
  const storage = options.storage ?? memoryStorage()
  const signal = signalsOf()
  const room = options.room ?? table()
  const client = createRoomClient({
    slug: SLUG,
    profile: { name: 'Ada', avatar: 'ada' },
    origin: 'http://fpp.test',
    ports: portsOf(sockets, clock, storage, {
      signals: signal.signals,
      ...(options.lookup === undefined ? {} : { lookup: options.lookup }),
    }),
    ...(options.code === undefined ? {} : { code: options.code }),
  })
  const statuses: string[] = []
  client.state.subscribe(() => {
    const status = client.state.getSnapshot().status
    if (statuses.at(-1) !== status) statuses.push(status)
  })
  const status = () => client.state.getSnapshot().status
  /** The socket opens and the server welcomes the seat. */
  const join = (seq = 1, token = 'token-1') => {
    sockets.last.open()
    sockets.last.serve(welcomeFrame(room.view(0), seq, token))
  }
  return { clock, sockets, storage, signal, room, client, statuses, status, join }
}

const flush = () => Promise.resolve().then(() => Promise.resolve())

describe('connecting', () => {
  test("hello carries the protocol version, the profile, the device id and the link's code", () => {
    const t = start({ code: 'k7m2qx' })
    expect(t.sockets.last.url).toBe(`ws://fpp.test/api/ws/${SLUG}`)
    t.sockets.last.open()
    const hello = t.sockets.last.hello!
    expect(hello).toMatchObject({
      frame: 'hello',
      v: 1,
      name: 'Ada',
      avatar: 'ada',
      code: 'k7m2qx',
    })
    expect(typeof hello['device']).toBe('string')
    expect(hello).not.toHaveProperty('seatToken')
    expect(t.status()).toBe('connecting')
  })

  test('a welcome makes it live and its token, room and view are kept', () => {
    const t = start()
    t.join(5)
    const state = t.client.state.getSnapshot()
    expect(state.status).toBe('live')
    expect(state.seq).toBe(5)
    expect(state.view?.self).toBe(t.room.view(0).self)
    expect(JSON.parse(t.storage.items.get(`fpp:v9:seat:${SLUG}`)!)).toEqual({
      v: 1,
      token: 'token-1',
    })
    const recent = JSON.parse(t.storage.items.get('fpp:v9:recent')!) as {
      rooms: { slug: string; name: string }[]
    }
    expect(recent.rooms[0]).toMatchObject({ slug: SLUG, name: 'Team Alpha', pinned: false })
  })

  test('a stored token resumes the seat on the next visit', () => {
    const storage = memoryStorage({
      [`fpp:v9:seat:${SLUG}`]: JSON.stringify({ v: 1, token: 'old-token' }),
    })
    const t = start({ storage })
    t.sockets.last.open()
    expect(t.sockets.last.hello).toMatchObject({ seatToken: 'old-token' })
    expect(t.sockets.last.hello).not.toHaveProperty('lastSeq')
  })

  test('an address that is neither a number nor a name ends in gone without a socket', () => {
    const sockets = fakeSockets()
    const client = createRoomClient({
      slug: 'No Way!',
      profile: { name: 'Ada', avatar: 'ada' },
      origin: 'http://fpp.test',
      ports: portsOf(sockets, fakeClock(), memoryStorage()),
    })
    expect(client.state.getSnapshot().status).toBe('gone')
    expect(sockets.sockets).toHaveLength(0)
  })
})

describe('losing the connection', () => {
  test('a gap of 2 s never reports reconnecting', () => {
    const t = start()
    t.join()
    t.sockets.last.end(1006)
    t.clock.advance(2000)
    expect(t.status()).toBe('live')
    t.join(1)
    expect(t.statuses).toEqual(['live'])
  })

  test('a gap of 4 s does, from the third second on', () => {
    const t = start()
    t.join()
    t.sockets.last.end(1006)
    t.clock.advance(2999)
    expect(t.status()).toBe('live')
    t.clock.advance(1)
    expect(t.status()).toBe('reconnecting')
    t.clock.advance(1000)
    t.join(1)
    expect(t.statuses).toEqual(['live', 'reconnecting', 'live'])
  })

  test('the view stays while the connection is lost', () => {
    const t = start()
    t.join()
    t.sockets.last.end(1006)
    t.clock.advance(4000)
    expect(t.client.state.getSnapshot().view).not.toBeNull()
  })

  test('the wait grows by full jitter up to 30 s and a stable minute starts it over', () => {
    const clock = fakeClock()
    const sockets = fakeSockets()
    const client = createRoomClient({
      slug: SLUG,
      profile: { name: 'Ada', avatar: 'ada' },
      origin: 'http://fpp.test',
      ports: portsOf(sockets, clock, memoryStorage(), { random: () => 0.9999 }),
    })
    const table1 = table()
    const waits: number[] = []
    for (let loss = 0; loss < 8; loss += 1) {
      const before = sockets.sockets.length
      sockets.last.end(1006)
      let waited = 0
      while (sockets.sockets.length === before) {
        clock.advance(100)
        waited += 100
      }
      waits.push(waited)
    }
    // 500 * 2^n, rounded up to the 100 ms of the test's step, capped at 30 s.
    expect(waits.slice(0, 6)).toEqual([500, 1000, 2000, 4000, 8000, 16000])
    expect(waits[6]).toBe(30_000)
    expect(waits[7]).toBe(30_000)
    // A connection that stays 60 s counts the next loss as a first one.
    sockets.last.open()
    sockets.last.serve(welcomeFrame(table1.view(0), 1))
    clock.advance(30_000)
    sockets.last.serve({ frame: 'ping' })
    clock.advance(30_000)
    const before = sockets.sockets.length
    sockets.last.end(1006)
    clock.advance(500)
    expect(sockets.sockets.length).toBe(before + 1)
    expect(client.state.getSnapshot().status).toBe('live')
  })

  test('a gap in seq replaces the connection', () => {
    const t = start()
    t.join(1)
    const sockets = t.sockets.sockets.length
    t.sockets.last.serve({
      frame: 'evt',
      seq: 3,
      type: 'seat.renamed',
      payload: { seat: 0, name: 'x' },
    })
    t.clock.advance(500)
    expect(t.sockets.sockets.length).toBe(sockets + 1)
  })

  test('60 s of silence ends a connection; a ping keeps it', () => {
    const t = start()
    t.join()
    const sockets = t.sockets.sockets.length
    t.clock.advance(40_000)
    t.sockets.last.serve({ frame: 'ping' })
    expect(t.sockets.last.sent.at(-1)).toEqual({ frame: 'pong' })
    t.clock.advance(40_000)
    expect(t.sockets.sockets.length).toBe(sockets)
    t.clock.advance(20_000 + 500)
    expect(t.sockets.sockets.length).toBe(sockets + 1)
  })

  test('a socket that never welcomes is given up after 10 s', () => {
    const t = start()
    t.sockets.last.open()
    t.clock.advance(10_000)
    t.clock.advance(500)
    expect(t.sockets.sockets).toHaveLength(2)
  })

  test('online reconnects at once, and a page that shows after a silence does too', () => {
    const t = start()
    t.join()
    t.signal.goOnline()
    expect(t.sockets.sockets).toHaveLength(2)
    t.join(1)
    t.signal.show()
    expect(t.sockets.sockets).toHaveLength(2)
    t.clock.advance(31_000)
    t.signal.show()
    expect(t.sockets.sockets).toHaveLength(3)
  })

  test('a visible page reconnects at once when it was waiting out a backoff', () => {
    const clock = fakeClock()
    const sockets = fakeSockets()
    const signal = signalsOf()
    createRoomClient({
      slug: SLUG,
      profile: { name: 'Ada', avatar: 'ada' },
      origin: 'http://fpp.test',
      ports: portsOf(sockets, clock, memoryStorage(), {
        signals: signal.signals,
        random: () => 0.9999,
      }),
    })
    for (let loss = 0; loss < 3; loss += 1) {
      sockets.last.end(1006)
      clock.advance(30_000)
    }
    sockets.last.end(1006)
    const before = sockets.sockets.length
    signal.show()
    expect(sockets.sockets.length).toBe(before + 1)
  })
})

describe('close codes', () => {
  test('4001 ends in reload-required and nothing reconnects', () => {
    const t = start()
    t.join()
    t.sockets.last.end(4001)
    t.clock.advance(120_000)
    expect(t.status()).toBe('reload-required')
    expect(t.sockets.sockets).toHaveLength(1)
    expect(t.client.state.getSnapshot().closeCode).toBe(4001)
  })

  test('4003 ends in kicked with no reconnect and the token gone', () => {
    const t = start()
    t.join()
    t.sockets.last.end(4003)
    t.clock.advance(120_000)
    expect(t.status()).toBe('kicked')
    expect(t.sockets.sockets).toHaveLength(1)
    expect(t.storage.items.has(`fpp:v9:seat:${SLUG}`)).toBe(false)
  })

  test('kicked and gone can ask for a new seat', () => {
    const t = start()
    t.join()
    t.sockets.last.end(4003)
    t.client.rejoin()
    expect(t.sockets.sockets).toHaveLength(2)
    expect(t.sockets.last.hello).toBeUndefined()
    t.sockets.last.open()
    expect(t.sockets.last.hello).not.toHaveProperty('seatToken')
    t.sockets.last.serve(welcomeFrame(t.room.view(1), 2, 'token-2'))
    expect(t.status()).toBe('live')
  })

  test('4004 forgets the token and joins as a new seat at once', () => {
    const t = start()
    t.join()
    t.sockets.last.end(4004)
    expect(t.sockets.sockets).toHaveLength(2)
    expect(t.status()).toBe('connecting')
    t.sockets.last.open()
    expect(t.sockets.last.hello).not.toHaveProperty('seatToken')
    t.sockets.last.serve(welcomeFrame(t.room.view(1), 2, 'token-2'))
    expect(t.status()).toBe('live')
    expect(JSON.parse(t.storage.items.get(`fpp:v9:seat:${SLUG}`)!)).toEqual({
      v: 1,
      token: 'token-2',
    })
  })

  test('4004 for a first hello means the room is not there', () => {
    const t = start()
    t.sockets.last.open()
    t.sockets.last.end(4004)
    expect(t.status()).toBe('gone')
    expect(t.sockets.sockets).toHaveLength(1)
  })

  test('4002 shows draining and reconnects within 2 s', () => {
    const t = start()
    t.join()
    t.sockets.last.end(4002)
    expect(t.status()).toBe('draining')
    t.clock.advance(2000)
    expect(t.sockets.sockets).toHaveLength(2)
    t.join(1)
    expect(t.statuses).toEqual(['live', 'draining', 'live'])
  })

  test('4008 backs off and reconnects', () => {
    const t = start()
    t.join()
    t.sockets.last.end(4008)
    t.clock.advance(500)
    expect(t.sockets.sockets).toHaveLength(2)
  })

  test('1000, which the server sends after seat.leave, ends in gone', () => {
    const t = start()
    t.join()
    t.sockets.last.end(1000)
    expect(t.status()).toBe('gone')
    expect(t.storage.items.has(`fpp:v9:seat:${SLUG}`)).toBe(false)
  })

  test('4005 ends in locked until a code comes, then in live, and the code is kept', () => {
    const locked = table(['Ada'], { code: 'K7M2QX' })
    const t = start({ room: locked })
    t.sockets.last.open()
    t.sockets.last.end(4005)
    t.clock.advance(120_000)
    expect(t.status()).toBe('locked')
    expect(t.client.state.getSnapshot().codeRefused).toBe(false)
    expect(t.sockets.sockets).toHaveLength(1)
    t.client.submitCode('k7m2qx')
    expect(t.status()).toBe('connecting')
    t.sockets.last.open()
    expect(t.sockets.last.hello).toMatchObject({ code: 'k7m2qx' })
    t.sockets.last.serve(welcomeFrame(locked.view(0), 1))
    expect(t.status()).toBe('live')
    const recent = JSON.parse(t.storage.items.get('fpp:v9:recent')!) as {
      rooms: { code: string }[]
    }
    expect(recent.rooms[0]!.code).toBe('K7M2QX')
  })

  test('a wrong code reports it was refused, and a stale stored code is dropped', () => {
    const storage = memoryStorage({
      'fpp:v9:recent': JSON.stringify({
        v: 1,
        rooms: [
          {
            slug: SLUG,
            name: 'Team Alpha',
            createdAt: null,
            code: 'old',
            pinned: false,
            visitedAt: 1_700_000_000_000,
          },
        ],
      }),
    })
    const t = start({ storage })
    t.sockets.last.open()
    expect(t.sockets.last.hello).toMatchObject({ code: 'old' })
    t.sockets.last.end(4005)
    expect(t.status()).toBe('locked')
    expect(t.client.state.getSnapshot().codeRefused).toBe(true)
    const recent = JSON.parse(storage.items.get('fpp:v9:recent')!) as {
      rooms: { code: string | null }[]
    }
    expect(recent.rooms[0]!.code).toBeNull()
  })

  test('a visit without the fragment sends the code the room is remembered with', () => {
    const storage = memoryStorage({
      'fpp:v9:recent': JSON.stringify({
        v: 1,
        rooms: [
          {
            slug: SLUG,
            name: 'Team Alpha',
            createdAt: null,
            code: 'K7M2QX',
            pinned: false,
            visitedAt: 1_700_000_000_000,
          },
        ],
      }),
    })
    const t = start({ storage })
    t.sockets.last.open()
    expect(t.sockets.last.hello).toMatchObject({ code: 'K7M2QX' })
  })
})

const found = (createdAt: number): RoomLookup => ({
  kind: 'room',
  createdAt,
  name: 'Team Alpha',
  access: 'open',
})
const remembered = (createdAt: number) =>
  memoryStorage({
    'fpp:v9:recent': JSON.stringify({
      v: 1,
      rooms: [
        {
          slug: SLUG,
          name: 'Team Alpha',
          createdAt,
          code: 'old',
          pinned: true,
          visitedAt: 1_700_000_000_000,
        },
      ],
    }),
  })

describe('the way in', () => {
  test('a room created at another time ends in changed-hands before any socket', async () => {
    const t = start({ storage: remembered(1000), lookup: async () => found(2000) })
    expect(t.status()).toBe('connecting')
    await flush()
    expect(t.status()).toBe('changed-hands')
    expect(t.client.state.getSnapshot().changedHands).toEqual({ remembered: 1000, found: 2000 })
    expect(t.sockets.sockets).toHaveLength(0)
    t.clock.advance(60_000)
    t.signal.goOnline()
    expect(t.sockets.sockets).toHaveLength(0)
  })

  test('accepting the new room replaces the entry, drops its code and joins', async () => {
    const t = start({ storage: remembered(1000), lookup: async () => found(2000) })
    await flush()
    t.client.acceptNewRoom()
    expect(t.sockets.sockets).toHaveLength(1)
    t.sockets.last.open()
    expect(t.sockets.last.hello).not.toHaveProperty('code')
    t.sockets.last.serve(welcomeFrame(t.room.view(0), 1))
    const recent = JSON.parse(t.storage.items.get('fpp:v9:recent')!) as {
      rooms: { createdAt: number; pinned: boolean }[]
    }
    expect(recent.rooms).toHaveLength(1)
    expect(recent.rooms[0]).toMatchObject({ createdAt: 2000, pinned: false })
  })

  test('the same creation time joins, and the time is kept', async () => {
    const t = start({ lookup: async () => found(2000) })
    await flush()
    expect(t.sockets.sockets).toHaveLength(1)
    t.join()
    const recent = JSON.parse(t.storage.items.get('fpp:v9:recent')!) as {
      rooms: { createdAt: number }[]
    }
    expect(recent.rooms[0]!.createdAt).toBe(2000)
  })

  test('a free address ends in gone with no socket', async () => {
    const t = start({ lookup: async () => ({ kind: 'free' }) })
    await flush()
    expect(t.status()).toBe('gone')
    expect(t.sockets.sockets).toHaveLength(0)
  })

  test('a lookup that fails does not keep anyone out', async () => {
    const t = start({ lookup: () => Promise.reject(new Error('offline')) })
    await flush()
    expect(t.sockets.sockets).toHaveLength(1)
  })
})

const vote = (round: string, card = '5') => ({
  type: 'poker.vote' as const,
  payload: { round, card },
})

describe('commands', () => {
  test("a vote is pending until acknowledged, then it is the seat's own card", async () => {
    const t = start()
    t.join()
    const round = t.room.round().id
    const result = t.client.send(vote(round))
    const sent = t.sockets.last.commands()
    expect(sent).toHaveLength(1)
    expect(t.client.state.getSnapshot().pendingVote).toEqual({ round, card: '5' })
    expect(t.client.state.getSnapshot().pending).toHaveLength(1)
    t.sockets.last.serve({ frame: 'ack', id: sent[0]!['id'] })
    expect(await result).toEqual({ ok: true })
    const acked = t.client.state.getSnapshot()
    expect(acked.pendingVote).toBeNull()
    expect(acked.ownVote).toEqual({ round, card: '5', pending: false })
    // The event of the vote has not come yet: the view keeps the server's order and holds no vote.
    expect(acked.view!.activity.rounds[0]!.votes).toEqual([])
    const event = t.room.run(0, vote(round))[0]!
    t.sockets.last.serve({ frame: 'evt', seq: 2, ...event })
    expect(t.client.state.getSnapshot().view!.activity.rounds[0]!.votes).toEqual([
      { seat: t.room.indexes[0]!, card: expect.objectContaining({ label: '5' }) },
    ])
  })

  test('a vote shows as the own card from the moment it is sent, pending, and stays when its event comes first', async () => {
    const t = start()
    t.join()
    const round = t.room.round().id
    const result = t.client.send(vote(round, '8'))
    expect(t.client.state.getSnapshot().ownVote).toEqual({ round, card: '8', pending: true })
    const event = t.room.run(0, vote(round, '8'))[0]!
    t.sockets.last.serve({ frame: 'evt', seq: 2, ...event })
    expect(t.client.state.getSnapshot().view!.activity.rounds[0]!.votes[0]!.card).toBeNull()
    t.sockets.last.serve({ frame: 'ack', id: t.sockets.last.commands()[0]!['id'] })
    await result
    const state = t.client.state.getSnapshot()
    expect(state.ownVote).toEqual({ round, card: '8', pending: false })
    expect(state.view!.activity.rounds[0]!.votes[0]!.card).toMatchObject({ label: '8' })
  })

  test('a nack comes back as the result with its reason', async () => {
    const t = start()
    t.join()
    const result = t.client.send({ type: 'poker.reveal', payload: { round: t.room.round().id } })
    t.sockets.last.serve({
      frame: 'nack',
      id: t.sockets.last.commands()[0]!['id'],
      reason: 'no_votes',
    })
    expect(await result).toEqual({ ok: false, reason: 'no_votes' })
    expect(t.client.state.getSnapshot().pending).toHaveLength(0)
  })

  test('an unacknowledged vote goes again with the same id after the resume', () => {
    const t = start()
    t.join()
    void t.client.send(vote(t.room.round().id))
    const id = t.sockets.last.commands()[0]!['id']
    t.sockets.last.end(1006)
    t.clock.advance(500)
    t.join(1)
    expect(t.sockets.last.commands()).toEqual([expect.objectContaining({ id, type: 'poker.vote' })])
    expect(t.client.state.getSnapshot().pendingVote).not.toBeNull()
  })

  test('a vote chosen while the connection is lost waits for it', () => {
    const t = start()
    t.join()
    t.sockets.last.end(1006)
    void t.client.send(vote(t.room.round().id, '8'))
    expect(t.client.state.getSnapshot().pendingVote?.card).toBe('8')
    t.clock.advance(500)
    t.join(1)
    expect(t.sockets.last.commands()).toHaveLength(1)
  })

  test('another command is refused while offline and when its connection ended before the answer', async () => {
    const t = start()
    t.join()
    const round = t.room.round().id
    const waiting = t.client.send({ type: 'poker.reveal', payload: { round } })
    t.sockets.last.end(1006)
    expect(await t.client.send({ type: 'poker.reveal', payload: { round } })).toEqual({
      ok: false,
      reason: 'offline',
    })
    t.clock.advance(500)
    t.join(1)
    expect(await waiting).toEqual({ ok: false, reason: 'lost' })
    expect(t.sockets.last.commands()).toHaveLength(0)
  })

  test('before the first welcome nothing is sent', async () => {
    const t = start()
    expect(await t.client.send(vote(t.room.round().id))).toEqual({ ok: false, reason: 'offline' })
  })

  test('the own vote is asserted again when the welcome view of the same round lacks it', async () => {
    const t = start()
    t.join()
    const round = t.room.round().id
    const result = t.client.send(vote(round, '3'))
    t.sockets.last.serve({ frame: 'ack', id: t.sockets.last.commands()[0]!['id'] })
    await result
    // The server came back from a snapshot older than the acknowledgement: its welcome holds no vote.
    t.sockets.last.end(1006)
    t.clock.advance(500)
    t.join(1)
    const again = t.sockets.last.commands()
    expect(again).toHaveLength(1)
    expect(again[0]).toMatchObject({ type: 'poker.vote', payload: { round, card: '3' } })
  })

  test('the own vote is not asserted when the welcome holds it', async () => {
    const t = start()
    t.join()
    const round = t.room.round().id
    const result = t.client.send(vote(round, '3'))
    t.sockets.last.serve({ frame: 'ack', id: t.sockets.last.commands()[0]!['id'] })
    await result
    t.room.run(0, vote(round, '3'))
    t.sockets.last.end(1006)
    t.clock.advance(500)
    t.sockets.last.open()
    t.sockets.last.serve(welcomeFrame(t.room.view(0), 2))
    expect(t.sockets.last.commands()).toHaveLength(0)
  })

  test('a cleared vote is not asserted again', async () => {
    const t = start()
    t.join()
    const round = t.room.round().id
    const first = t.client.send(vote(round, '3'))
    t.sockets.last.serve({ frame: 'ack', id: t.sockets.last.commands()[0]!['id'] })
    await first
    const second = t.client.send({ type: 'poker.clearVote', payload: { round } })
    t.sockets.last.serve({ frame: 'ack', id: t.sockets.last.commands()[1]!['id'] })
    await second
    t.sockets.last.end(1006)
    t.clock.advance(500)
    t.join(1)
    expect(t.sockets.last.commands()).toHaveLength(0)
  })

  test('a new seat owns nothing of the old one: what it waited for is lost', async () => {
    const t = start()
    t.join()
    const waiting = t.client.send(vote(t.room.round().id))
    t.sockets.last.end(4004)
    expect(await waiting).toEqual({ ok: false, reason: 'lost' })
  })
})

describe('events', () => {
  test('an event moves the view on, a repeat is ignored', () => {
    const t = start()
    t.join(1)
    const events = t.room.run(1, { type: 'seat.rename', payload: { name: 'Bob' } })
    const event = events[0]!
    t.sockets.last.serve({ frame: 'evt', seq: 2, ...event })
    t.sockets.last.serve({ frame: 'evt', seq: 2, ...event })
    const state = t.client.state.getSnapshot()
    expect(state.seq).toBe(2)
    expect(state.view!.seats.find((seat) => seat.index === t.room.indexes[1])!.name).toBe('Bob')
  })

  test('a room that is renamed or locked is remembered under its new state', () => {
    const t = start()
    t.join(1)
    const events = t.room.run(1, { type: 'room.setTitle', payload: { name: 'Sprint 12' } })
    t.sockets.last.serve({ frame: 'evt', seq: 2, ...events[0]! })
    const recent = JSON.parse(t.storage.items.get('fpp:v9:recent')!) as {
      rooms: { name: string }[]
    }
    expect(recent.rooms[0]!.name).toBe('Sprint 12')
  })
})

describe('the end', () => {
  test('dispose closes the socket and stops everything', () => {
    const t = start()
    t.join()
    const socket = t.sockets.last
    t.client.dispose()
    expect(socket.closedWith).toBe(1000)
    t.clock.advance(300_000)
    t.signal.goOnline()
    expect(t.sockets.sockets).toHaveLength(1)
  })
})
