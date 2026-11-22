/**
 * The transport port on Elysia 2's `websocket()` plugin (docs/v9/evidence/transport.md). Every connection is keyed by
 * an id minted at the upgrade and never by the socket object (#1716); outgoing frames are validated here and the route
 * sets no response schema (#1933); only JSON objects are sent; the address comes from the path, never the query
 * (#2017). Elysia parses a JSON-shaped text frame before the handler sees it (#1911), so the handler serialises it
 * back for the runtime, which reads text.
 */
import { createRoomRuntime, type ConnectionId, type Transport } from '@fpp/room-core/server'
import type { ServerFrame } from '@fpp/room-core/types'
import { Elysia } from 'elysia'
import { websocket } from 'elysia/websocket'
import {
  admit,
  encode,
  type RoomServer,
  type RoomServerOptions,
  SOCKET_OPTIONS,
  STOP_TIMEOUT_MS,
  topicOf,
  within,
} from './edge.ts'

type Socket = {
  readonly send: (frame: ServerFrame) => number
  readonly subscribe: (topic: string) => unknown
  readonly unsubscribe: (topic: string) => unknown
  readonly close: (code: number) => void
}

export async function serveElysia(options: RoomServerOptions): Promise<RoomServer> {
  const sockets = new Map<ConnectionId, Socket>()
  const origins = new Set(options.origins)

  const transport: Transport = {
    send(conn, frame) {
      const socket = sockets.get(conn)
      if (socket === undefined) return
      encode(frame)
      socket.send(frame)
    },
    subscribe(conn, room) {
      sockets.get(conn)?.subscribe(topicOf(room))
    },
    unsubscribe(conn, room) {
      sockets.get(conn)?.unsubscribe(topicOf(room))
    },
    publish(room, frame) {
      app.server?.publish(topicOf(room), encode(frame), false)
    },
    close(conn, code) {
      sockets.get(conn)?.close(code)
    },
  }
  const runtime = createRoomRuntime({ ...options.ports, transport }, options.runtime)
  const failed = (error: unknown) => options.ports.telemetry.failure(error, { action: 'cmd' })

  const rooms = new Elysia()
    // A derive runs once, at the upgrade; a beforeHandle would run again before every message.
    .derive(async ({ request, status }) => {
      const admission = await admit(request, { origins, rooms: options.rooms })
      if (!admission.ok) return status(admission.response.status as 403 | 404)
      return { conn: crypto.randomUUID() as ConnectionId, room: admission.room }
    })
    .ws('/api/ws/:slug', {
      open(ws) {
        sockets.set(ws.conn, {
          send: (frame) => ws.send(frame),
          subscribe: (topic) => ws.subscribe(topic),
          unsubscribe: (topic) => ws.unsubscribe(topic),
          close: (code) => ws.close(code),
        })
        runtime.open(ws.conn, { room: ws.room, ip: ws.remoteAddress })
      },
      message(ws, message) {
        const text =
          typeof message === 'string'
            ? message
            : message instanceof Uint8Array || message instanceof ArrayBuffer
              ? ''
              : JSON.stringify(message)
        runtime.receive(ws.conn, text).catch(failed)
      },
      close(ws) {
        sockets.delete(ws.conn)
        runtime.closed(ws.conn)
      },
    })

  const app = new Elysia().use(websocket(SOCKET_OPTIONS)).use(options.http).use(rooms)
  app.listen({
    port: options.port,
    ...(options.hostname === undefined ? {} : { hostname: options.hostname }),
  })

  return {
    port: app.server?.port ?? options.port,
    runtime,
    transport,
    async stop(timeoutMs = STOP_TIMEOUT_MS) {
      await within(runtime.drain(), timeoutMs, options.ports.clock)
      await within(Promise.resolve(app.stop(true)), timeoutMs, options.ports.clock)
    },
  }
}
