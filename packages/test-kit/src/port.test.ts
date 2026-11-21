import { expect, test } from 'bun:test'
import { createServer } from 'node:net'
import { freePort } from './port.ts'

test('freePort returns a port that can be bound', async () => {
  const port = await freePort()
  expect(Number.isInteger(port)).toBe(true)
  expect(port).toBeGreaterThan(0)
  expect(port).toBeLessThan(65536)

  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

test('freePort hands out different ports to concurrent callers', async () => {
  const ports = await Promise.all(Array.from({ length: 8 }, () => freePort()))
  expect(new Set(ports).size).toBeGreaterThan(1)
})
