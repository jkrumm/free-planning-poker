/**
 * The transport contract suite (rule `transport.md`): what every adapter of the transport port must do, with real
 * sockets on an ephemeral port. A bump of Bun or Elysia passes it before it merges.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  CLOSE_CODES,
  LIMITS,
  parseAccessCode,
  parseSlug,
  type ServerFrame,
} from '@fpp/room-core/types'
import { freePort } from '@fpp/test-kit/port'
import { join, TestClient, hello, upgradeStatus } from './client.ts'
import { ADAPTERS, type AdapterName, SETTINGS, startServer, type Started } from './harness.ts'

const ROOM = '482913'
const slug = (text: string) => {
  const parsed = parseSlug(text)
  if (parsed === undefined) throw new Error(`not a slug: ${text}`)
  return parsed
}

describe.each(Object.keys(ADAPTERS) as AdapterName[])('transport contract: %s', (adapter) => {
  let room: Started
  const open: TestClient[] = []
  const track = <T extends { client: TestClient }>(joined: T) => {
    open.push(joined.client)
    return joined
  }

  beforeEach(async () => {
    room = await startServer(adapter, await freePort())
    room.rooms.put(slug(ROOM), { settings: SETTINGS })
  })
  afterEach(async () => {
    for (const client of open.splice(0)) client.close()
    await room.stop()
  })

  test('a hidden vote reaches no other seat before the reveal, and every seat after it', async () => {
    const alice = track(await join(room.url(ROOM), { name: 'Alice' }))
    const bob = track(await join(room.url(ROOM), { name: 'Bob' }))
    const round = alice.welcome.view.activity.current

    alice.client.send({
      frame: 'cmd',
      id: 'v1',
      type: 'poker.vote',
      payload: { round, card: 'XXL' },
    })
    await alice.client.next('ack', (frame) => frame.id === 'v1')
    await bob.client.next('evt', (frame) => frame.type === 'poker.voted')
    // The deck lists every card, XXL included; outside that list no frame may carry the label.
    const deck = JSON.stringify(SETTINGS.deck)
    expect(bob.client.raw[0]).toContain(deck)
    expect(bob.client.raw.some((text) => text.split(deck).join('').includes('XXL'))).toBe(false)

    alice.client.send({ frame: 'cmd', id: 'r1', type: 'poker.reveal', payload: { round } })
    const revealed = await bob.client.next('evt', (frame) => frame.type === 'poker.revealed')
    expect(JSON.stringify(revealed).split(JSON.stringify(SETTINGS.deck)).join('')).toContain('XXL')
  })

  test('a hello with an unsupported version is closed with 4001', async () => {
    const client = await TestClient.open(room.url(ROOM))
    open.push(client)
    client.send(hello({ name: 'Old', v: 99 }))
    expect((await client.closed).code).toBe(CLOSE_CODES.version_unsupported)
  })

  test('a foreign or missing Origin is refused with 403, an address that is none with 404, before the upgrade', async () => {
    const port = room.server.port
    expect(await upgradeStatus(port, `/api/ws/${ROOM}`, 'https://evil.example')).toBe(403)
    expect(await upgradeStatus(port, `/api/ws/${ROOM}`, null)).toBe(403)
    expect(await upgradeStatus(port, '/api/ws/not%20a%20room', 'http://room.test')).toBe(404)
    expect(await upgradeStatus(port, '/api/ws/ABC-room', 'http://room.test')).toBe(404)
  })

  test('the HTTP routes answer beside the socket', async () => {
    const response = await fetch(`http://127.0.0.1:${room.server.port}/api/health`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  test('a frame above 16 KB closes the socket with 1009', async () => {
    const alice = track(await join(room.url(ROOM), { name: 'Alice' }))
    alice.client.socket.send(JSON.stringify({ frame: 'ping', pad: 'x'.repeat(17 * 1024) }))
    expect((await alice.client.closed).code).toBe(1009)
  })

  test('a flood is rejected, then closed with 4008', async () => {
    const alice = track(await join(room.url(ROOM), { name: 'Alice' }))
    for (let index = 0; index < 40; index += 1)
      alice.client.send({
        frame: 'cmd',
        id: `f${index}`,
        type: 'seat.setPresence',
        payload: { presence: 'active' },
      })
    await alice.client.next('nack', (frame) => frame.reason === 'rate_limited')
    expect((await alice.client.closed).code).toBe(CLOSE_CODES.rate_limited)
  })

  test('a seat that drops and resumes with its token keeps its index and receives the current view', async () => {
    const alice = await join(room.url(ROOM), { name: 'Alice' })
    const bob = track(await join(room.url(ROOM), { name: 'Bob' }))
    alice.client.close()
    await alice.client.closed
    await bob.client.next('evt', (frame) => frame.type === 'seat.presenceChanged')

    bob.client.send({ frame: 'cmd', id: 'n1', type: 'seat.rename', payload: { name: 'Robert' } })
    await bob.client.next('ack', (frame) => frame.id === 'n1')

    const back = track(
      await join(room.url(ROOM), { name: 'Alice', seatToken: alice.welcome.seatToken }),
    )
    expect(back.welcome.seat).toBe(alice.welcome.seat)
    expect(back.welcome.view.self).toBe(alice.welcome.seat)
    expect(back.welcome.view.seats.find((seat) => seat.index === bob.welcome.seat)?.name).toBe(
      'Robert',
    )
    expect(
      back.welcome.view.seats.find((seat) => seat.index === alice.welcome.seat)?.presence,
    ).toBe('active')
  })

  test(`${LIMITS.players} players join; the next is refused as a player and seated as a spectator`, async () => {
    for (let index = 0; index < LIMITS.players; index += 1) {
      const player = track(await join(room.url(ROOM), { name: `Player ${index}` }))
      const own = player.welcome.view.seats.find((seat) => seat.index === player.welcome.seat)
      expect(own?.role).toBe('player')
    }
    const late = track(await join(room.url(ROOM), { name: 'Late' }))
    expect(late.welcome.view.seats.find((seat) => seat.index === late.welcome.seat)?.role).toBe(
      'spectator',
    )
  })

  test('a locked room closes a wrong access code with 4005 and seats the right one', async () => {
    const code = parseAccessCode('k7m2qx')
    if (code === undefined) throw new Error('not an access code')
    room.rooms.put(slug('team-alpha'), { access: 'locked', code })

    const wrong = await TestClient.open(room.url('team-alpha'))
    open.push(wrong)
    wrong.send(hello({ name: 'Mallory', code: 'nope42' }))
    expect((await wrong.closed).code).toBe(CLOSE_CODES.access_required)

    const right = track(await join(room.url('team-alpha'), { name: 'Alice', code: 'K7M2QX' }))
    expect(right.welcome.view.room.access).toBe('locked')
  })

  test('a slow consumer is closed at the backpressure limit, and the other seat receives every frame', async () => {
    const fast = track(await join(room.url(ROOM), { name: 'Fast' }))
    const slow = track(await join(room.url(ROOM), { name: 'Slow' }))
    // Five long topics make one event of about 12 KB, so 1,000 of them outgrow every kernel buffer on the way.
    const topic = {
      title: 't'.repeat(300),
      url: `https://tracker.example/${'u'.repeat(2000)}`,
      ref: null,
    }
    fast.client.send({
      frame: 'cmd',
      id: 'a1',
      type: 'topic.add',
      payload: { topics: Array.from({ length: 5 }, () => topic) },
    })
    const added = await fast.client.next('evt', (frame) => frame.type === 'topic.added')
    await slow.client.next('evt', (frame) => frame.type === 'topic.added')

    slow.client.socket.pause()
    const key = await room.rooms.directory.resolve(slug(ROOM))
    if (key === null) throw new Error('the room has no key')
    const base = added.seq + 1_000_000
    // Events arrive over time, as a room makes them: ten per turn of the event loop, so a seat that reads keeps up.
    for (let index = 0; index < 1_000; index += 1) {
      room.server.transport.publish(key, { ...added, seq: base + index } as ServerFrame)
      if (index % 10 === 9) await new Promise((resolve) => setImmediate(resolve))
    }

    const last = await fast.client.next('evt', (frame) => frame.seq === base + 999)
    expect(last.seq).toBe(base + 999)
    const burst = fast.client.frames.filter((frame) => frame.frame === 'evt' && frame.seq >= base)
    expect(burst.map((frame) => (frame.frame === 'evt' ? frame.seq - base : -1))).toEqual(
      Array.from({ length: 1_000 }, (_, index) => index),
    )
    slow.client.socket.resume()
    const closed = await slow.client.closed
    expect(closed.code).not.toBe(1000)
    expect(
      slow.client.frames.filter((frame) => frame.frame === 'evt' && frame.seq >= base).length,
    ).toBeLessThan(1_000)
  })

  test('a stop closes every open socket with 4002', async () => {
    const alice = await join(room.url(ROOM), { name: 'Alice' })
    await room.server.stop()
    expect((await alice.client.closed).code).toBe(CLOSE_CODES.draining)
  })
})
