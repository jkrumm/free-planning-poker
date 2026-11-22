/**
 * The transport port on `Bun.serve`'s native WebSocket handler, beside Elysia's fetch for every HTTP route
 * (docs/v9/evidence/transport.md). Publish goes to Bun's topic of the room, so one call serves every seat.
 */
import {
  createRoomRuntime,
  type ConnectionId,
  type RoomKey,
  type Transport,
} from '@fpp/room-core/server'
import type { ServerWebSocket } from 'bun'
import {
  admit,
  encode,
  MAX_BODY_BYTES,
  peers,
  type RoomServer,
  type RoomServerOptions,
  slugOfPath,
  SOCKET_OPTIONS,
  STOP_TIMEOUT_MS,
  topicOf,
  within,
} from './edge.ts'

type Data = { readonly id: ConnectionId; readonly room: RoomKey; readonly ip: string }

export async function serveBun(options: RoomServerOptions): Promise<RoomServer> {
  const sockets = new Map<ConnectionId, ServerWebSocket<Data>>()
  const origins = new Set(options.origins)
  const emptied: (() => void)[] = []
  const empty = () =>
    sockets.size === 0
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          emptied.push(resolve)
        })

  const transport: Transport = {
    send(conn, frame) {
      sockets.get(conn)?.send(encode(frame), false)
    },
    subscribe(conn, room) {
      sockets.get(conn)?.subscribe(topicOf(room))
    },
    unsubscribe(conn, room) {
      sockets.get(conn)?.unsubscribe(topicOf(room))
    },
    publish(room, frame) {
      server.publish(topicOf(room), encode(frame), false)
    },
    close(conn, code) {
      sockets.get(conn)?.close(code)
    },
  }
  const runtime = createRoomRuntime({ ...options.ports, transport }, options.runtime)
  const http = options.http(runtime)
  const failed = (error: unknown) => options.ports.telemetry.failure(error, { action: 'cmd' })

  const server = Bun.serve<Data>({
    port: options.port,
    // The largest body is a message of two thousand characters; Bun's default would take 128 MB from anyone.
    maxRequestBodySize: MAX_BODY_BYTES,
    ...(options.hostname === undefined ? {} : { hostname: options.hostname }),
    async fetch(request, bun) {
      if (slugOfPath(new URL(request.url).pathname) === undefined) {
        peers.set(request, bun.requestIP(request)?.address ?? '')
        return http.handle(request)
      }
      const admission = await admit(request, {
        origins,
        rooms: options.rooms,
        clientIpHeader: options.clientIpHeader,
        peer: bun.requestIP(request)?.address ?? '',
      })
      if (!admission.ok) return admission.response
      const data: Data = { id: crypto.randomUUID(), room: admission.room, ip: admission.ip }
      if (bun.upgrade(request, { data })) return undefined
      return new Response('expected a WebSocket upgrade', { status: 426 })
    },
    websocket: {
      ...SOCKET_OPTIONS,
      open(ws) {
        sockets.set(ws.data.id, ws)
        runtime.open(ws.data.id, { room: ws.data.room, ip: ws.data.ip })
      },
      message(ws, message) {
        // The protocol is JSON text; a binary frame reaches the runtime as no frame at all and is refused there.
        runtime.receive(ws.data.id, typeof message === 'string' ? message : '').catch(failed)
      },
      close(ws) {
        sockets.delete(ws.data.id)
        runtime.closed(ws.data.id)
        if (sockets.size === 0) for (const resolve of emptied.splice(0)) resolve()
      },
    },
  })

  return {
    port: server.port ?? options.port,
    runtime,
    transport,
    async stop(timeoutMs = STOP_TIMEOUT_MS) {
      const { clock } = options.ports
      const deadline = clock.now() + timeoutMs
      const left = () => Math.max(0, deadline - clock.now())
      await within(runtime.drain(), left(), clock)
      // The clients answer the 4002 with their own close; a socket that never does is cut below.
      await within(empty(), left(), clock)
      // Bun 1.4.4 resolves a stop after server-side closes (issue 36223, docs/v9/evidence/transport.md); the race stays.
      await within(server.stop(), left(), clock)
      void server.stop(true)
    },
  }
}
