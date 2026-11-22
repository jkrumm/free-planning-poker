/**
 * The arena's build: the gallery with every entry under arena/entries, React deduplicated so an entry resolves the
 * same React as the gallery, and the scorecards under arena/scores served at /scores for `vite preview`.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Connect, type Plugin } from 'vite'

const root = resolve(import.meta.dirname, '../..')
const scores = join(root, 'arena/scores')

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webm': 'video/webm',
}

/** Sends the file under arena/scores a /scores/ URL names; false when it names none. */
const handle = (url: string | undefined, send: (type: string, body: Buffer) => void): boolean => {
  if (url === undefined || !url.startsWith('/scores/')) return false
  const path = normalize(
    join(scores, decodeURIComponent(url.slice('/scores/'.length).split('?')[0] ?? '')),
  )
  if (!path.startsWith(scores) || !existsSync(path) || !statSync(path).isFile()) return false
  send(TYPES[extname(path)] ?? 'application/octet-stream', readFileSync(path))
  return true
}

const middleware: Connect.NextHandleFunction = (request, response, next) => {
  const sent = handle(request.url, (type, body) => {
    response.setHeader('content-type', type)
    response.end(body)
  })
  if (!sent) next()
}

/** Serves arena/scores at /scores in the dev server and in `vite preview`. */
function serveScores(): Plugin {
  return {
    name: 'arena-scores',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), serveScores()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { fs: { allow: [root] } },
  build: { outDir: 'dist', emptyOutDir: true },
})
