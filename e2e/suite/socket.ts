/**
 * A seat that takes its place over the room's WebSocket with no browser: the protocol's `hello`, `cmd` and `evt`
 * frames as docs/v9/protocol.md names them. A crowd test uses it for the seats whose page it does not need to look at:
 * a context holds about 140 MiB of renderer, so a table of thirty pages is the whole memory figure of the suite
 * (rules/browser.md), while a socket is a few kilobytes. Node's own WebSocket, because a Playwright worker runs on Node.
 */

export type RevealedVote = { readonly seat: number; readonly card: { readonly label: string } }

export type SocketSeat = {
  readonly name: string
  /** Votes `label` in the current round and resolves once the server acknowledges the command. */
  readonly vote: (label: string) => Promise<void>
  /** Resolves with the votes of the revealed round when this seat receives the `poker.revealed` event. */
  readonly revealed: Promise<readonly RevealedVote[]>
  readonly close: () => void
}

type Frame = {
  readonly frame: string
  readonly id?: string
  readonly reason?: string
  readonly type?: string
  readonly payload?: { readonly votes?: readonly RevealedVote[] }
  readonly view?: { readonly activity: { readonly current: string } }
}

const PROTOCOL_VERSION = 1

/** Opens the seat `name` in the room `slug` of the stack at `baseURL`, and resolves once its `welcome` arrived. */
export function joinBySocket(options: {
  readonly baseURL: string
  readonly slug: string
  readonly name: string
}): Promise<SocketSeat> {
  const { baseURL, slug, name } = options
  // The upgrade is refused without an Origin the server allows (ALLOWED_ORIGINS), as it is for a page.
  const socket = new WebSocket(`${baseURL.replace(/^http/, 'ws')}/api/ws/${slug}`, {
    headers: { origin: baseURL },
  } as never)
  let round = ''
  let counter = 0
  const waiting = new Map<string, { ok: () => void; fail: (error: Error) => void }>()
  const lost = (message: string) => new Error(`seat "${name}": ${message}`)

  const {
    promise: revealed,
    resolve: reveal,
    reject: revealFailed,
  } = Promise.withResolvers<readonly RevealedVote[]>()
  // A seat that closes before the reveal rejects `revealed`; the test awaits it or has already failed.
  revealed.catch(() => undefined)

  return new Promise((resolveSeat, rejectSeat) => {
    socket.addEventListener('open', () => {
      socket.send(
        JSON.stringify({
          frame: 'hello',
          v: PROTOCOL_VERSION,
          build: 'e2e',
          name,
          avatar: name,
        }),
      )
    })
    socket.addEventListener('error', () => rejectSeat(lost('the socket failed')))
    socket.addEventListener('close', (event) => {
      const error = lost(`the socket closed with ${event.code}`)
      rejectSeat(error)
      revealFailed(error)
      for (const pending of waiting.values()) pending.fail(error)
    })
    socket.addEventListener('message', (message) => {
      const frame = JSON.parse(String(message.data)) as Frame
      if (frame.frame === 'ping') socket.send(JSON.stringify({ frame: 'pong' }))
      else if (frame.frame === 'welcome' && frame.view !== undefined) {
        round = frame.view.activity.current
        resolveSeat({
          name,
          revealed,
          close: () => socket.close(),
          vote: (label) =>
            new Promise<void>((ok, fail) => {
              const id = `${name}-${counter++}`
              waiting.set(id, { ok, fail })
              socket.send(
                JSON.stringify({
                  frame: 'cmd',
                  id,
                  type: 'poker.vote',
                  payload: { round, card: label },
                }),
              )
            }),
        })
      } else if (frame.frame === 'ack' && frame.id !== undefined) waiting.get(frame.id)?.ok()
      else if (frame.frame === 'nack' && frame.id !== undefined)
        waiting.get(frame.id)?.fail(lost(`the server refused the vote: ${frame.reason}`))
      else if (frame.frame === 'evt' && frame.type === 'poker.revealed')
        reveal(frame.payload?.votes ?? [])
    })
  })
}
