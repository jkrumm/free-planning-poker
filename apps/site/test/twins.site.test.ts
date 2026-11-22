import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { listFiles, metaOf, outputRoot, readText, realOutputs } from './output.ts'

const pillarFile = join(import.meta.dir, '..', 'src', 'content', 'pillar', 'guide.md')
const pillar = readFileSync(pillarFile, 'utf8')
const pillarBody = pillar.replace(/^---\n[\s\S]*?\n---\n/, '')
const pillarDescription = /^description: "(.*)"$/m.exec(pillar)?.[1]

// What the page adds below the Markdown: the lists of linked pages and the questions.
const addedHeadings = ['Go deeper', 'Related terms', 'Questions']

describe.each(realOutputs)('the /guide twin, build %s', (output) => {
  test('sits at /guide.md with its address and updated date', async () => {
    const twin = await readText(outputRoot(output), 'guide.md')
    expect(twin).toContain('Address: https://free-planning-poker.com/guide\n')
    expect(twin).toContain('Updated: 2026-11-22\n')
  })

  test('holds the Markdown of the pillar, and the page holds the same headings in the same order', async () => {
    const twin = await readText(outputRoot(output), 'guide.md')
    expect(twin).toContain(pillarBody.trim())
    const html = await readText(outputRoot(output), 'guide.html')
    const pageHeadings = [...html.matchAll(/<h([1-3])[^>]*>([^<]*)<\/h\1>/g)].map(
      (match) => match[2] ?? '',
    )
    const twinHeadings = pillarBody
      .split('\n')
      .filter((line) => /^#{1,3} /.test(line))
      .map((line) => line.replace(/^#{1,3} /, ''))
    expect(pageHeadings.slice(0, twinHeadings.length)).toEqual(twinHeadings)
    const added = pageHeadings.slice(twinHeadings.length)
    expect(added.at(-1)).toBe('Questions')
    for (const heading of added) expect(addedHeadings).toContain(heading)
  })

  test('has the description of the page', async () => {
    const html = await readText(outputRoot(output), 'guide.html')
    expect(metaOf(html, 'description')).toBe(pillarDescription)
  })
})

describe('content twins over the fixture content', () => {
  test('a published entry has its twin: title, address, updated date and its Markdown', async () => {
    const root = outputRoot('fixture-production')
    expect(await listFiles(root)).toContain('guides/published-guide.md')
    const twin = await readText(root, 'guides/published-guide.md')
    expect(twin).toContain(
      '# Published guide\n\nAddress: https://free-planning-poker.com/guides/published-guide\nUpdated: 2026-11-01\n',
    )
    expect(twin).toContain('A *published* page with <em>inline</em> text.')
  })
})
