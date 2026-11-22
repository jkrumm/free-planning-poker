import { afterAll, beforeAll, expect, test } from 'bun:test'
import { freePort } from '@fpp/test-kit/port'
import { startPostgres, type PostgresCluster } from '@fpp/test-kit/postgres'
import { ENV } from '../../test/support.ts'
import { startUpstream } from '../../test/upstream.ts'
import { parseEnv } from '../env.ts'
import { createApiTelemetry } from '../telemetry.ts'
import { serveBun } from '../ws/bun.transport.ts'
import { composeApi } from './compose.ts'

let cluster: PostgresCluster

beforeAll(async () => {
  cluster = await startPostgres()
}, 60_000)

afterAll(async () => {
  await cluster?.stop()
})

const compose = (extra: Record<string, string>) => {
  const env = parseEnv({ ...ENV, DATABASE_URL: cluster.url, ...extra })
  return composeApi(env, { now: Date.now, telemetry: createApiTelemetry(env) })
}

test('the environment reaches the room server: origins and the client address header', async () => {
  const behindProxy = await compose({
    ALLOWED_ORIGINS: 'https://next.free-planning-poker.com',
    CLIENT_IP_HEADER: 'CF-Connecting-IP',
  })
  const direct = await compose({})
  try {
    expect(behindProxy.options.origins).toEqual(['https://next.free-planning-poker.com'])
    expect(behindProxy.options.clientIpHeader).toBe('cf-connecting-ip')
    expect(direct.options.clientIpHeader).toBeUndefined()
  } finally {
    await behindProxy.close()
    await direct.close()
  }
})

test('the upstream variables reach their own route: contact to the gateway, feedback to the door', async () => {
  const gateway = await startUpstream(await freePort())
  const door = await startUpstream(await freePort())
  const origin = 'https://next.free-planning-poker.com'
  const api = await compose({
    PORT: String(await freePort()),
    ALLOWED_ORIGINS: origin,
    EMAIL_GATEWAY_URL: gateway.url,
    EMAIL_GATEWAY_SECRET_KEY: 'gateway-secret',
    FACTORY_FEEDBACK_URL: `${door.url}/feedback/free-planning-poker`,
    FACTORY_FEEDBACK_TOKEN: 'door-token',
  })
  const server = await serveBun({ ...api.options, hostname: '127.0.0.1' })
  const post = (path: string, body: unknown) =>
    fetch(`http://127.0.0.1:${server.port}/api${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify(body),
    })
  try {
    const email = { email: 'ada@example.com', subject: 'A question' }
    expect((await post('/contact', email)).status).toBe(200)
    expect((await post('/feedback', { title: 'A title', version: '9', route: '/' })).status).toBe(
      200,
    )
    expect(gateway.received.map((got) => [got.path, got.authorization])).toEqual([
      ['/fpp', 'Bearer gateway-secret'],
    ])
    expect(door.received.map((got) => [got.path, got.authorization])).toEqual([
      ['/feedback/free-planning-poker', 'Bearer door-token'],
    ])
  } finally {
    await server.stop()
    await api.close()
    await gateway.stop()
    await door.stop()
  }
})

test('behind the edge the limits count the clients the edge names, through the composed API', async () => {
  const door = await startUpstream(await freePort())
  const origin = 'https://next.free-planning-poker.com'
  const api = await compose({
    PORT: String(await freePort()),
    ALLOWED_ORIGINS: origin,
    CLIENT_IP_HEADER: 'CF-Connecting-IP',
    FACTORY_FEEDBACK_URL: door.url,
    FACTORY_FEEDBACK_TOKEN: 'door-token',
  })
  const server = await serveBun({ ...api.options, hostname: '127.0.0.1' })
  const send = (address: string) =>
    fetch(`http://127.0.0.1:${server.port}/api/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin, 'cf-connecting-ip': address },
      body: JSON.stringify({ title: 'A title', version: '9', route: '/' }),
    })
  try {
    for (let sent = 0; sent < 3; sent++) expect((await send('203.0.113.1')).status).toBe(200)
    expect((await send('203.0.113.1')).status).toBe(429)
    expect((await send('203.0.113.2')).status).toBe(200)
  } finally {
    await server.stop()
    await api.close()
    await door.stop()
  }
})
