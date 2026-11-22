/**
 * A test client of the room socket: real sockets on an ephemeral port, every frame kept as the raw text it arrived as,
 * and waits that end on an event, never on a timer.
 */
import type { ServerFrame } from '@fpp/room-core/types'

export const ORIGIN = 'http://room.test'

/** Bun's client socket: headers on the handshake, and reading that can pause (Bun 1.4.1). */
export type BunSocket = WebSocket & { pause(): boolean; resume(): void }
const BunWebSocket = WebSocket as unknown as new (
  url: string,
  options: { readonly headers: Record<string, string> },
) => BunSocket

type Waiter = {
  readonly match: (frame: ServerFrame) => boolean
  readonly resolve: (frame: ServerFrame) => void
}

export type Closed = { readonly code: number; readonly reason: string }

export class TestClient {
  /** Every text frame received, in order, as it arrived. */
  readonly raw: string[] = []
  readonly frames: ServerFrame[] = []
  readonly closed: Promise<Closed>
  private readonly waiters = new Set<Waiter>()
  private cursor = 0

  private constructor(readonly socket: BunSocket) {
    this.closed = new Promise((resolve) => {
      socket.addEventListener('close', (event) =>
        resolve({ code: event.code, reason: event.reason }),
      )
    })
    socket.addEventListener('message', (event) => {
      const text = String(event.data)
      const frame = JSON.parse(text) as ServerFrame
      this.raw.push(text)
      this.frames.push(frame)
      for (const waiter of Array.from(this.waiters))
        if (waiter.match(frame)) {
          this.waiters.delete(waiter)
          waiter.resolve(frame)
        }
    })
  }

  static open(url: string, headers: Record<string, string> = {}): Promise<TestClient> {
    const socket = new BunWebSocket(url, { headers: { Origin: ORIGIN, ...headers } })
    const client = new TestClient(socket)
    return new Promise((resolve, reject) => {
      socket.addEventListener('open', () => resolve(client), { once: true })
      socket.addEventListener('error', () => reject(new Error(`could not open ${url}`)), {
        once: true,
      })
    })
  }

  send(frame: Record<string, unknown>) {
    this.socket.send(JSON.stringify(frame))
  }

  /** The first frame after the last one waited for that matches; frames already received count. */
  next<F extends ServerFrame['frame']>(
    name: F,
    match: (frame: Extract<ServerFrame, { frame: F }>) => boolean = () => true,
  ): Promise<Extract<ServerFrame, { frame: F }>> {
    type Wanted = Extract<ServerFrame, { frame: F }>
    const test = (frame: ServerFrame): frame is Wanted =>
      frame.frame === name && match(frame as Wanted)
    for (let index = this.cursor; index < this.frames.length; index += 1) {
      const frame = this.frames[index]!
      if (test(frame)) {
        this.cursor = index + 1
        return Promise.resolve(frame)
      }
    }
    return new Promise((resolve) => {
      this.waiters.add({
        match: test,
        resolve: (frame) => {
          this.cursor = this.frames.indexOf(frame) + 1
          resolve(frame as Wanted)
        },
      })
    })
  }

  close() {
    this.socket.close(1000)
  }
}

export type Hello = {
  readonly name: string
  readonly seatToken?: string
  readonly code?: string
  readonly v?: number
}

export const hello = (input: Hello) => ({
  frame: 'hello',
  v: input.v ?? 1,
  build: 'contract',
  name: input.name,
  avatar: 'seed',
  ...(input.seatToken === undefined ? {} : { seatToken: input.seatToken }),
  ...(input.code === undefined ? {} : { code: input.code }),
})

/** Opens a socket, says hello and waits for the welcome. */
export async function join(url: string, input: Hello, headers: Record<string, string> = {}) {
  const client = await TestClient.open(url, headers)
  client.send(hello(input))
  const welcome = await client.next('welcome')
  return { client, welcome }
}

/** The status line of a WebSocket upgrade request, sent over a plain TCP socket so nothing rewrites its headers. */
export async function upgradeStatus(
  port: number,
  path: string,
  origin: string | null,
): Promise<number> {
  const lines = [
    `GET ${path} HTTP/1.1`,
    `Host: 127.0.0.1:${port}`,
    'Upgrade: websocket',
    'Connection: Upgrade',
    'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
    'Sec-WebSocket-Version: 13',
    ...(origin === null ? [] : [`Origin: ${origin}`]),
    '',
    '',
  ]
  return new Promise((resolve, reject) => {
    let text = ''
    void Bun.connect({
      hostname: '127.0.0.1',
      port,
      socket: {
        open(socket) {
          socket.write(lines.join('\r\n'))
        },
        data(socket, data) {
          text += data.toString()
          const match = /^HTTP\/1\.1 (\d{3})/.exec(text)
          if (match === null) return
          resolve(Number(match[1]))
          socket.end()
        },
        error(_socket, error) {
          reject(error)
        },
      },
    })
  })
}
