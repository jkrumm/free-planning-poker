import { expect, test } from 'bun:test'
import { createApp } from './app.ts'

test('GET /api/health answers ok', async () => {
  const app = createApp({ build: { version: '9.0.0', commit: 'abc123' } })
  const response = await app.handle(new Request('http://localhost/api/health'))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ status: 'ok' })
})
