import { expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { guideClusters } from './entry-schema.ts'

// The real glossary the site builds, read from disk: the content tests need no build.
const dir = join(import.meta.dir, '..', 'content', 'glossary')

type Term = {
  id: string
  title: string
  description: string
  published: Date
  updated: Date | undefined
  guide: string | undefined
  related: string[]
  body: string
}

function parse(file: string): Term {
  const text = readFileSync(join(dir, file), 'utf8')
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text)
  if (!match) throw new Error(`${file}: no frontmatter`)
  const data = Bun.YAML.parse(match[1] ?? '') as Record<string, unknown>
  return {
    id: file.replace(/\.md$/, ''),
    title: String(data.title),
    description: String(data.description),
    published: new Date(String(data.published)),
    updated: data.updated === undefined ? undefined : new Date(String(data.updated)),
    guide: data.guide === undefined ? undefined : String(data.guide),
    related: (data.related as string[] | undefined) ?? [],
    body: match[2] ?? '',
  }
}

const terms = readdirSync(dir)
  .filter((file) => file.endsWith('.md'))
  .toSorted()
  .map(parse)

/** The first sentence of the body: up to the first full stop followed by a space or the end of the line. */
export const firstSentence = (body: string) => /^[\s\S]*?\.(?=\s|$)/.exec(body.trim())?.[0] ?? ''

test('the glossary holds at most fifteen terms', () => {
  expect(terms.length).toBeGreaterThan(0)
  expect(terms.length).toBeLessThanOrEqual(15)
})

test.each(terms)('$id: the first sentence holds the term', (term) => {
  expect(firstSentence(term.body).toLowerCase()).toContain(term.title.toLowerCase())
})

test.each(terms)('$id: a description, dates, a cluster page and sources', (term) => {
  expect(term.description.length).toBeGreaterThan(40)
  expect(term.description.length).toBeLessThanOrEqual(200)
  expect(term.updated).toBeDefined()
  expect(term.updated!.getTime()).toBeGreaterThanOrEqual(term.published.getTime())
  expect(guideClusters as readonly string[]).toContain(term.guide ?? '')
  const sources = term.body.split('## Sources')[1] ?? ''
  expect(sources).toMatch(/Read on \d{4}-\d{2}-\d{2}\./)
  expect(sources).toMatch(/\]\(https:\/\/[^)]+\)/)
})

test.each(terms)('$id: related terms exist, are not itself and are not repeated', (term) => {
  const ids = terms.map((other) => other.id)
  expect(term.related.length).toBeGreaterThan(0)
  expect(new Set(term.related).size).toBe(term.related.length)
  for (const id of term.related) {
    expect(id).not.toBe(term.id)
    expect(ids).toContain(id)
  }
})

test('every term the pillar guide lists is a term of the glossary', () => {
  // The pillar is Markdown, which carries no component: guide.astro lists the terms under the text.
  const guide = readFileSync(join(import.meta.dir, '..', 'pages', 'guide.astro'), 'utf8')
  const listed = /const terms = \[([^\]]*)\]/.exec(guide)?.[1]
  expect(listed).toBeDefined()
  const ids = terms.map((term) => term.id)
  for (const match of (listed ?? '').matchAll(/'([^']+)'/g)) expect(ids).toContain(match[1] ?? '')
})
