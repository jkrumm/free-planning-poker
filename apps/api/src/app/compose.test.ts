import { expect, test } from 'bun:test'
import { parseEnv } from '../env.ts'
import { roomServerOptions } from './compose.ts'

test('the environment reaches the room server: origins and the client address header', () => {
  const env = parseEnv({
    ALLOWED_ORIGINS: 'https://next.free-planning-poker.com',
    CLIENT_IP_HEADER: 'CF-Connecting-IP',
  })
  const options = roomServerOptions(env, { now: () => 0 })
  expect(options.origins).toEqual(['https://next.free-planning-poker.com'])
  expect(options.clientIpHeader).toBe('cf-connecting-ip')
  expect(roomServerOptions(parseEnv({}), { now: () => 0 }).clientIpHeader).toBeUndefined()
})
