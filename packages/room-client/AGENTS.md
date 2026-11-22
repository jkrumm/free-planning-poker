# packages/room-client

The headless client of a room: one object per room that owns the connection, the seat's view, the commands waiting for an answer and the seat's secret. No React, no DOM. `docs/v9/ARCHITECTURE.md` section Client is the contract; the two figures `connection.svg` and `entry.svg` are `src/client.ts` as a picture.

## Where things are

| Path | Holds |
|-|-|
| `src/client.ts` | `createRoomClient`: the entry (lookup, changed-hands, locked), the connection machine, resume, pending commands |
| `src/ports.ts` | every port: WebSocket constructor, storage, timers, window signals, random, lookup |
| `src/backoff.ts` | the waits as data (`WAITS`) and the full-jitter formula |
| `src/storage.ts` | `createLocalStore`: every key under `fpp:v9:`, v1 adoption, the list of rooms and its pruning |
| `src/lookup.ts` | `GET /api/rooms/:slug` as a lookup port: the one place that knows that route's JSON |
| `src/bots.ts` | the development bots (entry `@fpp/room-client/bots`, not in the browser bundle); `scripts/bots.ts` is `bun run bots` |
| `test/sim-harness.ts` | the client on the simulator: the real runtime, the seeded network, a fake WebSocket over it |

## Rules

- **Ports only.** Nothing here names `window`, `localStorage`, `WebSocket` or a timer global, and `src` reads no environment (class adapter). A test passes fakes: `test/support.ts` has a clock, sockets driven by hand and a storage.
- **Import `@fpp/room-core/types` and `/view` only.** `/protocol` ships Zod and `/server` the rules; `test/bundle.test.ts` holds the built entry to 12 kB gzipped with no `zod`. Frames from the server are checked only for what the client reads: it trusts the server's schema, as the server trusts nothing from a client.
- **The view is the server's.** `evolveView` keeps it, `withOwnVote` adds only the seat's own acknowledged card, and only after the seat's own `poker.voted` event is in, so the order of votes stays the server's. The one optimism is `pendingVote` and `ownVote` in the state. Another optimistic update is a change of the contract.
- **Every loss goes through `closed()`.** A close code decides: terminal (`reload-required`, `kicked`, `gone`), waiting for a person (`locked`, `changed-hands`), or a wait and a new socket. A close of 4004 or 4005 on a socket that never saw a seat ends in `gone` or `locked` and never loops.
- **A vote waits, nothing else does.** `poker.vote` and `poker.clearVote` wait out a lost connection and go again with their id after the welcome; any other command is refused with `offline` and one pending at the loss resolves `lost`.
- **Storage values carry a schema version `v`.** A value of another version reads as absent. Raising a version needs a migration in `storage.ts` and a test with the old shape. v1's keys are adopted where the new key is absent and never deleted.
- **Time is integer milliseconds** wherever a timer is set: the simulator derives UUID v7 ids from the clock.

## Tests

- `test/client.test.ts`: the machine on a fake clock; add a close code or a status here first.
- `test/sim.test.ts`: 500 seeds of bots built on the client at the real runtime under the lossy network, then a calm one. Any caught-up view must equal `project(state, seat)`; keep the seeds at 500 and a seed near 10 ms (the file is about 5 s of `make check-fast`). A failing seed: `playBots({ seed })` in `test/sim-harness.ts` replays it, pass `trace` to read the network.
- `test/storage.test.ts` holds the v1 fixture. `test/bundle.test.ts` prints the size.
