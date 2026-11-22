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

test('the client address header is read in lower case, and absent by default', () => {
  expect(parseEnv({}).clientIpHeader).toBeUndefined()
  expect(parseEnv({ CLIENT_IP_HEADER: 'CF-Connecting-IP' }).clientIpHeader).toBe('cf-connecting-ip')
})

test('an allowed origin with a path or no scheme is refused at startup', () => {
  expect(() => parseEnv({ ALLOWED_ORIGINS: 'https://free-planning-poker.com/' })).toThrow()
  expect(() => parseEnv({ ALLOWED_ORIGINS: 'free-planning-poker.com' })).toThrow()
})

test('telemetry is exported only where a collector is named, and the environment is prod or dev', () => {
  expect(parseEnv({}).otlpEndpoint).toBeUndefined()
  expect(parseEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: ' ' }).otlpEndpoint).toBeUndefined()
  expect(parseEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318' }).otlpEndpoint).toBe(
    'http://collector:4318',
  )
  expect(parseEnv({}).environment).toBe('dev')
  expect(parseEnv({ NODE_ENV: 'staging' }).environment).toBe('dev')
  expect(parseEnv({ NODE_ENV: 'production' }).environment).toBe('prod')
})
