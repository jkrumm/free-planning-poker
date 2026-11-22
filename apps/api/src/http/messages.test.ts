import { afterEach, describe, expect, test } from 'bun:test'
import { freePort } from '@fpp/test-kit/port'
import { createMessages, type MessagesOptions } from '../app/messages.ts'
import { deadUrl, startUpstream } from '../../test/upstream.ts'
import { NO_ROOMS } from '../../test/support.ts'
import { createApp } from './app.ts'

const ORIGIN = 'https://room.test'

const contact = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  subject: 'A question about rooms',
  message: 'Hello there',
}

const feedback = { title: 'A title', text: 'Some text', version: '9.0.0', route: '/room/new' }

const long = (length: number) => 'x'.repeat(length)
const validFor = (path: string) => (path === '/contact' ? contact : feedback)

const stops: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const stop of stops.splice(0)) await stop()
})

async function upstream(answer: number | 'hang' = 200) {
  const started = await startUpstream(await freePort(), answer)
  stops.push(started.stop)
  return started
}

const failures: { component: string; action: string }[] = []

function appWith(options: Partial<MessagesOptions> = {}, client = 'client-a') {
  failures.length = 0
  return createApp({
    build: { version: 'test', commit: 'test' },
    rooms: NO_ROOMS,
    messages: createMessages({
      gateway: undefined,
      door: undefined,
      now: () => 0,
      failed: (_error, at) => failures.push(at),
      ...options,
    }),
    origins: new Set([ORIGIN]),
    client: () => client,
    health: async () => 'ok',
  })
}

const post = (
  app: ReturnType<typeof appWith>,
  path: string,
  body: unknown,
  headers: Record<string, string> = { origin: ORIGIN },
) =>
  app.handle(
    new Request(`http://localhost/api${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )

describe('a valid message reaches its upstream', () => {
  test('contact: the gateway gets POST /fpp with the bearer secret and the four fields', async () => {
    const gateway = await upstream()
    const app = appWith({ gateway: { url: gateway.url, secret: 'gateway-secret' } })
    const response = await post(app, '/contact', contact)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(gateway.received).toHaveLength(1)
    const [request] = gateway.received
    expect(request?.method).toBe('POST')
    expect(request?.path).toBe('/fpp')
    expect(request?.authorization).toBe('Bearer gateway-secret')
    expect(request?.contentType).toBe('application/json')
    expect(JSON.parse(request?.body ?? '')).toEqual(contact)
  })

  test('contact: name and message are optional and leave the body when absent', async () => {
    const gateway = await upstream()
    const app = appWith({ gateway: { url: gateway.url, secret: 's' } })
    const minimal = { email: contact.email, subject: contact.subject }
    expect((await post(app, '/contact', minimal)).status).toBe(200)
    expect(JSON.parse(gateway.received[0]?.body ?? '')).toEqual(minimal)
  })

  test('feedback: the door gets the full URL with the bearer token and the trimmed fields', async () => {
    const door = await upstream()
    const app = appWith({
      door: { url: `${door.url}/feedback/free-planning-poker`, secret: 'door-token' },
    })
    const response = await post(app, '/feedback', {
      ...feedback,
      title: '  A title  ',
      text: '  Some text\n',
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    const [request] = door.received
    expect(request?.path).toBe('/feedback/free-planning-poker')
    expect(request?.authorization).toBe('Bearer door-token')
    expect(JSON.parse(request?.body ?? '')).toEqual(feedback)
  })

  test('feedback: a text of spaces leaves the body', async () => {
    const door = await upstream()
    const app = appWith({ door: { url: door.url, secret: 't' } })
    expect((await post(app, '/feedback', { ...feedback, text: '   ' })).status).toBe(200)
    expect(JSON.parse(door.received[0]?.body ?? '')).toEqual({
      title: feedback.title,
      version: feedback.version,
      route: feedback.route,
    })
  })
})

describe('the limits', () => {
  const clock = { now: 0 }
  const limited = async (path: '/contact' | '/feedback') => {
    const target = await upstream()
    const upstreams =
      path === '/contact'
        ? { gateway: { url: target.url, secret: 's' } }
        : { door: { url: target.url, secret: 's' } }
    clock.now = 0
    return { target, app: appWith({ ...upstreams, now: () => clock.now }) }
  }

  for (const path of ['/contact', '/feedback'] as const) {
    test(`${path}: the fourth of one client within 10 minutes answers 429 with retry-after`, async () => {
      const { target, app } = await limited(path)
      for (let sent = 0; sent < 3; sent++) {
        clock.now = sent * 60_000
        expect((await post(app, path, validFor(path))).status).toBe(200)
      }
      clock.now = 3 * 60_000
      const refused = await post(app, path, validFor(path))
      expect(refused.status).toBe(429)
      expect(refused.headers.get('retry-after')).toBe(String(7 * 60))
      expect(await refused.json()).toEqual({ error: 'rate_limited' })
      expect(target.received).toHaveLength(3)
      clock.now = 10 * 60_000
      expect((await post(app, path, validFor(path))).status).toBe(200)
    })
  }

  test('a refusal for a broken field is not counted, and a limited client does not stop another', async () => {
    const target = await upstream()
    const app = appWith({ door: { url: target.url, secret: 's' }, limits: { perClient: 1 } }, 'a')
    expect((await post(app, '/feedback', { ...feedback, title: '' })).status).toBe(400)
    expect((await post(app, '/feedback', feedback)).status).toBe(200)
    expect((await post(app, '/feedback', feedback)).status).toBe(429)
  })

  test('contact and feedback count apart', async () => {
    const gateway = await upstream()
    const door = await upstream()
    const app = appWith({
      gateway: { url: gateway.url, secret: 's' },
      door: { url: door.url, secret: 's' },
      limits: { perClient: 1 },
    })
    expect((await post(app, '/contact', contact)).status).toBe(200)
    expect((await post(app, '/feedback', feedback)).status).toBe(200)
    expect((await post(app, '/contact', contact)).status).toBe(429)
  })
})

describe('each field limit answers a typed 400', () => {
  const bad: [string, string, unknown][] = [
    ['/contact', 'invalid_name', { ...contact, name: long(51) }],
    ['/contact', 'invalid_name', { ...contact, name: 'two\nlines' }],
    ['/contact', 'invalid_email', { ...contact, email: `${long(60)}@example.com` }],
    ['/contact', 'invalid_email', { ...contact, email: 'not-an-address' }],
    ['/contact', 'invalid_email', { subject: contact.subject }],
    ['/contact', 'invalid_subject', { ...contact, subject: 'ab' }],
    ['/contact', 'invalid_subject', { ...contact, subject: long(101) }],
    ['/contact', 'invalid_subject', { ...contact, subject: 'two\nlines' }],
    ['/contact', 'invalid_message', { ...contact, message: long(801) }],
    ['/contact', 'invalid_name', { ...contact, name: 7 }],
    ['/contact', 'invalid_body', '[1]'],
    ['/contact', 'invalid_body', '{not json'],
    ['/feedback', 'invalid_title', { ...feedback, title: '' }],
    ['/feedback', 'invalid_title', { ...feedback, title: '   ' }],
    ['/feedback', 'invalid_title', { ...feedback, title: long(201) }],
    ['/feedback', 'invalid_text', { ...feedback, text: long(2001) }],
    ['/feedback', 'invalid_version', { ...feedback, version: '' }],
    ['/feedback', 'invalid_version', { ...feedback, version: long(65) }],
    ['/feedback', 'invalid_route', { ...feedback, route: long(257) }],
    ['/feedback', 'invalid_route', { title: feedback.title, version: feedback.version }],
  ]
  for (const [path, error, body] of bad) {
    test(`${path} ${error}: ${JSON.stringify(body).slice(0, 40)}`, async () => {
      const target = await upstream()
      const app = appWith({
        gateway: { url: target.url, secret: 's' },
        door: { url: target.url, secret: 's' },
      })
      const response = await post(app, path, body)
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error })
      expect(target.received).toHaveLength(0)
    })
  }

  test('the limits themselves are accepted', async () => {
    const target = await upstream()
    const app = appWith({
      gateway: { url: target.url, secret: 's' },
      door: { url: target.url, secret: 's' },
      limits: { perClient: 10 },
    })
    const max = {
      name: long(50),
      email: `${long(58)}@example.com`,
      subject: long(100),
      message: long(800),
    }
    expect(max.email).toHaveLength(70)
    expect((await post(app, '/contact', max)).status).toBe(200)
    expect((await post(app, '/contact', { ...contact, subject: 'abc' })).status).toBe(200)
    const full = { title: long(200), text: long(2000), version: long(64), route: long(256) }
    expect((await post(app, '/feedback', full)).status).toBe(200)
  })
})

describe('with no upstream configured', () => {
  for (const [path, body] of [
    ['/contact', contact],
    ['/feedback', feedback],
  ] as const) {
    test(`POST ${path} answers a typed 503`, async () => {
      const response = await post(appWith(), path, body)
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ error: 'unavailable' })
    })
  }
})

describe('an upstream that fails', () => {
  test('a refusal answers 502 and is recorded once, by component and action', async () => {
    const gateway = await upstream(500)
    const app = appWith({ gateway: { url: gateway.url, secret: 's' } })
    const response = await post(app, '/contact', contact)
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'upstream_failed' })
    expect(failures).toEqual([{ component: 'contact', action: 'send' }])
  })

  test('an upstream nobody listens at answers 502', async () => {
    const app = appWith({ door: { url: await deadUrl(await freePort()), secret: 's' } })
    expect((await post(app, '/feedback', feedback)).status).toBe(502)
    expect(failures).toEqual([{ component: 'feedback', action: 'send' }])
  })

  test('an upstream that never answers is given up on at its timeout', async () => {
    const gateway = await upstream('hang')
    const app = appWith({
      gateway: { url: gateway.url, secret: 's' },
      timeouts: { gateway: 50 },
    })
    const response = await post(app, '/contact', contact)
    expect(response.status).toBe(502)
    expect(failures).toEqual([{ component: 'contact', action: 'send' }])
  })
})

describe("the timeouts are v1's", () => {
  test('a request asks for seven seconds to the gateway and five to the door', async () => {
    const gateway = await upstream()
    const door = await upstream()
    const asked: number[] = []
    const app = appWith({
      gateway: { url: gateway.url, secret: 's' },
      door: { url: door.url, secret: 's' },
      timeout: (ms) => {
        asked.push(ms)
        return AbortSignal.timeout(ms)
      },
    })
    expect((await post(app, '/contact', contact)).status).toBe(200)
    expect((await post(app, '/feedback', feedback)).status).toBe(200)
    expect(asked).toEqual([7000, 5000])
  })
})

describe('the origin', () => {
  test('a request from another origin, or with none, is refused before anything is sent', async () => {
    const gateway = await upstream()
    const app = appWith({ gateway: { url: gateway.url, secret: 's' } })
    for (const headers of [{ origin: 'https://elsewhere.test' }, {}]) {
      const response = await post(app, '/contact', contact, headers)
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'forbidden_origin' })
    }
    expect(gateway.received).toHaveLength(0)
  })
})
