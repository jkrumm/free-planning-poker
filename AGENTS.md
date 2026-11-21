# Free Planning Poker

Free Planning Poker is a free, open-source planning poker app for agile teams, live at https://free-planning-poker.com. `master` holds v9, a rewrite in progress built by factory leads row by row from `docs/plan.yaml`. v1 runs in production from the branch `v1` until the cutover. The contract for every row is `docs/v9/`: `ARCHITECTURE.md` (what the system is), `ENGINEERING.md` (how work on it goes), `UX.md`, `STRATEGY.md`, `PLAN.md`. Read the sections your row names before the first edit.

## Repo map

The dependency arrows point down this table only. `boundaries.toml` holds the same map as data, and `make check-fast` fails on an arrow it does not draw or a module directory it does not list. A module that does not exist yet is created by its row.

| Path | Package | Class | Holds | May import |
|-|-|-|-|-|
| `apps/site` | `@fpp/site` | shell at its entry | Astro marketing site | table, room-core, telemetry |
| `apps/room` | `@fpp/room` | shell at `src/main.tsx` | Vite SPA: the room | table, room-client, room-core, telemetry |
| `apps/api` | `@fpp/api` | shell at `src/main.ts`; `src/ws`, `src/db` adapter | Elysia HTTP API, WebSocket room server, Postgres, jobs | room-core, telemetry |
| `apps/arena` | `@fpp/arena` | | the table arena | table, room-core |
| `packages/table` | `@fpp/table` | `src/layout.ts` pure | the game surface as React components | room-core (types only) |
| `packages/room-client` | `@fpp/room-client` | adapter | headless client: connection, pending commands, resume | room-core |
| `packages/room-core` | `@fpp/room-core` | pure | protocol, room kernel, `poker` activity, decks, runtime behind ports, simulator | nothing |
| `packages/telemetry` | `@fpp/telemetry` | names pure, facades adapter | attribute, event and metric names; `recordError`, `recordEvent` | nothing |
| `packages/test-kit` | `@fpp/test-kit` | | `freePort`, `startPostgres`: for test files only | nothing |
| `e2e` | `@fpp/e2e` | | Playwright suite against the built image | nothing at runtime |

A pure module does no I/O. An adapter does I/O but reads no environment. A shell is an app's entry file: it reads the environment and the clock and wires the rest.

## Before your first edit

- **`packages/room-core` is pure.** No `node:*`, `bun` or `bun:*` import, no `fetch`, `WebSocket`, timers, `Date.now`, `Math.random`, `process` or `Bun`: time, chance and I/O arrive as arguments or ports, so every rule is testable without a socket. `scripts/boundaries.ts` enforces it.
- **Elysia** (`elysia`, `@elysia/*`) is imported in `apps/api/src/http` and `apps/api/src/ws` only, because it is a pinned release candidate (`2.0.0-rc.3`) whose API may still move. **Effect** (`effect`, `@effect/*`) only in `apps/api/src/app`, `src/db` and `src/jobs`; nothing from `effect/unstable/*` anywhere. oxlint and the boundaries check both refuse the rest.
- **Elysia 2 is installed by version, never by npm tag**: `latest` is the 1.4 line and the tags have moved before. Every dependency is pinned exactly in the package that uses it (the isolated linker resolves nothing undeclared); check a version with `agw web package npm <name>` on the day. `bunfig.toml` refuses versions younger than 3 days.
- **Tests take a free port and a private database.** `freePort()` from `@fpp/test-kit/port`; `startPostgres()` from `@fpp/test-kit/postgres` starts a cluster from `PG_BIN_DIR` (or the `initdb` on PATH) in a temporary directory. No test listens on a fixed port or touches a shared database: many leads run their suites on one host at once. A test that needs Postgres is named `*.server.test.ts` and runs in `make check`, not in `check-fast`.
- **Agents start no dev server.** Prove a change with tests; `bun run dev` is for the owner.
- **Read v1 with `git show origin/v1:<path>`** (list it with `git ls-tree -r --name-only origin/v1`). Never merge `v1` and `master` in either direction. v1's fixes and redeploys: `docs/shipping.md`, section v1.
- Files are kebab-case, named exports only, a test beside its code as `*.test.ts`; a package exposes only what its `exports` map lists. Each app parses its environment once in `env.ts` and passes values down.

## Commands

| Command | Runs | When |
|-|-|-|
| `bun install --frozen-lockfile` | the workspace; Bun is pinned in `package.json` `packageManager` | after a pull |
| `make check-fast` | format check, oxlint, `tsc`, boundaries, unit tests, the factory files; about 3 s on the mini, budget 60 s | before every push |
| `make check` | `check-fast`, the server tests (`*.server.test.ts`), the build | CI runs it on every pull request; locally only to reproduce a CI failure |
| `make fmt` | oxfmt over the repo | when the format check fails |
| `make lanes` | which CI lanes this branch touches | when a row adds a lane job |
| `make verify`, `make logs` | probe and tail production, which is still v1 | after a ship |

Each step of a check target prints its name and, on failure, `FAILED: <step>`. Test targets write JUnit to `$FACTORY_JUNIT_DIR` only when it is set. `docs/development.md` has the toolchain, ports and CI details.

## Shipping

- Every change goes through a pull request into `master`; `ci` is the only required check. CI (`.github/workflows/ci.yml`) runs `make check` in the job `check`; the job `ci` gates on every job. A new lane job goes into `.github/lanes`, gets `if: needs.lanes.outputs.<lane> == 'true'` and joins the `needs` of `ci`.
- Merge is rebase-only (linear history) through the merge window: `factory land`.
- **Commits:** `<type>(<scope>): <subject>`; types feat, fix, perf, refactor, docs, ci, chore, test, style, build; scope optional, `JK-<number>` if present; header at most 80 characters, body lines at most 300 (`commitlint.config.ts`, run by lefthook beside the staged files' format check and lint). No AI attribution anywhere.
- **Deploy:** nothing on `master` deploys yet; `make deploy` is a no-op and v1 deploys from `v1`. Releases are manual (`release.yml`); never edit `CHANGELOG.md` by hand. Branch protection, workflows, Vercel and releases: `docs/shipping.md`.
- A fact in `docs/v9` that your row proves wrong is corrected in the same pull request.
