import { expect, test } from 'bun:test'
import { csvOfSummary, markdownOfSummary } from './history.format.ts'
import type { SummaryBody, SummaryTopic } from './history.ts'

const topic = (title: string | null, change: Partial<SummaryTopic> = {}): SummaryTopic => ({
  id: '019a9c1e-0000-7000-8000-000000000001',
  position: 0,
  title,
  url: null,
  state: 'done',
  final: { label: '5', value: 5, decidedBy: 'agreed' },
  open: false,
  leading: { label: '5', value: 5, count: 2 },
  spread: { lowest: 5, highest: 5 },
  rounds: 1,
  durationSeconds: 61,
  ...change,
})

const body = (...topics: SummaryTopic[]): SummaryBody => ({
  room: { slug: 'team-alpha', name: 'Team Alpha' },
  topics,
  totals: { topics: topics.length, decided: 1, rounds: 1, durationSeconds: 61, points: 5 },
})

const dataLine = (title: string | null) => {
  const lines = csvOfSummary(body(topic(title))).split('\r\n')
  return lines[1] ?? ''
}

test('a text cell a spreadsheet would run as a formula starts with an apostrophe', () => {
  for (const title of ['=1+1', '+1', '-1', '@SUM(A1)', '\tcmd'])
    expect(dataLine(title)).toContain(`,'${title},`)
  expect(dataLine('\rcmd')).toContain(',"\'\rcmd",')
  expect(dataLine('plain - dash')).toContain(',plain - dash,')
})

test('a number is never changed, a minus sign included; its label is text and is', () => {
  const line = csvOfSummary(
    body(topic('x', { final: { label: '-1', value: -1, decidedBy: 'settled' } })),
  ).split('\r\n')[1]
  expect(line).toContain(",'-1,-1,settled,")
})

test('a field with a comma, a quote or a line break is quoted, and its quotes are doubled', () => {
  expect(dataLine('a, "b"')).toContain(',"a, ""b""",')
  expect(dataLine('two\nlines')).toContain(',"two\nlines",')
  expect(dataLine(null)).toContain(',,')
})

test('lines end in CRLF, the last one too', () => {
  expect(csvOfSummary(body()).endsWith('\r\n')).toBe(true)
})

test('a Markdown cell holds no pipe and no line break', () => {
  const text = markdownOfSummary(body(topic('a | b\nc \\ d')))
  expect(text).toContain('| a \\| b c \\\\ d | 5 | 5 | 1 | 1m 1s |')
})
