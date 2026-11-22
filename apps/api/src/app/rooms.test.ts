import { expect, test } from 'bun:test'
import { bearer } from '../http/rooms.ts'
import { drawNumbers, parseName } from './rooms.ts'

test('a name follows the rule exactly as typed, and is never a number', () => {
  for (const name of ['team-alpha', 'abc', 'a1b', 'x'.repeat(30), 'sprint-42'])
    expect(parseName(name)).toBe(name as never)
  for (const name of ['Team-Alpha', ' abc', 'ab', 'x'.repeat(31), '123456', '1234', 'a b', 'café'])
    expect(parseName(name)).toBeUndefined()
})

test('drawn numbers have six digits, and four bytes past the last full range are drawn again', () => {
  const batches = [
    [0xff, 0xff, 0xff, 0xff],
    [0, 0, 0, 0],
    [0, 0, 0, 1],
  ]
  const numbers = drawNumbers(() => new Uint8Array(batches.shift() ?? [0, 0, 0, 2]), 3)
  expect(numbers).toEqual(['100000', '100001', '100002'])
})

test('a seat token is read from a Bearer header only', () => {
  expect(bearer('Bearer abc_DEF-123')).toBe('abc_DEF-123')
  for (const header of [undefined, '', 'Basic abc', 'Bearer ', 'Bearer a b', 'bearer abc'])
    expect(bearer(header)).toBeUndefined()
})
