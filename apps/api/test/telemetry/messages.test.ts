/**
 * The content test of rule `telemetry.md` for the message routes: a contact and a feedback whose upstreams fail carry
 * marker strings in every field, and nothing the API exports (spans, metrics, log records, structured lines) holds one.
 * The failure itself must be there: a content test over an empty export would pass for the wrong reason.
 */
import { expect, test } from 'bun:test'
import { leaksIn, memoryExporters } from '@fpp/telemetry/memory'
import { freePort } from '@fpp/test-kit/port'
import { createMessages } from '../../src/app/messages.ts'
import { parseEnv } from '../../src/env.ts'
import { createApp } from '../../src/http/app.ts'
import { createApiTelemetry } from '../../src/telemetry.ts'
import { NO_ROOMS, NO_STATS, ENV } from '../support.ts'
import { deadUrl, startUpstream } from '../upstream.ts'

const MARK = {
  name: 'Zq7NameMark',
  email: 'zq7email@zq7mail.example',
  subject: 'Zq7SubjectMark',
  message: 'Zq7MessageMark',
  title: 'Zq7TitleMark',
  text: 'Zq7TextMark',
  route: '/room/zq7-routemark',
  version: 'zq7version',
} as const

const ORIGIN = 'https://room.test'

test('a failed contact and a failed feedback export no message text, address, subject or route', async () => {
  const memory = memoryExporters()
  const env = parseEnv({ ...ENV, NODE_ENV: 'production', GIT_SHA: 'abcdef1234567890' })
  const telemetry = createApiTelemetry(env, { exporters: memory.exporters, lines: memory.line })
  const gateway = await startUpstream(await freePort(), 500)
  try {
    const app = createApp({
      build: { version: 'test', commit: 'test' },
      rooms: NO_ROOMS,
      stats: NO_STATS,
      messages: createMessages({
        gateway: { url: gateway.url, secret: 'zq7-gateway-secret' },
        door: { url: await deadUrl(await freePort()), secret: 'zq7-door-token' },
        now: Date.now,
        failed: (error, at) => telemetry.server.recordError(error, at, 'high'),
      }),
      origins: new Set([ORIGIN]),
      client: () => 'zq7-client',
      health: async () => 'ok',
    })
    const post = (path: string, body: unknown) =>
      app.handle(
        new Request(`http://localhost/api${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: ORIGIN },
          body: JSON.stringify(body),
        }),
      )
    const sentContact = await post('/contact', {
      name: MARK.name,
      email: MARK.email,
      subject: MARK.subject,
      message: MARK.message,
    })
    const sentFeedback = await post('/feedback', {
      title: MARK.title,
      text: MARK.text,
      version: MARK.version,
      route: MARK.route,
    })
    expect(sentContact.status).toBe(502)
    expect(sentFeedback.status).toBe(502)
  } finally {
    await gateway.stop()
  }

  const exported = await memory.exported(telemetry.server)
  const failures = exported.logs.map((log) => JSON.stringify(log))
  expect(failures.some((line) => line.includes('contact send failed'))).toBe(true)
  expect(failures.some((line) => line.includes('feedback send failed'))).toBe(true)
  expect(
    leaksIn(exported, [...Object.values(MARK), 'zq7-gateway-secret', 'zq7-door-token']),
  ).toEqual([])
})
