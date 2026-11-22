import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { listFiles, outputRoot, readText } from './output.ts'

const origin = 'https://free-planning-poker.com'
const contentDir = join(import.meta.dir, '..', 'src', 'content', 'glossary')

// The entries of the real glossary: id, title and whether it is still a draft.
const entries = readdirSync(contentDir)
  .filter((file) => file.endsWith('.md'))
  .map((file) => {
    const text = readFileSync(join(contentDir, file), 'utf8')
    return {
      id: file.replace(/\.md$/, ''),
      title: /^title: (.*)$/m.exec(text)?.[1] ?? '',
      draft: /^draft: true$/m.test(text),
    }
  })
const published = entries.filter((entry) => !entry.draft)

type Block = Record<string, unknown>

/** The DefinedTerm and DefinedTermSet blocks of a page, parsed: the other types are schema.test.ts's. */
function blocksOf(html: string): Block[] {
  return [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1] ?? '') as Block)
    .filter((block) => String(block['@type']).startsWith('DefinedTerm'))
}

// Required properties, from https://schema.org/DefinedTerm and https://schema.org/DefinedTermSet (read 2026-11-22):
// a DefinedTerm has a name, a description, a url and the set it is in; a DefinedTermSet has a name, a url and
// hasDefinedTerm. Both are things, so name is the one property schema.org's own examples never omit.
function expectValidTerm(block: Block, id: string, title: string) {
  expect(block['@context']).toBe('https://schema.org')
  expect(block['@type']).toBe('DefinedTerm')
  expect(block.name).toBe(title)
  expect(String(block.description).length).toBeGreaterThan(20)
  expect(block.url).toBe(`${origin}/glossary/${id}`)
  expect(block.inDefinedTermSet).toBe(`${origin}/glossary`)
}

describe('beta build: every term, drafts included', () => {
  const root = outputRoot('beta')

  test('the index and one page per term are built', async () => {
    const files = await listFiles(root)
    expect(files).toContain('glossary.html')
    for (const entry of entries) expect(files).toContain(`glossary/${entry.id}.html`)
    expect(
      files.filter((file) => file.startsWith('glossary/') && file.endsWith('.html')),
    ).toHaveLength(entries.length)
  })

  test.each(entries)('$id carries one valid DefinedTerm block', async (entry) => {
    const html = await readText(root, `glossary/${entry.id}.html`)
    const blocks = blocksOf(html)
    expect(blocks).toHaveLength(1)
    expectValidTerm(blocks[0] ?? {}, entry.id, entry.title)
  })

  test('the index carries one DefinedTermSet that lists every term', async () => {
    const blocks = blocksOf(await readText(root, 'glossary.html'))
    expect(blocks).toHaveLength(1)
    const set = blocks[0] ?? {}
    expect(set['@type']).toBe('DefinedTermSet')
    expect(set.name).toBe('Glossary')
    expect(set.url).toBe(`${origin}/glossary`)
    const listed = set.hasDefinedTerm as Block[]
    expect(listed.map((term) => term.name)).toEqual(
      entries.map((entry) => entry.title).toSorted((a, b) => a.localeCompare(b, 'en')),
    )
    for (const term of listed) {
      expect(term['@type']).toBe('DefinedTerm')
      expect(String(term.url)).toStartWith(`${origin}/glossary/`)
    }
  })

  test('the index lists the terms alphabetically', async () => {
    const html = await readText(root, 'glossary.html')
    const order = [...html.matchAll(/<dt>\s*<a href="\/glossary\/([^"]+)"/g)].map(
      (match) => match[1],
    )
    const alphabetical = entries
      .toSorted((a, b) => a.title.localeCompare(b.title, 'en'))
      .map((entry) => entry.id)
    expect(order).toEqual(alphabetical)
  })

  test.each(entries)('$id links the pillar guide and a related term', async (entry) => {
    const html = await readText(root, `glossary/${entry.id}.html`)
    expect(html).toContain('href="/guide"')
    expect(html).toMatch(/<nav aria-label="Related terms">[\s\S]*<a href="\/glossary\//)
  })

  test('the pillar guide links its terms in a list below the text', async () => {
    const guide = await readText(root, 'guide.html')
    for (const id of [
      'planning-poker',
      'story-points',
      'fibonacci-sequence',
      'sprint-planning',
      'velocity',
    ])
      expect(guide).toContain(`href="/glossary/${id}"`)
  })
})

describe('production build: only what is published', () => {
  const root = outputRoot('production')

  test('no path under /glossary exists while every entry is a draft', async () => {
    const files = await listFiles(root)
    const glossary = files.filter(
      (file) => file === 'glossary.html' || file.startsWith('glossary/'),
    )
    if (published.length === 0) expect(glossary).toEqual([])
    else
      expect(glossary.toSorted()).toEqual(
        ['glossary.html', ...published.map((entry) => `glossary/${entry.id}.html`)].toSorted(),
      )
  })

  test('no production file links or names a draft term', async () => {
    const drafts = entries.filter((entry) => entry.draft)
    for (const rel of await listFiles(root)) {
      const text = await readText(root, rel)
      for (const entry of drafts) expect(text).not.toContain(`/glossary/${entry.id}`)
    }
  })

  test.each(published)('$id carries one valid DefinedTerm block', async (entry) => {
    const blocks = blocksOf(await readText(root, `glossary/${entry.id}.html`))
    expect(blocks).toHaveLength(1)
    expectValidTerm(blocks[0] ?? {}, entry.id, entry.title)
  })
})
