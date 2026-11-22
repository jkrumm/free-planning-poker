/**
 * The room app, served by the API that carries its server (docs/v9/ARCHITECTURE.md, Topology): `/room` and
 * `/room/*` answer the shell, `/_room/*` the built files. A hashed file never changes, so it is cached for good;
 * the shell names the current hashes, so it is never cached. Everything else is not this module's.
 */
import { existsSync } from 'node:fs'
import { join, normalize, resolve, sep } from 'node:path'

export type Spa = (request: Request) => Promise<Response | undefined>

export const ASSET_PREFIX = '/_room/'
const SHELL = /^\/room(\/.*)?$/

/** Vite's names carry a hash of the content: `index-DQEltZwA.js`. */
const HASHED = /-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/

const IMMUTABLE = 'public, max-age=31536000, immutable'

const notFound = () =>
  new Response('not found', { status: 404, headers: { 'cache-control': 'no-store' } })

/** The built app in `dir` as a request handler, or undefined where no build is there. */
export function createSpa(dir: string): Spa | undefined {
  // Absolute and without a trailing separator, whatever the operator wrote in ROOM_APP_DIR.
  const base = resolve(dir)
  const shell = join(base, 'index.html')
  if (!existsSync(shell)) return undefined
  const root = base + sep
  return async (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return undefined
    const { pathname } = new URL(request.url)
    if (SHELL.test(pathname)) {
      return new Response(request.method === 'HEAD' ? null : Bun.file(shell), {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-cache',
          'content-security-policy': "frame-ancestors 'none'",
          'x-content-type-options': 'nosniff',
        },
      })
    }
    if (!pathname.startsWith(ASSET_PREFIX)) return undefined
    const name = safeDecode(pathname.slice(ASSET_PREFIX.length))
    if (name === undefined) return notFound()
    const path = normalize(join(base, name))
    if (!path.startsWith(root)) return notFound()
    const file = Bun.file(path)
    if (!(await file.exists())) return notFound()
    return new Response(request.method === 'HEAD' ? null : file, {
      headers: {
        'content-type': file.type,
        'cache-control': HASHED.test(path) ? IMMUTABLE : 'no-cache',
        'x-content-type-options': 'nosniff',
      },
    })
  }
}

/** The decoded path, or undefined for a bad escape or a null byte (no file has either). */
function safeDecode(text: string): string | undefined {
  try {
    const decoded = decodeURIComponent(text)
    return decoded.includes('\0') ? undefined : decoded
  } catch {
    return undefined
  }
}
