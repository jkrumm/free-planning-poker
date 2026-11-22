# packages/room-core

The room's rules as pure functions, and the protocol every browser and server speaks. Rule `pure-core.md` (what may not be imported or called) and rule `protocol.md` (what a protocol change holds) apply to every file here; `docs/v9/protocol.md` is the exact protocol.

## Where things are

| Path | Holds |
|-|-|
| `src/protocol/types.ts`, `schema.ts`, `names.ts` | the wire types (no Zod), their Zod schemas (`tsc` fails when the two differ), the name lists (`tsc` fails when a list misses a type) |
| `src/values.ts`, `src/decks.ts` | value objects: a branded type and its parser, the only constructor; the schemas wrap the parsers |
| `src/kernel/` | seats, roles, presence, settings, access, topics. `kernel.decide.ts` judges, `kernel.evolve.ts` applies; it imports no activity |
| `src/poker/` | the activity: `poker.decide.ts` (rules, follow-ups such as auto reveal, effects), `poker.evolve.ts` (shared by server state and client view) |
| `src/room.ts` | `initialState`, `decide`, `evolve`, `step`: the composition of kernel and activity |
| `src/project.ts` | `project` and `publish`, the only ways out of the server: the vote redaction lives here |
| `src/view.ts` | `evolveView`, `withOwnVote`, selectors |
| `src/result.ts`, `src/paste.ts`, `src/check.ts` | result contract builders, the paste parser, the invariants |
| `src/sim/` | the seeded clock and UUID v7 source; the simulator joins it in `v9-room-runtime` |
| `*.entry.ts` | the entries of `package.json` `exports`. `/types` and `/view` must stay free of Zod and of `decide`: `test/bundle.test.ts` builds them and checks |

## Changing a rule

- A decide file never changes state: it returns `DomainEvent[]` or `{ reject }` with a reason from `NACK_REASONS`. State changes only in an evolve function, and `evolveRounds` and `evolveKernel` serve the server's state and a client's view alike, so a change there keeps property (f) (`evolveView` equals `project`) true by construction.
- Time and ids come from `ctx` only. A new id is `ctx.newId()`, called in `decide`, never in `evolve`.
- A new command or event touches `types.ts`, `schema.ts`, `names.ts`, its decide and evolve case, a fixture under `fixtures/v1/` (hand-written; the v1 files are frozen once v1 is released), and a section of `docs/v9/protocol.md`. `test/protocol.test.ts` names what is missing.
- A second activity is a new directory beside `poker/`; the kernel only learns what `KernelActivity` asks.

## Tests

- `test/properties.test.ts` plays 1,000 generated sessions and asserts properties (a) to (k) after every step. A failure prints `{ seed, path }`; replay with `fc.assert(..., { seed, path, endOnFailure: true })` before fixing, then keep the counterexample as a test in `test/room.test.ts`.
- It is the most expensive file in `make check-fast` (2 to 7 s of CPU, more on a loaded host). Grow its generator, not its run count, and keep the run count at 1,000.
- `test/room.test.ts` holds the rules one by one; `test/support.ts` gives a room on a seeded clock.
