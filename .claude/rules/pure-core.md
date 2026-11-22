---
paths:
  - "packages/room-core/**"
  - "packages/telemetry/src/names.ts"
  - "packages/table/src/layout.ts"
---

# The pure core

`packages/room-core` decides; adapters do. Every rule of the room is a pure function, so it is tested with plain data and no socket, and a simulator seed replays it exactly. The same holds for every file `boundaries.toml` lists as `pure`: the telemetry names and the table's layout function.

## The rule

- Three functions carry a room: `decide(state, command, ctx): Event[] | Rejection`, `evolve(state, event): State` and `project(state, seat): View`. Only `evolve` changes the room (`step` only adds each accepted command's id to the dedupe log), only events are published, and `project` is the one function that builds what a seat sees (invariant 4: no other seat's vote before the reveal).
- Time, randomness and ids arrive in `ctx`, I/O through a port: an `interface` in room-core (transport, store, history, clock, ids, telemetry) with one production adapter outside and one in-memory adapter inside. Tests swap the adapter, never mock a module.
- No import of `node:*`, `bun` or `bun:*`, and no runtime library (Effect, Elysia, React): Zod for the protocol schemas is the one dependency. No `fetch`, `WebSocket`, timers, `Date.now`, `new Date()`, `performance.now`, `Math.random`, crypto randomness, `process` or `Bun`.
- No classes: state is plain data, copied as it is into the snapshot and the simulator's trace. A value object is a branded type whose parser is its only constructor (`Slug`, `SeatIndex`, `Card`).
- A rejection is a `nack` reason from a closed enum, returned as a value; an exception means a bug. Nothing here logs or catches to log: domain events are emitted by the adapter from the reducer's output.
- Every invariant is enforced twice: `decide` refuses the command, and `check(state)` asserts the whole state after every step in tests and the simulator.
- Activities are namespaced (`poker.*`); a second activity adds a module and changes none of the room kernel.
- What leaves the package is what its `exports` map lists: `/protocol` (Zod schemas with types and decks; the server), `/types` (types, names, decks, value-object parsers, no Zod; every browser bundle), `/view` (`evolveView`, selectors, result builders, paste parser), `/server` (`decide`, `evolve`, `step`, `project`, `publish`, `check`, the runtime), `/sim` (the seeded clock, then the simulator and bots).

## Why

Logic that can only be tested through a socket cannot be replayed, and a hidden vote that leaks through a mapper or a log line breaks the product's one promise. `docs/v9/ARCHITECTURE.md`, How a change happens and Invariants 3, 4, 9, 13, 15, 16.

## The check

- `scripts/boundaries.ts` in `make check-fast` resolves every import of a pure file and scans its source for the globals above; `scripts/boundaries.test.ts` plants one violation of each kind.
- oxlint refuses `effect` and `elysia` outside their folders.
- The core tests in `make check-fast` run `check(state)` after every step of 1,000 generated sessions, with the fast-check property "no other seat's value before reveal", and 200 simulator seeds check the runtime's invariants after every step (`src/sim/invariants.ts`).
- `packages/room-core/test/purity.test.ts` fails on `Date.now`, `Math.random`, `setTimeout`, `setInterval`, `WebSocket` or `fetch` anywhere under `src` outside `sim/`, comments included.
