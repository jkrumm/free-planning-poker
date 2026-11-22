import { expect, test } from 'bun:test'
import { ENV } from '../test/support.ts'
import { parseEnv } from './env.ts'

test('the allowed origins default to local development and are read as a list', () => {
  expect(parseEnv(ENV).origins).toEqual([
    'https://fpp-next.test',
    'http://localhost:7739',
    'http://localhost:7740',
  ])
  expect(
    parseEnv({
      ...ENV,
      ALLOWED_ORIGINS: 'https://free-planning-poker.com, https://beta.free-planning-poker.com',
    }).origins,
  ).toEqual(['https://free-planning-poker.com', 'https://beta.free-planning-poker.com'])
})

test('the client address header is read in lower case, and absent by default', () => {
  expect(parseEnv(ENV).clientIpHeader).toBeUndefined()
  expect(parseEnv({ ...ENV, CLIENT_IP_HEADER: 'CF-Connecting-IP' }).clientIpHeader).toBe(
    'cf-connecting-ip',
  )
})

test('an allowed origin with a path or no scheme is refused at startup', () => {
  expect(() => parseEnv({ ...ENV, ALLOWED_ORIGINS: 'https://free-planning-poker.com/' })).toThrow()
  expect(() => parseEnv({ ...ENV, ALLOWED_ORIGINS: 'free-planning-poker.com' })).toThrow()
})

test('the database and the visitor key are required, and a short key is refused', () => {
  expect(parseEnv(ENV).databaseUrl).toBe(ENV.DATABASE_URL)
  expect(() => parseEnv({ VISITOR_KEY: ENV.VISITOR_KEY })).toThrow('DATABASE_URL')
  expect(() => parseEnv({ DATABASE_URL: ENV.DATABASE_URL })).toThrow('VISITOR_KEY')
  expect(() => parseEnv({ ...ENV, VISITOR_KEY: 'short' })).toThrow('VISITOR_KEY')
})

test('the mail gateway and the factory door are on only when both of their variables are set', () => {
  expect(parseEnv(ENV).emailGateway).toBeUndefined()
  expect(parseEnv(ENV).feedbackDoor).toBeUndefined()
  expect(
    parseEnv({ ...ENV, EMAIL_GATEWAY_URL: 'https://gateway.example' }).emailGateway,
  ).toBeUndefined()
  expect(parseEnv({ ...ENV, EMAIL_GATEWAY_SECRET_KEY: 'secret' }).emailGateway).toBeUndefined()
  expect(
    parseEnv({ ...ENV, EMAIL_GATEWAY_URL: ' ', EMAIL_GATEWAY_SECRET_KEY: 'secret' }).emailGateway,
  ).toBeUndefined()
  expect(
    parseEnv({
      ...ENV,
      EMAIL_GATEWAY_URL: 'https://gateway.example/',
      EMAIL_GATEWAY_SECRET_KEY: 'secret',
      FACTORY_FEEDBACK_URL: 'https://door.example:8796/feedback/free-planning-poker',
      FACTORY_FEEDBACK_TOKEN: 'token',
    }),
  ).toMatchObject({
    emailGateway: { url: 'https://gateway.example', secret: 'secret' },
    feedbackDoor: {
      url: 'https://door.example:8796/feedback/free-planning-poker',
      secret: 'token',
    },
  })
})

test('an upstream URL that is no http(s) URL is refused at startup', () => {
  expect(() =>
    parseEnv({ ...ENV, EMAIL_GATEWAY_URL: 'gateway.example', EMAIL_GATEWAY_SECRET_KEY: 'secret' }),
  ).toThrow('EMAIL_GATEWAY_URL')
  expect(() =>
    parseEnv({
      ...ENV,
      FACTORY_FEEDBACK_URL: 'ftp://door.example',
      FACTORY_FEEDBACK_TOKEN: 'token',
    }),
  ).toThrow('FACTORY_FEEDBACK_URL')
})

test('telemetry is exported only where a collector is named, and the environment is prod or dev', () => {
  expect(parseEnv(ENV).otlpEndpoint).toBeUndefined()
  expect(parseEnv({ ...ENV, OTEL_EXPORTER_OTLP_ENDPOINT: ' ' }).otlpEndpoint).toBeUndefined()
  expect(
    parseEnv({ ...ENV, OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318' }).otlpEndpoint,
  ).toBe('http://collector:4318')
  expect(parseEnv(ENV).environment).toBe('dev')
  expect(parseEnv({ ...ENV, NODE_ENV: 'staging' }).environment).toBe('dev')
  expect(parseEnv({ ...ENV, NODE_ENV: 'production' }).environment).toBe('prod')
})
