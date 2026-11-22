/**
 * The room runtime's rules one by one (docs/plan.yaml, v9-room-runtime): the handshake, seat tokens, the lock and its
 * limits, reclaim by name, resume, presence, the rate limits, the heartbeat, the device id, snapshots. Each test runs
 * the runtime on the in-memory adapters of `@fpp/room-core/sim` and a transport that records every frame.
 */
import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { DEFAULT_SETTINGS } from '../src/room.ts'
import { project } from '../src/project.ts'
import type { Command, ServerFrame, View } from '../src/protocol/types.ts'
import { RUNTIME_LIMITS } from '../src/runtime/limits.ts'
import type { Transport } from '../src/runtime/ports.ts'
import { createRoomRuntime, type RuntimeOptions } from '../src/runtime/runtime.ts'
import {
  memoryHistory,
  memoryIds,
  memorySecrets,
  memoryStore,
  random,
  scheduler,
  sha256,
  telemetryRecorder,
  type MemoryStore,
} from '../src/sim/sim.entry.ts'
import { parseAccessCode, parseSlug, type SeatIndex } from '../src/values.ts'

const ROOM = '1'

function harness(
  options: { code?: string; store?: MemoryStore; runtime?: Partial<RuntimeOptions> } = {},
) {
  const clock = scheduler()
  const rng = random(7)
  const frames = new Map<string, ServerFrame[]>()
  const closes = new Map<string, number>()
  const topics = new Map<string, Set<string>>()
  const push = (conn: string, frame: ServerFrame) =>
    frames.set(conn, [
      ...(frames.get(conn) ?? []),
      JSON.parse(JSON.stringify(frame)) as ServerFrame,
    ])
  const transport: Transport = {
    send: push,
    subscribe: (conn, room) => topics.set(room, new Set([...(topics.get(room) ?? []), conn])),
    unsubscribe: (conn, room) => topics.get(room)?.delete(conn),
    publish: (room, frame) => {
      for (const conn of topics.get(room) ?? []) push(conn, frame)
    },
    close: (conn, code) => {
      closes.set(conn, code)
      for (const topic of topics.values()) topic.delete(conn)
    },
  }
  const store = options.store ?? memoryStore()
  if (!store.rows.has(ROOM))
    store.rows.set(ROOM, {
      slug: parseSlug('482913')!,
      name: 'Team Alpha',
      access: options.code === undefined ? 'open' : 'locked',
      code: options.code === undefined ? null : parseAccessCode(options.code)!,
      settings: DEFAULT_SETTINGS,
      accessEpoch: 0,
    })
  const history = memoryHistory()
  const telemetry = telemetryRecorder()
  const runtime = createRoomRuntime(
    {
      transport,
      clock,
      ids: memoryIds(clock.now, rng.bits),
      secrets: memorySecrets,
      store,
      history,
      telemetry,
    },
    { build: 'test', ...options.runtime },
  )
  let count = 0

  async function connect(hello: Record<string, unknown> = {}, ip = '10.0.0.1') {
    count += 1
    const conn = `c${count}`
    runtime.open(conn, { room: ROOM, ip })
    await runtime.receive(
      conn,
      JSON.stringify({ frame: 'hello', v: 1, build: 'test', name: 'Ada', avatar: 'ada', ...hello }),
    )
    return conn
  }
  const of = (conn: string) => frames.get(conn) ?? []
  const welcome = (conn: string) => {
    const found = of(conn).findLast((frame) => frame.frame === 'welcome')
    if (found?.frame !== 'welcome') throw new Error(`no welcome for ${conn}`)
    return found
  }
  let ids = 0
  async function send(conn: string, command: Command, id = `m${(ids += 1)}`) {
    await runtime.receive(conn, JSON.stringify({ frame: 'cmd', id, ...command }))
    return of(conn).findLast(
      (frame) => (frame.frame === 'ack' || frame.frame === 'nack') && frame.id === id,
    )
  }
  const advance = (ms: number) =>
    clock.run(
      clock.now() + ms,
      () => {},
      () => false,
    )
  const state = () => runtime.inspect(ROOM)!.state
  const current = () => state().activity.current
  return {
    clock,
    runtime,
    store,
    history,
    telemetry,
    frames,
    closes,
    connect,
    of,
    welcome,
    send,
    advance,
    state,
    current,
  }
}

/** The current round's votes as [seat, card label]. */
const labels = (view: View) =>
  view.activity.rounds.at(-1)!.votes.map((vote) => [vote.seat, vote.card?.label ?? null])

const vote = (round: string, card = '5'): Command => ({
  type: 'poker.vote',
  payload: { round, card },
})

describe('the handshake', () => {
  test('a hello is answered with a welcome: seat, a 43-character token, seq and project(state, seat)', async () => {
    const room = harness()
    const conn = await room.connect()
    const welcome = room.welcome(conn)
    expect(welcome.seat).toBe(0 as SeatIndex)
    expect(welcome.seatToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(welcome.seq).toBe(room.runtime.inspect(ROOM)!.seq)
    expect(welcome.view).toEqual(project(room.state(), welcome.seat))
  })

  test('another protocol version is closed with 4001, a first frame that is no hello with 1008', async () => {
    const room = harness()
    const old = await room.connect({ v: 2 })
    expect(room.closes.get(old)).toBe(4001)
    room.runtime.open('raw', { room: ROOM, ip: '10.0.0.1' })
    await room.runtime.receive('raw', JSON.stringify({ frame: 'ping' }))
    expect(room.closes.get('raw')).toBe(1008)
    expect(room.of('raw')).toEqual([])
  })

  test('a room the store does not know is closed with 4004', async () => {
    const room = harness()
    room.store.rows.clear()
    room.runtime.open('x', { room: 'nowhere', ip: '10.0.0.1' })
    await room.runtime.receive(
      'x',
      JSON.stringify({ frame: 'hello', v: 1, build: 't', name: 'Ada', avatar: 'a' }),
    )
    expect(room.closes.get('x')).toBe(4004)
  })
})

describe('seat tokens and resume', () => {
  test('the room keeps the SHA-256 of a token, never the token', async () => {
    const room = harness()
    const { seatToken, seat } = room.welcome(await room.connect())
    const snapshot = room.runtime.inspect(ROOM)!
    const secret = snapshot.seats.find((entry) => entry.seat === seat)!
    expect(secret.hash).toBe(createHash('sha256').update(seatToken).digest('hex'))
    expect(sha256(seatToken)).toBe(secret.hash)
    expect(JSON.stringify(snapshot)).not.toContain(seatToken)
  })

  test('resume by token returns the seat, its hidden vote and the full view; an unknown token is closed 4004', async () => {
    const room = harness()
    const first = await room.connect()
    const { seatToken, seat } = room.welcome(first)
    await room.send(first, vote(room.current(), '8'))
    room.runtime.closed(first)
    expect(room.state().seats[0]!.presence).toBe('reconnecting')
    const again = await room.connect({ seatToken, lastSeq: 1 })
    const welcome = room.welcome(again)
    expect(welcome.seat).toBe(seat)
    expect(welcome.seatToken).toBe(seatToken)
    expect(welcome.view).toEqual(project(room.state(), seat))
    expect(labels(welcome.view)).toEqual([[seat, '8']])
    expect(room.state().seats[0]!.presence).toBe('active')
    const stranger = await room.connect({ seatToken: 'x'.repeat(43) })
    expect(room.closes.get(stranger)).toBe(4004)
  })

  test('one seat may hold two sockets; it is reconnecting only when the last one is lost', async () => {
    const room = harness()
    const first = await room.connect()
    const second = await room.connect({ seatToken: room.welcome(first).seatToken })
    room.runtime.closed(first)
    expect(room.state().seats[0]!.presence).toBe('active')
    room.runtime.closed(second)
    expect(room.state().seats[0]!.presence).toBe('reconnecting')
  })
})

describe('presence and the heartbeat', () => {
  test('a lost socket holds its seat 120 s, then the seat is gone', async () => {
    const room = harness()
    const conn = await room.connect()
    room.runtime.closed(conn)
    await room.advance(RUNTIME_LIMITS.holdMs - 1)
    expect(room.state().seats[0]!.presence).toBe('reconnecting')
    await room.advance(1)
    expect(room.state().seats[0]!.presence).toBe('gone')
  })

  test('the server pings every 25 s and closes a socket silent for 60 s with 1001', async () => {
    const room = harness()
    const quiet = await room.connect()
    const talker = await room.connect({ name: 'Bo' })
    await room.advance(RUNTIME_LIMITS.pingIntervalMs)
    expect(room.of(quiet).at(-1)).toEqual({ frame: 'ping' })
    for (let beat = 0; beat < 3; beat += 1) {
      await room.runtime.receive(talker, JSON.stringify({ frame: 'pong' }))
      await room.advance(RUNTIME_LIMITS.pingIntervalMs)
    }
    expect(room.closes.get(quiet)).toBe(1001)
    expect(room.closes.has(talker)).toBe(false)
    expect(room.state().seats.find((seat) => seat.name === 'Ada')!.presence).toBe('reconnecting')
  })
})

describe('the lock', () => {
  test('a missing and a wrong code are closed with 4005, and the unseated socket hears nothing', async () => {
    const room = harness({ code: 'Kröte' })
    const missing = await room.connect()
    const wrong = await room.connect({ code: 'frosch' })
    expect(room.closes.get(missing)).toBe(4005)
    expect(room.closes.get(wrong)).toBe(4005)
    expect(room.of(missing)).toEqual([])
    expect(room.of(wrong)).toEqual([])
  })

  test("the code matches in any case and after NFKC, and a seated seat's view holds it", async () => {
    const room = harness({ code: 'Kröte' })
    const conn = await room.connect({ code: '  KRÖTE ' })
    const welcome = room.welcome(conn)
    expect(welcome.view.room.code).toBe(parseAccessCode('Kröte')!)
    const decomposed = await room.connect({ name: 'Bo', code: 'kro\u0308te' })
    expect(room.welcome(decomposed).seat).toBe(1 as SeatIndex)
  })

  test('the sixth attempt of one address within a minute is refused without a comparison', async () => {
    const room = harness({ code: 'Kröte' })
    for (let attempt = 0; attempt < RUNTIME_LIMITS.addressAttempts; attempt += 1)
      expect(room.closes.get(await room.connect({ code: `guess ${attempt}` }, '10.0.0.9'))).toBe(
        4005,
      )
    const sixth = await room.connect({ code: 'Kröte' }, '10.0.0.9')
    expect(room.closes.get(sixth)).toBe(4005)
    const elsewhere = await room.connect({ code: 'Kröte' }, '10.0.0.10')
    expect(room.welcome(elsewhere).seat).toBe(0 as SeatIndex)
    await room.advance(RUNTIME_LIMITS.attemptBlockMs)
    const later = await room.connect({ name: 'Bo', code: 'Kröte' }, '10.0.0.9')
    expect(room.welcome(later).seat).toBe(1 as SeatIndex)
  })

  test('ten wrong codes in a minute pause the room for every address', async () => {
    const room = harness({ code: 'Kröte' })
    for (let attempt = 0; attempt < RUNTIME_LIMITS.roomAttempts; attempt += 1)
      await room.connect({ code: 'guess' }, `10.0.1.${attempt}`)
    const right = await room.connect({ code: 'Kröte' }, '10.0.2.1')
    expect(room.closes.get(right)).toBe(4005)
  })

  test('raising the access epoch closes the other seats with 4004 and keeps the one who locked', async () => {
    const room = harness()
    const ada = await room.connect()
    const bo = await room.connect({ name: 'Bo' })
    const boToken = room.welcome(bo).seatToken
    const result = room.runtime.setAccess(ROOM, {
      access: 'locked',
      code: parseAccessCode('neu')!,
      by: room.welcome(ada).seat,
      reseat: true,
    })
    expect(result).toEqual({ ok: true, accessEpoch: 1 })
    expect(room.closes.get(bo)).toBe(4004)
    expect(room.closes.has(ada)).toBe(false)
    expect(room.state().seats[1]!.presence).toBe('gone')
    expect(room.closes.get(await room.connect({ name: 'Bo', seatToken: boToken }))).toBe(4004)
    const back = await room.connect({ seatToken: room.welcome(ada).seatToken })
    expect(room.welcome(back).seat).toBe(0 as SeatIndex)
    // With the new code Bo takes the old place back by name.
    expect(room.welcome(await room.connect({ name: 'Bo', code: 'NEU' })).seat).toBe(1 as SeatIndex)
  })
})

describe('reclaim by name', () => {
  test('a seat that is reconnecting is taken back by name: same index, no hidden vote, a new token', async () => {
    const room = harness()
    const first = await room.connect({ name: 'Cem' })
    const { seat, seatToken } = room.welcome(first)
    await room.connect({ name: 'Dana' })
    await room.send(first, vote(room.current(), '3'))
    room.runtime.closed(first)
    const again = await room.connect({ name: 'Cem' })
    const welcome = room.welcome(again)
    expect(welcome.seat).toBe(seat)
    expect(welcome.seatToken).not.toBe(seatToken)
    expect(welcome.view.activity.rounds.at(-1)!.votes).toEqual([])
    expect(room.state().activity.rounds.at(-1)!.votes).toEqual([])
    expect(room.state().seats.find((s) => s.index === seat)!.presence).toBe('active')
    expect(room.closes.get(await room.connect({ name: 'Cem', seatToken }))).toBe(4004)
  })

  test('an active seat is never taken by name: the same name gets a new seat', async () => {
    const room = harness()
    await room.connect({ name: 'Cem' })
    expect(room.welcome(await room.connect({ name: 'Cem' })).seat).toBe(1 as SeatIndex)
  })
})

describe('limits', () => {
  test('a burst of ten passes, the eleventh is nacked rate_limited, the tenth refusal closes 4008', async () => {
    const room = harness()
    const conn = await room.connect()
    const answers: string[] = []
    for (let i = 0; i < 20; i += 1) {
      const answer = await room.send(conn, { type: 'seat.rename', payload: { name: `Ada ${i}` } })
      answers.push(answer?.frame === 'nack' ? answer.reason : (answer?.frame ?? 'none'))
    }
    expect(answers.slice(0, 10)).toEqual(Array(10).fill('ack'))
    expect(answers.slice(10)).toEqual(Array(10).fill('rate_limited'))
    expect(room.closes.get(conn)).toBe(4008)
  })

  test('the bucket refills at five per second', async () => {
    const room = harness()
    const conn = await room.connect()
    for (let i = 0; i < 10; i += 1)
      await room.send(conn, {
        type: 'seat.setPresence',
        payload: { presence: i % 2 ? 'active' : 'away' },
      })
    expect((await room.send(conn, vote(room.current())))?.frame).toBe('nack')
    await room.advance(200)
    expect((await room.send(conn, vote(room.current())))?.frame).toBe('ack')
  })

  test('one fx per seat in 2 s; the server names the sender', async () => {
    const room = harness()
    const ada = await room.connect()
    const bo = await room.connect({ name: 'Bo' })
    const react = JSON.stringify({
      frame: 'fx',
      seat: 7,
      type: 'seat.react',
      payload: { emoji: '👍', to: null },
    })
    await room.runtime.receive(ada, react)
    await room.runtime.receive(ada, react)
    await room.advance(RUNTIME_LIMITS.fxIntervalMs)
    await room.runtime.receive(ada, react)
    const fx = room.of(bo).filter((frame) => frame.frame === 'fx')
    expect(fx).toHaveLength(2)
    expect(fx[0]).toEqual({
      frame: 'fx',
      seat: 0 as SeatIndex,
      type: 'seat.react',
      payload: { emoji: '👍', to: null },
    })
  })
})

describe('rounds and timers', () => {
  test('auto reveal counts down on the clock port and a player can cancel it', async () => {
    const room = harness()
    const ada = await room.connect()
    await room.send(ada, {
      type: 'room.setSettings',
      payload: { autoReveal: true, revealCountdown: 3 },
    })
    await room.send(ada, vote(room.current(), '5'))
    const round = () => room.state().activity.rounds.at(-1)!
    expect(round().countdown?.endsAt).toBe(room.clock.now() + 3000)
    await room.send(ada, { type: 'poker.cancelReveal', payload: { round: round().id } })
    await room.advance(5000)
    expect(round().state).toBe('voting')
    await room.send(ada, { type: 'topic.next', payload: { round: round().id } })
    await room.send(ada, vote(room.current(), '8'))
    await room.advance(3000)
    expect(round().state).toBe('revealed')
    expect(room.history.rounds).toHaveLength(1)
  })
})

describe('the device id', () => {
  test("reaches history with a seat's first vote of a day, once, and no frame or snapshot", async () => {
    const room = harness()
    const device = 'device-7f3a'
    const ada = await room.connect({ device })
    await room.send(ada, vote(room.current(), '3'))
    await room.send(ada, vote(room.current(), '5'))
    expect(room.history.days).toEqual([`2026-01-01|${device}`])
    await room.advance(24 * 3600 * 1000)
    const again = await room.connect({ device, seatToken: room.welcome(ada).seatToken })
    await room.send(again, vote(room.current(), '8'))
    expect(room.history.days).toEqual([`2026-01-01|${device}`, `2026-01-02|${device}`])
    const everything =
      JSON.stringify([...room.frames.values()]) + JSON.stringify(room.runtime.inspect(ROOM))
    expect(everything).not.toContain(device)
  })
})

describe('snapshots', () => {
  test('a drained room is claimed by the next process from its snapshot and resumes every seat', async () => {
    const store = memoryStore()
    const before = harness({ store })
    const ada = await before.connect()
    const { seatToken, seat } = before.welcome(ada)
    await before.send(ada, vote(before.current(), '13'))
    const seq = before.runtime.inspect(ROOM)!.seq
    await before.runtime.drain()
    expect(before.closes.get(ada)).toBe(4002)

    const after = harness({ store })
    const back = await after.connect({ seatToken })
    const welcome = after.welcome(back)
    expect(welcome.seat).toBe(seat)
    expect(welcome.seq).toBeGreaterThan(seq)
    expect(labels(welcome.view)).toEqual([[seat, '13']])
  })

  test("a write that finds another owner closes the room's sockets with 4002", async () => {
    const room = harness()
    const ada = await room.connect()
    room.store.steal(ROOM)
    await room.send(ada, vote(room.current()))
    await room.advance(RUNTIME_LIMITS.snapshotDebounceMs)
    expect(room.closes.get(ada)).toBe(4002)
    expect(room.runtime.inspect(ROOM)).toBeUndefined()
  })

  test('nothing the runtime ran failed', async () => {
    const room = harness()
    const ada = await room.connect()
    await room.send(ada, vote(room.current()))
    await room.runtime.receive(ada, '{not json')
    await room.runtime.receive(
      ada,
      JSON.stringify({ frame: 'cmd', id: 'z', type: 'poker.nothing', payload: {} }),
    )
    expect(room.of(ada).at(-1)).toEqual({ frame: 'nack', id: 'z', reason: 'invalid' })
    expect(room.telemetry.failures).toEqual([])
  })
})
