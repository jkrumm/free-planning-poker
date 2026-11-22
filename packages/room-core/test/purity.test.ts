/**
 * The core is pure (invariant 9, rule pure-core.md): no file under src outside sim/ names the clock, chance, a timer,
 * a socket or the network. scripts/boundaries.ts checks the same with a wider list across every pure module; this
 * test holds the core to it on its own.
 */
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(import.meta.dir, '..', 'src')
const FORBIDDEN = ['Date.now', 'Math.random', 'setTimeout', 'setInterval', 'WebSocket', 'fetch']

/** The forbidden names a source text holds, comments included. */
export function impurities(text: string): string[] {
  return FORBIDDEN.filter((name) =>
    new RegExp(`(^|[^\\w$])${name.replace('.', '\\.')}(?![\\w$])`).test(text),
  )
}

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'sim' ? [] : files(path)
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

describe('purity', () => {
  test('no file under src outside sim/ names a clock, chance, a timer, a socket or fetch', () => {
    const found = files(SRC).flatMap((path) =>
      impurities(readFileSync(path, 'utf8')).map((name) => `${relative(SRC, path)}: ${name}`),
    )
    expect(found).toEqual([])
  })

  test('the scan finds each name it looks for', () => {
    for (const name of FORBIDDEN) expect(impurities(`const x = ${name}(1)`)).toEqual([name])
    expect(impurities('const prefetch = 1; const fetched = 2')).toEqual([])
  })
})
