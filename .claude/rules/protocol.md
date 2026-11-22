---
paths:
  - "packages/room-core/src/protocol/**"
  - "packages/room-core/src/**/*.schema.ts"
  - "packages/room-core/fixtures/**"
  - "docs/v9/protocol.md"
---

# A protocol change

The protocol is the contract between every server and every browser tab still open on an older build. During each deploy two server versions run side by side, and a tab can live for days, so a frame changes by addition and never in place.

## The rule

A pull request that adds or changes a frame, a command, an event, a close code or a `nack` reason holds all four, or CI is red:

1. **The schema**: the Zod schema in `packages/room-core` (`/protocol` entry point), and its TypeScript type under the types entry, which imports no Zod so the browser ships no validator. Protocol frames are Zod, never Elysia's `t`, so the protocol does not move when Elysia does.
2. **The fixture**: one JSON file per frame, command and event type under `packages/room-core/fixtures/v<version>/`. The fixtures of the last released protocol version are never edited or deleted; they keep passing forever.
3. **`docs/v9/protocol.md`**: the exact reference, updated in the same change. `v9-room-core` writes it; until then `docs/v9/ARCHITECTURE.md`, section Protocol, is the reference.
4. **The version**: an additive change (a new optional field, a new event or command type) keeps `v`; a client ignores unknown fields and types. A removed or renamed field, a changed meaning or a new required field raises the protocol version, and the server closes an old client with 4001 so it reloads (invariant 7).

Also: every frame is a JSON object; a command is named `<owner>.<verb>` and its event the past tense (`poker.vote`, `poker.voted`); every event carries the room's `seq` and is identical for all seats, so it never carries a hidden value (invariant 4); `fx` frames get no `seq` and are never stored (invariant 8). A frame is parsed once, where it enters the process, and trusted after that.

## Why

`docs/v9/ARCHITECTURE.md`, Protocol and Invariants 6, 7, 8. A schema without its fixture or its reference drifts; a changed field without a version bump breaks every open tab during a deploy.

## The check

- The protocol drift test in `make check-fast` fails when the schemas, the fixtures and `protocol.md` do not name the same frames, and another test when a command or event type lacks one of the owner prefixes `poker.`, `topic.`, `seat.`, `room.` (both from `v9-room-core` on).
- The fixtures of the last released version run in the core tests.
- The transport contract suite (`make check`) sends the fixtures through the real adapter.
