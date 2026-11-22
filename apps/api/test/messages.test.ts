/**
 * The message routes on the real adapter: the client the limits count is the edge's header when `CLIENT_IP_HEADER`
 * names one, else the socket's peer, and a body past the server's cap is refused before a route reads it.
 */
import { afterEach, expect, test } from 'bun:test'
import { freePort } from '@fpp/test-kit/port'
import { createMessages } from '../src/app/messages.ts'
import { MAX_BODY_BYTES } from '../src/ws/edge.ts'
import { ORIGIN } from './contract/client.ts'
import { startServer, type Started } from './contract/harness.ts'
import { startUpstream } from './upstream.ts'

const feedback = { title: 'A title', version: '9.0.0', route: '/room/new' }

const stops: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const stop of stops.splice(0)) await stop()
})

/** The client each message reached the API under. */
const seen: string[] = []

async function start(
  clientIpHeader?: string,
): Promise<{ room: Started; door: Awaited<ReturnType<typeof startUpstream>> }> {
  const door = await startUpstream(await freePort())
  seen.length = 0
  const sending = createMessages({
    gateway: undefined,
    door: { url: door.url, secret: 'door-token' },
    now: Date.now,
    failed: () => {},
  })
  const messages = {
    ...sending,
    feedback: (input: Parameters<typeof sending.feedback>[0], client: string) => {
      seen.push(client)
      return sending.feedback(input, client)
    },
  }
  const room = await startServer('bun', await freePort(), {
    messages,
    ...(clientIpHeader === undefined ? {} : { clientIpHeader }),
  })
  stops.push(door.stop, room.stop)
  return { room, door }
}

const send = (room: Started, headers: Record<string, string>, body: unknown = feedback) =>
  fetch(`http://127.0.0.1:${room.server.port}/api/feedback`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  })

test('behind the edge, clients are told apart by the header it sets, not by the proxy that connects', async () => {
  const { room, door } = await start('cf-connecting-ip')
  for (let sent = 0; sent < 3; sent++)
    expect((await send(room, { 'cf-connecting-ip': '203.0.113.1' })).status).toBe(200)
  expect((await send(room, { 'cf-connecting-ip': '203.0.113.1' })).status).toBe(429)
  expect((await send(room, { 'cf-connecting-ip': '203.0.113.2' })).status).toBe(200)
  expect(door.received).toHaveLength(4)
})

test('a forwarded-for list is no source for the client: a client cannot choose its own key', async () => {
  const { room } = await start('cf-connecting-ip')
  for (let sent = 0; sent < 3; sent++)
    expect((await send(room, { 'cf-connecting-ip': '203.0.113.1' })).status).toBe(200)
  const forged = await send(room, {
    'cf-connecting-ip': '203.0.113.1',
    'x-forwarded-for': '198.51.100.9',
  })
  expect(forged.status).toBe(429)
})

test('without a named header the socket peer is the client', async () => {
  const { room } = await start()
  for (let sent = 0; sent < 3; sent++) expect((await send(room, {})).status).toBe(200)
  expect((await send(room, { 'cf-connecting-ip': '203.0.113.2' })).status).toBe(429)
})

test('the key is the socket peer without a header, and the header when one is named', async () => {
  const bare = await start()
  expect((await send(bare.room, { 'cf-connecting-ip': '203.0.113.2' })).status).toBe(200)
  expect(seen).toEqual(['127.0.0.1'])
  const behind = await start('cf-connecting-ip')
  expect((await send(behind.room, { 'cf-connecting-ip': '203.0.113.2' })).status).toBe(200)
  expect(seen).toEqual(['203.0.113.2'])
})

test('a body past the server cap never reaches a route', async () => {
  const { room, door } = await start()
  const response = await send(room, {}, { ...feedback, text: 'x'.repeat(MAX_BODY_BYTES) })
  expect(response.status).toBe(413)
  expect(door.received).toHaveLength(0)
})
