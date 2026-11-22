import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseTopicLine, parseTopicLines } from '../src/paste.ts'

type Case = { case: string; line: string; topic: unknown }
const CASES: Case[] = JSON.parse(
  readFileSync(join(import.meta.dir, '..', 'fixtures', 'paste.json'), 'utf8'),
)

describe('paste parser fixtures', () => {
  test.each(CASES)('$case', ({ line, topic }) => {
    expect(parseTopicLine(line) ?? null).toEqual(topic as never)
  })

  test('the fixtures hold a key, a link of Jira, Linear, GitHub and Azure DevOps, and plain text', () => {
    const sources = CASES.map(
      (c) => (c.topic as { ref?: { source: string | null } } | null)?.ref?.source,
    )
    for (const source of ['jira', 'linear', 'github', 'azure-devops'])
      expect(sources).toContain(source)
    expect(CASES.some((c) => c.case === 'a leading ticket key')).toBe(true)
    expect(CASES.some((c) => c.case === 'plain text')).toBe(true)
  })
})

describe('parseTopicLines', () => {
  test('one topic per non-empty line, in order', () => {
    const topics = parseTopicLines('SHOP-1 One\r\n\n  \nhttps://github.com/a/b/issues/2\nThree')
    expect(topics.map((t) => t.title)).toEqual(['One', 'a/b#2', 'Three'])
  })

  test('at most 200 topics', () => {
    const text = Array.from({ length: 250 }, (_, i) => `Topic ${i}`).join('\n')
    expect(parseTopicLines(text)).toHaveLength(200)
  })

  test('a title is cut at 300 characters', () => {
    expect(parseTopicLine('x'.repeat(400))?.title).toHaveLength(300)
  })
})
