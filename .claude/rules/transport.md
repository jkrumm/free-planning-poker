---
paths:
  - "apps/api/src/ws/**"
  - "apps/api/src/http/**"
  - "apps/api/src/main.ts"
---

# The transport adapter and Elysia

Elysia 2 is a pinned release candidate (`2.0.0-rc.3`, owner ruling of 2026-11-19). Its API may still move, so it is contained in two folders, and which WebSocket path carries the rooms is decided by measurement in `v9-api-ws` (Elysia `.ws`, `Bun.serve`'s native handler, Effect's socket server), recorded in `docs/v9/evidence/transport.md`.

## The rule

- `elysia` and `@elysia/*` are imported in `apps/api/src/http` and `src/ws` only. Of the official plugins only `@elysia/eden` and `@elysia/opentelemetry`.
- Install by exact version, never by tag: `latest` is the 1.4 line. A version bump reruns the transport contract suite in the same pull request.
- The adapter implements the room-core transport port (accept, send, publish to room, close) and nothing more. Whatever wins the bake-off: key a connection by your own id, take the room's address from the path `/api/ws/<slug>`, validate outgoing frames yourself, check `Origin` before the upgrade, cap a payload at 16 KB, keep per-message deflate off, and bound a slow consumer's memory (drop it, never buffer).
- Close codes are the application range of `docs/v9/ARCHITECTURE.md`, Protocol (4001 to 4008). On SIGTERM: `/api/health` answers 503, rooms stop being claimed, snapshots flush, sockets close with 4002; `server.stop` is always raced against a timeout.
- HTTP routes validate with Elysia's `t` (TypeBox), so Eden's types and the OpenAPI output stay native. A business error is a typed response; nothing below a route throws for a user mistake. Exceptions are recorded once, in `onError`.
- Adapters read no environment: values arrive from `src/main.ts` through `src/env.ts`.

## Why

Open Elysia reports on its WebSocket path (#1933, #2017, #1716) and an unbounded inbound buffer in Effect's (#10607) are why the choice is measured, not assumed. `docs/v9/ARCHITECTURE.md`, Server and Protocol.

## The check

The transport contract suite (server tier, `make check`) runs the frame fixtures, the close codes, the drain and a slow consumer against the adapter. `scripts/boundaries.ts` and oxlint refuse Elysia elsewhere; the adapter class refuses `process.env`.
