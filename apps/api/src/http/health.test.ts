import { expect, test } from 'bun:test'
import { NO_ROOMS } from '../../test/support.ts'
import { createApp, type Health } from './app.ts'

const app = (health: Health) =>
  createApp({
    build: { version: '9.0.0', commit: 'abc123' },
    rooms: NO_ROOMS,
    health: async () => health,
  })

test('GET /api/health answers ok, and degraded while Postgres is away', async () => {
  const ok = await app('ok').handle(new Request('http://localhost/api/health'))
  expect(ok.status).toBe(200)
  expect(await ok.json()).toEqual({ status: 'ok' })
  const degraded = await app('degraded').handle(new Request('http://localhost/api/health'))
  expect(degraded.status).toBe(200)
  expect(await degraded.json()).toEqual({ status: 'degraded' })
})
