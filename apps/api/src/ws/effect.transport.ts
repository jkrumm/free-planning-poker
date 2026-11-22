/**
 * The transport port on Effect 4's socket server on Bun (`@effect/platform-bun` BunHttpServer and
 * `effect/socket/Socket`), from stable import paths only (docs/v9/evidence/transport.md). Effect's socket exposes no
 * topic, so publish is a loop over the room's sockets here; Bun's options pass through, so Bun still bounds a slow
 * consumer. HTTP routes go to Elysia's fetch.
 */
import * as BunHttpServer from '@effect/platform-bun/BunHttpServer'
import {
  createRoomRuntime,
  type ConnectionId,
  type RoomKey,
  type Transport,
} from '@fpp/room-core/server'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as HttpServerRequest from 'effect/http/HttpServerRequest'
import * as HttpServerResponse from 'effect/http/HttpServerResponse'
import * as Option from 'effect/Option'
import * as Scope from 'effect/Scope'
import * as Socket from 'effect/socket/Socket'
import {
  admit,
  encode,
  type RoomServer,
  type RoomServerOptions,
  slugOfPath,
  SOCKET_OPTIONS,
  STOP_TIMEOUT_MS,
  topicOf,
  within,
} from './edge.ts'

type Conn = { readonly write: (text: string) => void; readonly close: (code: number) => void }

export async function serveEffect(options: RoomServerOptions): Promise<RoomServer> {
  const sockets = new Map<ConnectionId, Conn>()
  const topics = new Map<string, Set<ConnectionId>>()
  const origins = new Set(options.origins)

  const leave = (conn: ConnectionId, topic: string) => {
    const members = topics.get(topic)
    members?.delete(conn)
    if (members?.size === 0) topics.delete(topic)
  }
  const transport: Transport = {
    send(conn, frame) {
      sockets.get(conn)?.write(encode(frame))
    },
    subscribe(conn, room) {
      const topic = topicOf(room)
      const members = topics.get(topic) ?? new Set<ConnectionId>()
      members.add(conn)
      topics.set(topic, members)
    },
    unsubscribe(conn, room) {
      leave(conn, topicOf(room))
    },
    publish(room, frame) {
      const members = topics.get(topicOf(room))
      if (members === undefined) return
      const text = encode(frame)
      for (const conn of members) sockets.get(conn)?.write(text)
    },
    close(conn, code) {
      sockets.get(conn)?.close(code)
    },
  }
  const runtime = createRoomRuntime({ ...options.ports, transport }, options.runtime)
  const failed = (error: unknown) => options.ports.telemetry.failure(error, { action: 'cmd' })

  const connection = (request: HttpServerRequest.HttpServerRequest, room: RoomKey) =>
    Effect.gen(function* () {
      const socket = yield* request.upgrade
      const writer = yield* socket.writer
      const reader = yield* socket.reader
      const conn = crypto.randomUUID() as ConnectionId
      sockets.set(conn, {
        write: (text) => Effect.runSync(Effect.ignore(writer.write(text))),
        close: (code) => Effect.runSync(Effect.ignore(writer.write(new Socket.CloseEvent(code)))),
      })
      runtime.open(conn, { room, ip: Option.getOrElse(request.remoteAddress, () => '') })
      const receive = (chunks: ReadonlyArray<Uint8Array | string>) =>
        Effect.sync(() => {
          for (const chunk of chunks)
            runtime.receive(conn, typeof chunk === 'string' ? chunk : '').catch(failed)
        })
      yield* Effect.forever(Effect.flatMap(reader.pull, receive)).pipe(
        Effect.ignore,
        Effect.ensuring(
          Effect.sync(() => {
            sockets.delete(conn)
            for (const topic of Array.from(topics.keys())) leave(conn, topic)
            runtime.closed(conn)
          }),
        ),
      )
      return HttpServerResponse.empty()
    }).pipe(Effect.scoped)

  const app = Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest
    const web = request.source as Request
    if (slugOfPath(new URL(web.url).pathname) === undefined) {
      const response = yield* Effect.promise(async () => options.http.handle(web))
      return HttpServerResponse.fromWeb(response)
    }
    const admission = yield* Effect.promise(() => admit(web, { origins, rooms: options.rooms }))
    if (!admission.ok) return HttpServerResponse.fromWeb(admission.response)
    return yield* connection(request, admission.room)
  })

  const scope = Effect.runSync(Scope.make())
  const server = await Effect.runPromise(
    Scope.provide(scope)(
      BunHttpServer.make({
        port: options.port,
        ...(options.hostname === undefined ? {} : { hostname: options.hostname }),
        websocket: SOCKET_OPTIONS,
      }),
    ),
  )
  await Effect.runPromise(Scope.provide(scope)(server.serve(app)))
  const address = server.address

  return {
    port: 'port' in address ? address.port : options.port,
    runtime,
    transport,
    async stop(timeoutMs = STOP_TIMEOUT_MS) {
      await within(runtime.drain(), timeoutMs, options.ports.clock)
      await within(Effect.runPromise(Scope.close(scope, Exit.void)), timeoutMs, options.ports.clock)
    },
  }
}
