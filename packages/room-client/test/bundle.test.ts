/**
 * What a browser downloads of the client (docs/plan.yaml, v9-room-client, acceptance 5): the built entry, minified, is
 * at most 12 kB gzipped and holds no validator. The bots are a separate entry and are not in it.
 */
import { expect, test } from 'bun:test'
import { join } from 'node:path'

const LIMIT = 12 * 1024

async function built(entry: string) {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, '..', 'src', entry)],
    target: 'browser',
    minify: true,
  })
  if (!result.success) throw new AggregateError(result.logs, 'bundle failed')
  const text = (await Promise.all(result.outputs.map((output) => output.text()))).join('\n')
  return { text, gzip: Bun.gzipSync(text).length }
}

test('the entry is at most 12 kB gzipped and contains no zod', async () => {
  const { text, gzip } = await built('index.ts')
  console.log(
    `@fpp/room-client entry: ${text.length} bytes minified, ${gzip} bytes gzipped (limit ${LIMIT})`,
  )
  expect(text.toLowerCase()).not.toContain('zod')
  expect(gzip).toBeLessThanOrEqual(LIMIT)
})

test("the entry holds none of the room's rules", async () => {
  const { text } = await built('index.ts')
  for (const name of ['createRoomRuntime', 'decidePoker', 'project('])
    expect(text).not.toContain(name)
})
