import { expect, test } from 'bun:test'
import { createRateLimit } from './rate-limit.ts'

const MINUTE = 60_000

test('the fourth submission of one client within the window waits for the first to leave it', () => {
  let now = 0
  const limit = createRateLimit({ now: () => now })
  expect(limit.take('a')).toBeUndefined()
  now += MINUTE
  expect(limit.take('a')).toBeUndefined()
  now += MINUTE
  expect(limit.take('a')).toBeUndefined()
  now += MINUTE
  // The first was at 0; the window is 10 minutes and it is now minute 3.
  expect(limit.take('a')).toBe(7 * 60)
  expect(limit.take('b')).toBeUndefined()
  now = 10 * MINUTE
  expect(limit.take('a')).toBeUndefined()
})

test('a refused attempt is not counted, so waiting out the answer is enough', () => {
  let now = 0
  const limit = createRateLimit({ now: () => now, perClient: 1 })
  expect(limit.take('a')).toBeUndefined()
  expect(limit.take('a')).toBe(600)
  now = 600_000
  expect(limit.take('a')).toBeUndefined()
})

test('thirty submissions overall in the window stop every client, whoever sent them', () => {
  const limit = createRateLimit({ now: () => 0 })
  for (let index = 0; index < 30; index++) expect(limit.take(`client-${index}`)).toBeUndefined()
  expect(limit.take('someone-new')).toBe(600)
})

test('a client that never returns leaves nothing behind once its window has passed', () => {
  let now = 0
  const limit = createRateLimit({ now: () => now, overall: 1 })
  expect(limit.take('gone')).toBeUndefined()
  now = 11 * MINUTE
  expect(limit.take('next')).toBeUndefined()
  // Only 'next' counts toward the overall cap now: 'gone' was swept.
  expect(limit.take('third')).toBe(600)
})
