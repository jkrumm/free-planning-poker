import { createServer, type AddressInfo } from 'node:net'

/** A port the system hands out on 127.0.0.1: nothing in the suite listens on a fixed port. */
export const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      server.close(() => resolve(port))
    })
  })
