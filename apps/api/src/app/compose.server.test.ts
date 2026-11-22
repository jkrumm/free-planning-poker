import { afterAll, beforeAll, expect, test } from 'bun:test'
import { startPostgres, type PostgresCluster } from '@fpp/test-kit/postgres'
import { ENV } from '../../test/support.ts'
import { parseEnv } from '../env.ts'
import { createApiTelemetry } from '../telemetry.ts'
import { composeApi } from './compose.ts'

let cluster: PostgresCluster

beforeAll(async () => {
  cluster = await startPostgres()
}, 60_000)

afterAll(async () => {
  await cluster?.stop()
})

const compose = (extra: Record<string, string>) => {
  const env = parseEnv({ ...ENV, DATABASE_URL: cluster.url, ...extra })
  return composeApi(env, { now: Date.now, telemetry: createApiTelemetry(env) })
}

test('the environment reaches the room server: origins and the client address header', async () => {
  const behindProxy = await compose({
    ALLOWED_ORIGINS: 'https://next.free-planning-poker.com',
    CLIENT_IP_HEADER: 'CF-Connecting-IP',
  })
  const direct = await compose({})
  try {
    expect(behindProxy.options.origins).toEqual(['https://next.free-planning-poker.com'])
    expect(behindProxy.options.clientIpHeader).toBe('cf-connecting-ip')
    expect(direct.options.clientIpHeader).toBeUndefined()
  } finally {
    await behindProxy.close()
    await direct.close()
  }
})
