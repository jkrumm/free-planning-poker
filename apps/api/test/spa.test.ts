/**
 * The API serves the room app (docs/v9/ARCHITECTURE.md, Topology): the shell at `/room` and `/room/<slug>`, never
 * cached; hashed files under `/_room/`, cached for good; nothing outside the build. A fixture build stands in for
 * `apps/room/dist`, so the test needs no build and no database.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { freePort } from '@fpp/test-kit/port'
import { createSpa } from '../src/http/spa.ts'
import { startServer, type Started } from './contract/harness.ts'

const SHELL =
  '<!doctype html><title>shell</title><script type="module" src="/_room/assets/index-AbCd1234.js"></script>'
let dir = ''
let server: Started
let base = ''

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'fpp-room-'))
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'index.html'), SHELL)
  writeFileSync(join(dir, 'assets', 'index-AbCd1234.js'), 'export const room = 1')
  writeFileSync(join(dir, 'sw.js'), 'self.skipWaiting()')
  writeFileSync(join(dir, '..secret'), 'no')
  // A trailing separator in the directory, as an operator may write it, serves as well.
  const spa = createSpa(`${dir}/`)
  if (spa === undefined) throw new Error('the fixture build has no shell')
  const port = await freePort()
  server = await startServer('bun', port, { spa })
  base = `http://127.0.0.1:${port}`
})

afterAll(async () => {
  await server.stop()
  rmSync(dir, { recursive: true, force: true })
})

test('a room address answers the shell, which is never cached', async () => {
  for (const path of ['/room', '/room/', '/room/abc', '/room/new', '/room/team-alpha?embed=1']) {
    const response = await fetch(base + path)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-cache')
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(response.headers.get('content-security-policy')).toBe("frame-ancestors 'none'")
    expect(await response.text()).toBe(SHELL)
  }
})

test('a hashed file is cached as immutable, a file without a hash is not', async () => {
  const hashed = await fetch(`${base}/_room/assets/index-AbCd1234.js`)
  expect(hashed.status).toBe(200)
  expect(hashed.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
  expect(hashed.headers.get('content-type')).toContain('javascript')
  expect(await hashed.text()).toBe('export const room = 1')
  const plain = await fetch(`${base}/_room/sw.js`)
  expect(plain.status).toBe(200)
  expect(plain.headers.get('cache-control')).toBe('no-cache')
})

test('a file the build does not hold is a 404, and nothing outside the build is served', async () => {
  expect((await fetch(`${base}/_room/assets/missing-AbCd1234.js`)).status).toBe(404)
  expect((await fetch(`${base}/_room/%2e%2e/%2e%2e/etc/hosts`)).status).toBe(404)
  expect((await fetch(`${base}/_room/..%2fsecret`)).status).toBe(404)
  expect((await fetch(`${base}/_room/%00`)).status).toBe(404)
  expect((await fetch(`${base}/_room/%E0%A4%A`)).status).toBe(404)
})

test('other paths are left to the API, and a write to a room address is not the shell', async () => {
  expect((await fetch(`${base}/api/health`)).status).toBe(200)
  expect((await fetch(`${base}/roomy`)).status).toBe(404)
  const post = await fetch(`${base}/room/abc`, { method: 'POST' })
  expect(post.status).toBe(404)
})
