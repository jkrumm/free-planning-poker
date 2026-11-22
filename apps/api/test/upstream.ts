/**
 * A fake upstream for the message routes: a real server on a port the operating system hands out (the caller's `freePort()`) that
 * records each request it gets and answers with what the test says. `hang` never answers, so the caller's timeout is
 * what ends the request.
 */
export type Received = {
  readonly method: string
  readonly path: string
  readonly authorization: string | null
  readonly contentType: string | null
  readonly body: string
}

export async function startUpstream(port: number, answer: number | 'hang' = 200) {
  const received: Received[] = []
  const pending: (() => void)[] = []
  const server = Bun.serve({
    port,
    hostname: '127.0.0.1',
    async fetch(request) {
      received.push({
        method: request.method,
        path: new URL(request.url).pathname,
        authorization: request.headers.get('authorization'),
        contentType: request.headers.get('content-type'),
        body: await request.text(),
      })
      if (answer === 'hang')
        return new Promise<Response>((resolve) => pending.push(() => resolve(new Response())))
      return new Response('upstream says: nothing a visitor should read', { status: answer })
    },
  })
  return {
    url: `http://127.0.0.1:${server.port}`,
    received,
    async stop() {
      for (const release of pending.splice(0)) release()
      await server.stop(true)
    },
  }
}

/** The URL of a port nothing listens on: an upstream that cannot be reached. */
export const deadUrl = (port: number) => `http://127.0.0.1:${port}`
