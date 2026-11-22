import { expect, test } from 'bun:test'
import { parseEnv } from './env.ts'

test('the allowed origins default to local development and are read as a list', () => {
  expect(parseEnv({}).origins).toEqual([
    'https://fpp-next.test',
    'http://localhost:7739',
    'http://localhost:7740',
  ])
  expect(
    parseEnv({
      ALLOWED_ORIGINS: 'https://free-planning-poker.com, https://beta.free-planning-poker.com',
    }).origins,
  ).toEqual(['https://free-planning-poker.com', 'https://beta.free-planning-poker.com'])
})

test('an allowed origin with a path or no scheme is refused at startup', () => {
  expect(() => parseEnv({ ALLOWED_ORIGINS: 'https://free-planning-poker.com/' })).toThrow()
  expect(() => parseEnv({ ALLOWED_ORIGINS: 'free-planning-poker.com' })).toThrow()
})
