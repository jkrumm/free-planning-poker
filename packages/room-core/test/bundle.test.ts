/**
 * What a browser bundle holds: the types entry ships no validator, and the client entries ship none of the room's
 * rules. Each test builds the entries with Bun's bundler, unminified, and reads the output.
 */
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

const SRC = join(import.meta.dir, '..', 'src')

async function bundle(...entries: string[]): Promise<string> {
  const built = await Bun.build({
    entrypoints: entries.map((entry) => join(SRC, entry)),
    target: 'browser',
    minify: false,
  })
  if (!built.success) throw new AggregateError(built.logs, 'bundle failed')
  const texts = await Promise.all(built.outputs.map((output) => output.text()))
  return texts.join('\n')
}

/** The room's rules and the runtime by the names they are defined under. */
const SERVER_ONLY = [
  /\bfunction decide\w*\s*\(/,
  /\bfunction step\s*\(/,
  /\bfunction followPoker\s*\(/,
  /\bfunction project\s*\(/,
  /\bcreateRoomRuntime\b/,
]

describe('bundles', () => {
  test('the types entry contains no zod', async () => {
    const text = await bundle('types.entry.ts')
    expect(text.length).toBeGreaterThan(0)
    expect(text.toLowerCase()).not.toContain('zod')
  })

  test('the view entry contains no zod', async () => {
    expect((await bundle('view.entry.ts')).toLowerCase()).not.toContain('zod')
  })

  test('the protocol and view entries together hold neither decide nor the runtime', async () => {
    const text = await bundle('protocol.entry.ts', 'view.entry.ts')
    expect(text).toContain('evolveView')
    for (const pattern of SERVER_ONLY) expect(text).not.toMatch(pattern)
  })

  test('the check sees decide where it is: the server entry', async () => {
    const text = await bundle('server.entry.ts')
    expect(text).toMatch(/\bfunction decide\w*\s*\(/)
    expect(text).toMatch(/\bfunction step\s*\(/)
  })
})
