import { expect, test } from 'bun:test'
import { createApp } from './app.ts'

test('GET /api/version names the running build', async () => {
  const app = createApp({ build: { version: '9.0.0', commit: 'abc123' } })
  const response = await app.handle(new Request('http://localhost/api/version'))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ version: '9.0.0', commit: 'abc123' })
})
