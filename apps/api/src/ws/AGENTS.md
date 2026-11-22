# apps/api/src/ws

The room socket: `bun.transport.ts` is the transport port on `Bun.serve`'s native handler, the winner of the bake-off (`docs/v9/evidence/transport.md`); `edge.ts` holds the upgrade check, the socket options, the outgoing validation and `peers`, the peer address of each HTTP request (Elysia's `handle` takes no context, so the adapter records it per `Request` for `clientOf`, which the message routes' limits read); `clock.ts` is the clock port. Rule `transport.md` has the constraints; what follows is what only work here needs.

- **Prove a change with the contract suite**, `bun test apps/api/test/contract` (half a second, real sockets on a free port; server tier, so `make check-fast` skips it). A bump of Bun or Elysia passes it in the same pull request, and a Bun bump also passes `bun apps/api/scripts/stop-after-close.ts` (a stop that hangs after server-side closes, Bun issue 36223).
- **The drain on SIGTERM** is `main.ts` calling `Api.drain` (health 503), then `RoomServer.stop(DRAIN_DEADLINE_MS)`, then `Api.close`. Prove a change to it with `bun test apps/api/test/handoff` (two real processes on one Postgres, about 2 s).
- **Measure before claiming a transport is faster:** `bun apps/api/scripts/bake-off.ts --runs 20 --phase burst` in a slot (`factory slot run -- ...`). Single runs on the mini swing by ten times with the host's load; compare medians over alternating runs.
- **One timer in this folder**, the one in `clock.ts`. A stop or a wait here schedules on the clock port (`within` in `edge.ts`), never with `setTimeout`.
- **Bun's `maxPayloadLength` stays above 16 KB** (64 KB): Bun ends an oversized frame without a close code, so the runtime's check is what sends 1009. A frame at the backpressure limit is dropped the same way; the client reads 1006 and reconnects.
- **Publish never sends megabytes in one turn of the event loop**: the 256 KB limit is per socket and fills for a reading client too, which then gets closed.
- Every outgoing frame goes through `encode`, which throws on a frame the protocol's schemas refuse: a bug, not a user error.
