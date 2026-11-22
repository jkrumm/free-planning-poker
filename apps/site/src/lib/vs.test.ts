import { expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { vsAhead, vsSchema, type VsData } from './entry-schema.ts'
import { sourceLabel, vsTwinFacts } from './vs.ts'

// The real comparison pages the site builds, read from disk: the content tests need no build.
const dir = join(import.meta.dir, '..', 'content', 'vs')

type Page = { id: string; data: VsData; body: string }

function parse(file: string): Page {
  const text = readFileSync(join(dir, file), 'utf8')
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text)
  if (!match) throw new Error(`${file}: no frontmatter`)
  // vsSchema is the schema the build validates with, so a page that fails here fails the build too.
  const data = vsSchema.parse(Bun.YAML.parse(match[1] ?? ''))
  return { id: file.replace(/\.md$/, ''), data, body: match[2] ?? '' }
}

const pages = readdirSync(dir)
  .filter((file) => file.endsWith('.md'))
  .toSorted()
  .map(parse)

const day = (date: Date) => date.toISOString().slice(0, 10)
const rows = pages.flatMap((page) => page.data.facts.map((fact) => ({ id: page.id, fact })))

test('the collection holds between one and five comparisons', () => {
  expect(pages.length).toBeGreaterThan(0)
  expect(pages.length).toBeLessThanOrEqual(5)
})

test('every row of every table has a source address and the day it was read', () => {
  expect(rows.length).toBeGreaterThan(0)
  for (const { id, fact } of rows) {
    expect(fact.source, `${id}: ${fact.topic}`).toMatch(/^https:\/\/[^\s]+$/)
    expect(Number.isNaN(fact.read.getTime()), `${id}: ${fact.topic}`).toBe(false)
    expect(fact.claim.trim().length, `${id}: ${fact.topic}`).toBeGreaterThan(0)
    expect(vsAhead as readonly string[]).toContain(fact.ahead)
  }
})

test.each(pages)('$id: every source is a page of the tool itself', ({ data }) => {
  for (const fact of data.facts)
    expect(
      data.tool.origins.some((origin) => fact.source.startsWith(origin)),
      `${fact.topic}: ${fact.source}`,
    ).toBe(true)
})

test.each(pages)('$id: the checked day is the newest day a fact was read', ({ data }) => {
  const newest = Math.max(...data.facts.map((fact) => fact.read.getTime()))
  expect(day(data.checked)).toBe(day(new Date(newest)))
  expect(data.updated).toBeDefined()
  expect(data.updated!.getTime()).toBeGreaterThanOrEqual(data.checked.getTime())
})

test.each(pages)(
  '$id: a draft until the owner has read it, with questions and a description',
  ({ data }) => {
    // The owner removes draft: true to publish; this fails only if a page was ever published by accident in a row.
    expect(data.description.length).toBeGreaterThan(40)
    expect(data.questions.length).toBeGreaterThan(0)
    expect(data.published.getTime()).toBeLessThanOrEqual(data.checked.getTime())
  },
)

test.each(pages)(
  '$id: says plainly where the other tool is better, and names no logo or image',
  ({ data, body }) => {
    expect(body).toContain(`## Where ${data.tool.name} is better`)
    expect(body).toContain('## Where Free Planning Poker is better')
    expect(data.facts.some((fact) => fact.ahead === 'them')).toBe(true)
    expect(body).not.toMatch(/!\[/)
    expect(body).not.toMatch(/<img/i)
  },
)

test('no affiliate or tracking parameter in a source', () => {
  for (const { fact } of rows) expect(new URL(fact.source).search).toBe('')
})

test('the Markdown twin lists every fact with its day and source', () => {
  const page = pages[0]!
  const twin = vsTwinFacts(page.data)
  for (const fact of page.data.facts) {
    expect(twin).toContain(fact.topic)
    expect(twin).toContain(`Read on ${day(fact.read)}: ${fact.source}`)
  }
})

test('a source address reads as host and path', () => {
  expect(sourceLabel('https://kollabe.com/pricing')).toBe('kollabe.com/pricing')
  expect(sourceLabel('https://planitpoker.com/pricing/')).toBe('planitpoker.com/pricing')
})
