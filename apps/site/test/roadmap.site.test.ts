import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { next } from '../src/data/next.ts'
import { parseChangelog } from '../src/lib/changelog.ts'
import { outputRoot, readText, realOutputs } from './output.ts'

const newest =
  parseChangelog(readFileSync(new URL('../../../CHANGELOG.md', import.meta.url), 'utf8'))[0]
    ?.version ?? ''

describe.each(realOutputs)('roadmap, build %s', (output) => {
  test('names the newest release of CHANGELOG.md as a heading', async () => {
    expect(newest).not.toBe('')
    expect(await readText(outputRoot(output), 'roadmap.html')).toContain(`>${newest}<`)
  })

  test('ships no script element but its structured data', async () => {
    const html = await readText(outputRoot(output), 'roadmap.html')
    expect(
      html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, ''),
    ).not.toContain('<script')
  })

  test('names every item of next.ts with its sentence', async () => {
    const html = await readText(outputRoot(output), 'roadmap.html')
    for (const item of next) {
      expect(html).toContain(item.title)
      expect(html).toContain(item.summary)
    }
  })
})
