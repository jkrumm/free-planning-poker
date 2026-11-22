---
paths:
  - "apps/api/src/ws/**"
  - "apps/api/src/http/**"
  - "apps/api/src/main.ts"
---

# The transport adapter and Elysia

Elysia 2 is a pinned release candidate (`2.0.0-rc.3`, owner ruling of 2026-11-19). Its API may still move, so it is contained in two folders. The rooms ride `Bun.serve`'s native WebSocket handler (`apps/api/src/ws/bun.transport.ts`), the winner of the bake-off in `v9-api-ws` against Elysia's `websocket()` and Effect's socket server (`docs/v9/evidence/transport.md`); Elysia serves every `/api` route through its fetch, and the same fetch hands `/room*` and `/_room/*` to the built room app first (`apps/api/src/http/spa.ts`, a plain handler with no framework: it only reads files).

## The rule

- `elysia` and `@elysia/*` are imported in `apps/api/src/http` and `src/ws` only. Of the official plugins only `@elysia/eden` and `@elysia/opentelemetry`.
- Install by exact version, never by tag: `latest` is the 1.4 line. A version bump reruns the transport contract suite in the same pull request.
- The adapter implements the room-core transport port (accept, send, publish to room, close) and nothing more. Key a connection by your own id, take the room's address from the path `/api/ws/<slug>`, validate outgoing frames yourself (`encode` in `edge.ts`), check `Origin` against `ALLOWED_ORIGINS` before the upgrade, take the client's address from the header `CLIENT_IP_HEADER` names (behind the proxy the peer is the proxy), keep per-message deflate off, and bound a slow consumer's memory (Bun's 256 KB backpressure limit closes it, never buffer). The protocol's 16 KB cap is the runtime's: Bun's own `maxPayloadLength` sits at 64 KB because Bun ends a larger frame without a close code, so a 1009 can only come from the runtime.
- One timer in `src/ws`: the clock port of `clock.ts`. Anything else timed there goes through that port.
- Close codes are the application range of `docs/v9/ARCHITECTURE.md`, Protocol (4001 to 4008). On SIGTERM: `/api/health` answers 503, rooms stop being claimed, snapshots flush, sockets close with 4002; `server.stop` is always raced against a timeout.
- HTTP routes validate with Elysia's `t` (TypeBox), so Eden's types and the OpenAPI output stay native. A business error is a typed response; nothing below a route throws for a user mistake. Exceptions are recorded once, in `onError`.
- Adapters read no environment: values arrive from `src/main.ts` through `src/env.ts`.

## Why

Open Elysia reports on its WebSocket path (#1933, #2017, #1716) and an unbounded inbound buffer in Effect's (#10607) are why the choice is measured, not assumed. `docs/v9/ARCHITECTURE.md`, Server and Protocol.

## The check

The transport contract suite (`apps/api/test/contract/transport.server.test.ts`, server tier, `make check`) runs the redaction, the close codes, the Origin check, resume, a full table, the lock, the protocol fixtures, a slow consumer and the stop against the adapter; `apps/api/scripts/bake-off.ts` measures latency and memory. `scripts/boundaries.ts` and oxlint refuse Elysia elsewhere; the adapter class refuses `process.env`.
