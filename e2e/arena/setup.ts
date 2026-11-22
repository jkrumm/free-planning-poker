/**
 * Serves the built gallery (apps/arena/dist) on a port the system picks, for the whole run, and names it in
 * ARENA_URL for the tests. Fails at once when the gallery is not built or the entry is not named.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join, normalize, resolve } from 'node:path'

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

export default async function setup(): Promise<() => Promise<void>> {
  const dist = resolve(import.meta.dirname, '../../apps/arena/dist')
  if (!existsSync(join(dist, 'index.html')))
    throw new Error('apps/arena/dist is missing: run make arena first')
  if (!/^[a-z0-9][a-z0-9-]*$/.test(process.env['ARENA_ENTRY'] ?? ''))
    throw new Error('ARENA_ENTRY names no entry: run make arena-score ENTRY=<name>')
  const server = createServer((request, response) => {
    const path = normalize(
      join(dist, decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/')),
    )
    const file =
      path.startsWith(dist) && existsSync(path) && statSync(path).isFile()
        ? path
        : join(dist, 'index.html')
    response.setHeader('content-type', TYPES[extname(file)] ?? 'application/octet-stream')
    response.end(readFileSync(file))
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  process.env['ARENA_URL'] = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
  return () => new Promise<void>((done) => server.close(() => done()))
}
