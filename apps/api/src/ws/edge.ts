/**
 * What every transport adapter shares at the edge of the process: the upgrade check (Origin allowlist, the room's
 * address from the path), the socket options set on purpose, and the validation of every outgoing frame
 * (docs/v9/ARCHITECTURE.md, Protocol and Server; rule `transport.md`).
 */
import { ServerFrameSchema } from '@fpp/room-core/protocol'
import type {
  Clock,
  RoomKey,
  RoomRuntime,
  RuntimeOptions,
  RuntimePorts,
  TimerHandle,
} from '@fpp/room-core/server'
import { parseSlug, type ServerFrame, type Slug } from '@fpp/room-core/types'
import type { App } from '../http/app.ts'

export const WS_PREFIX = '/api/ws/'

/** Bun's WebSocket options, the same for every adapter. */
export const SOCKET_OPTIONS = {
  /**
   * Bun's hard ceiling. The protocol's limit is 16 KB (`RUNTIME_LIMITS.maxFrame`), and the runtime closes a larger
   * frame with 1009; Bun itself would end the connection without a close frame (the client reads 1006), so its
   * ceiling sits above the protocol's and only bounds what one frame can cost.
   */
  maxPayloadLength: 64 * 1024,
  perMessageDeflate: false,
  /** Seconds; above the runtime's 25 s ping and its 60 s silence, so the runtime decides when a socket is dead. */
  idleTimeout: 75,
  /** The application heartbeat is the only one (protocol frames `ping` and `pong`). */
  sendPings: false,
  /** A consumer that buffers more than this is closed: its memory is bounded, never queued. */
  backpressureLimit: 256 * 1024,
  closeOnBackpressureLimit: true,
  publishToSelf: false,
} as const

/** The rooms an address leads to. An address that leads nowhere is refused before the upgrade. */
export type RoomDirectory = {
  readonly resolve: (slug: Slug) => Promise<RoomKey | null>
}

export type RoomServerOptions = {
  readonly port: number
  readonly hostname?: string
  /** Origins allowed to open a room socket, as `scheme://host[:port]`. */
  readonly origins: readonly string[]
  /**
   * The request header that carries the client's address, set by the edge in front of the API (Cloudflare's
   * `cf-connecting-ip`); without it the socket's peer address counts, which behind a proxy is the proxy's.
   */
  readonly clientIpHeader?: string
  /** The HTTP routes; Elysia keeps them whichever adapter carries the sockets. */
  readonly http: App
  readonly rooms: RoomDirectory
  readonly ports: Omit<RuntimePorts, 'transport'>
  readonly runtime: RuntimeOptions
}

export type RoomServer = {
  readonly port: number
  readonly runtime: RoomRuntime
  /** The adapter's transport port, for the contract suite and the bake-off. */
  readonly transport: RuntimePorts['transport']
  /** Closes every socket with 4002, then stops the server, raced against `timeoutMs`. */
  readonly stop: (timeoutMs?: number) => Promise<void>
}

/** The room's topic of the pub/sub: one per room. */
export const topicOf = (room: RoomKey) => `room:${room}`

/** The path's slug, or undefined when the path is not a room socket. */
export function slugOfPath(pathname: string): string | undefined {
  if (!pathname.startsWith(WS_PREFIX)) return undefined
  return pathname.slice(WS_PREFIX.length)
}

export type Admission =
  | { readonly ok: true; readonly room: RoomKey; readonly ip: string }
  | { readonly ok: false; readonly response: Response }

const refused = (status: number) => ({
  ok: false as const,
  response: new Response(null, { status, headers: { 'cache-control': 'no-store' } }),
})

/**
 * Checks a socket's upgrade request before it opens: a foreign or missing Origin is 403 (cross-site WebSocket
 * hijacking), a path that is no room address or an address that leads nowhere is 404. Only the canonical form of an
 * address is accepted; nothing is read from the query string.
 */
export async function admit(
  request: Request,
  deps: {
    readonly origins: ReadonlySet<string>
    readonly rooms: RoomDirectory
    readonly clientIpHeader?: string | undefined
    /** The socket's peer address. */
    readonly peer: string
  },
): Promise<Admission> {
  const origin = request.headers.get('origin')
  if (origin === null || !deps.origins.has(origin)) return refused(403)
  const raw = slugOfPath(new URL(request.url).pathname)
  const slug = parseSlug(raw)
  if (slug === undefined || slug !== raw) return refused(404)
  const room = await deps.rooms.resolve(slug)
  if (room === null) return refused(404)
  return { ok: true, room, ip: clientIp(request, deps.clientIpHeader, deps.peer) }
}

/**
 * The client's address: the edge's header when one is named and present, else the peer's. The header holds one
 * address the edge overwrites (`cf-connecting-ip`); a list a client can prepend to, such as `x-forwarded-for`, is
 * no source for it.
 */
function clientIp(request: Request, header: string | undefined, peer: string): string {
  const named = header === undefined ? undefined : request.headers.get(header)?.trim()
  return named === undefined || named === '' ? peer : named
}

/** A frame as the text a socket sends; one that the protocol's schemas refuse is a bug and throws. */
export function encode(frame: ServerFrame): string {
  const parsed = ServerFrameSchema.safeParse(frame)
  if (!parsed.success) throw new Error(`an outgoing ${frame.frame} frame failed its schema`)
  return JSON.stringify(frame)
}

/** Resolves `work`, or gives up after `ms` on the runtime's clock: a stop never hangs a shutdown. */
export function within(work: Promise<unknown>, ms: number, clock: Clock): Promise<void> {
  let handle: TimerHandle | undefined
  const timeout = new Promise<void>((resolve) => {
    handle = clock.schedule(clock.now() + ms, resolve)
  })
  return Promise.race([work.then(() => undefined), timeout]).finally(() => clock.cancel(handle))
}

/** How long a stop waits for the server to let go of its sockets. */
export const STOP_TIMEOUT_MS = 5_000
