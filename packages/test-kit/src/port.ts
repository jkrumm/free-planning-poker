import { createServer } from 'node:net'

/**
 * A TCP port the operating system has just handed out on 127.0.0.1, released again before it returns. No test in this
 * repo listens on a fixed port: many leads run their suites on one host at once.
 */
export async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  if (address === null || typeof address === 'string') throw new Error('the OS gave no TCP address')
  return address.port
}
