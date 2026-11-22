import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { isConnectionError, serialQueue } from './resilience.ts'

const wrapped = (cause: unknown) => Object.assign(new Error('Failed query: select 1'), { cause })

test('an outage is told apart from a bug, through the causes Drizzle wraps the driver in', () => {
  const outages = [
    { code: 'ERR_POSTGRES_CONNECTION_CLOSED' },
    { code: 'ERR_POSTGRES_CONNECTION_REFUSED' },
    { code: 'ERR_POSTGRES_IDLE_TIMEOUT' },
    { code: 'ERR_POSTGRES_SERVER_ERROR', errno: '57P01' },
    { code: 'ERR_POSTGRES_SERVER_ERROR', errno: '08006' },
    { code: 'ECONNRESET' },
    new Error('connection must be a PostgresSQLConnection'),
  ]
  for (const cause of outages) expect(isConnectionError(wrapped(cause))).toBe(true)
  const bugs = [
    { code: 'ERR_POSTGRES_SERVER_ERROR', errno: '23505' },
    { code: 'ERR_POSTGRES_SERVER_ERROR', errno: '42P01' },
    new TypeError('x is undefined'),
    'a string',
  ]
  for (const cause of bugs) expect(isConnectionError(wrapped(cause))).toBe(false)
})

test('the serial queue keeps the order per key, survives a failure, and lets other keys pass', async () => {
  const queue = serialQueue()
  const order: string[] = []
  const { promise: held, resolve: release } = Promise.withResolvers<void>()
  const first = queue.run('a', async () => {
    await held
    order.push('a1')
  })
  const failing = queue.run('a', () => Promise.reject(new Error('boom')))
  const third = queue.run('a', async () => {
    order.push('a3')
  })
  await queue.run('b', async () => {
    order.push('b1')
  })
  release()
  await first
  expect(failing).rejects.toThrow('boom')
  await third
  await queue.idle()
  expect(order).toEqual(['b1', 'a1', 'a3'])
  expect(await Effect.runPromise(Effect.succeed('effect runs here'))).toBe('effect runs here')
})
