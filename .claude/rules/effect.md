---
paths:
  - "apps/api/src/app/**"
  - "apps/api/src/db/**"
  - "apps/api/src/jobs/**"
---

# Effect in the API's adapters and jobs

Effect is for code in `apps/api` that waits on something that can fail: the Postgres store (debounced snapshot writes, retry with backoff, the wait during an outage), the jobs (sweeps and rollups on a schedule), startup and the drain (resources acquired in order, released in reverse), and later the webhook relay.

## The rule

- `effect` and `@effect/*` are imported in `apps/api/src/app`, `src/db` and `src/jobs` only. Nothing from `effect/unstable/*`, anywhere (Effect's RPC lives there).
- The ports stay plain TypeScript `interface`s that return promises. The core, the room loop, the simulator, every test double and the browser never see Effect: the composition root in `src/app` runs an Effect program behind a port.
- Effect is pinned at one exact 4.1.x version in `apps/api/package.json`. Before writing Effect, load the library's own guidance for version 4 and run its type-aware lint rules (`make check-fast` runs them, over these three folders): models trained on 3.x mix the two APIs (`docs/v9/research/r18-effect.md`).
- A failure the caller can act on is a typed error in the Effect's error channel; a bug is a defect, recorded once at the boundary. No hand-rolled retry loop: use `Schedule`.
- Time comes from Effect's `Clock` or the injected clock, so tests run on a test clock and never sleep.

## Why

Hand-rolled retries and half-released resources are where an outage turns into lost rounds; a runtime inside pure code gives it nothing to manage and makes the browser carry it. `docs/v9/ENGINEERING.md`, Code patterns ("Effect where I/O fails"); `docs/v9/ARCHITECTURE.md`, Server.

## The check

Effect's rules ship in `@effect/tsgo` (the `effecttsgo/*` rules; `@effect/language-service` is its TypeScript 5 and 6 plugin and does not apply on TypeScript 7). Stock oxlint cannot load them: `effect-tsgo oxlint` runs oxlint with the patched binding and `oxlint-tsgolint`, configured in `.oxlintrc.effect.json` (the package's recommended preset, with oxlint's own categories off so only Effect findings show). `make check-fast` runs it over `src/app`, `src/db` and `src/jobs` with `--deny-warnings`. The two oxlint binaries, `@effect/tsgo` and `oxlint-tsgolint` are pinned together in the root `package.json`: move them as a set, to versions the `@effect/tsgo` README lists as supported.

oxlint (`.oxlintrc.json`, restricted imports) shows a misplaced import in the editor, and `scripts/boundaries.ts` in `make check-fast` refuses `effect` outside the three folders and `effect/unstable` everywhere. The fault tests in `make check` stop, slow and restart Postgres under a running round.
