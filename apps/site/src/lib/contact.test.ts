import { describe, expect, test } from 'bun:test'
import { answerFor, contactLimits, contactPayload } from './contact.ts'

describe('answerFor', () => {
  test.each([
    [200, 'sent'],
    [204, 'sent'],
    [400, 'invalid'],
    [422, 'invalid'],
    [429, 'busy'],
    [502, 'unavailable'],
    [503, 'unavailable'],
    [404, 'unavailable'],
    [405, 'unavailable'],
    [undefined, 'unavailable'],
  ] as const)('status %p is %p', (status, answer) => {
    expect(answerFor(status)).toBe(answer)
  })
})

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

describe('contactPayload', () => {
  test('trims, and leaves out an empty optional field', () => {
    expect(
      contactPayload(
        form({ name: '  ', email: ' a@example.com ', subject: ' Hello ', message: '' }),
      ),
    ).toEqual({ email: 'a@example.com', subject: 'Hello' })
  })

  test('keeps a name and a message', () => {
    expect(
      contactPayload(
        form({ name: 'Ada', email: 'a@example.com', subject: 'Hello', message: 'Hi there' }),
      ),
    ).toEqual({ name: 'Ada', email: 'a@example.com', subject: 'Hello', message: 'Hi there' })
  })
})

test("the limits are v1's", () => {
  expect(contactLimits).toEqual({
    name: { max: 50 },
    email: { max: 70 },
    subject: { min: 3, max: 100 },
    message: { max: 800 },
  })
})
