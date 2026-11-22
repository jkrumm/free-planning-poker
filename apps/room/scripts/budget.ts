/**
 * The entry's size budget (docs/v9/ARCHITECTURE.md, Client): the JavaScript the shell loads first, gzipped, is at most
 * 130 kB in the plain room and 180 kB in the finished one. Run after `vite build` by `make build`; a language's
 * catalogue chunks load on demand and are not part of the entry.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** The plain room's budget in bytes (kB are thousands, as Vite prints them). */
export const ENTRY_BUDGET = 130_000

const dist = join(import.meta.dirname, '../dist')

/** The files the shell loads at once: its module script and the chunks it preloads. */
export function entryFiles(shell: string): string[] {
  const names = [
    ...shell.matchAll(/<(?:script|link)[^>]*(?:src|href)="\/_room\/([^"]+\.js)"/g),
  ].map((match) => match[1] as string)
  return [...new Set(names)]
}

export function entrySize(directory: string): { files: string[]; gzip: number } {
  const files = entryFiles(readFileSync(join(directory, 'index.html'), 'utf8'))
  const gzip = files.reduce(
    (sum, file) => sum + Bun.gzipSync(readFileSync(join(directory, file)), { level: 9 }).length,
    0,
  )
  return { files, gzip }
}

if (import.meta.main) {
  if (!existsSync(join(dist, 'index.html'))) throw new Error('apps/room/dist is not built')
  const { files, gzip } = entrySize(dist)
  console.log(`entry ${files.join(', ')}: ${gzip} bytes gzip (budget ${ENTRY_BUDGET})`)
  if (gzip > ENTRY_BUDGET) {
    console.error('the entry is over its budget')
    process.exit(1)
  }
}
