# Free Planning Poker

Free Planning Poker is a free, open-source planning poker app for agile teams, live at https://free-planning-poker.com: open a room, share the link, estimate together, no account. `master` holds v9, a rewrite that factory leads build row by row from `docs/plan.yaml`, each starting cold from this file; v1 runs in production from the branch `v1` until the cutover. The contract for every row is `docs/v9/`: `ARCHITECTURE.md` (what the system is), `ENGINEERING.md` (how work on it goes), `UX.md`, `STRATEGY.md`, `PLAN.md`. `docs/README.md` indexes every other document. Read the sections your row names before the first edit.

## Repo map

The dependency arrows point down this table only. `boundaries.toml` holds the same map as data, and `make check-fast` fails on an arrow it does not draw or a module directory it does not list.

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

A module that does not exist yet is created by its row, and that row writes, in the same pull request, the module's `boundaries.toml` entry and its own `AGENTS.md` with what only work in that directory needs. No nested `AGENTS.md` is written ahead of its module. Before changing anything under a module that has one, Read its `AGENTS.md`.

## Rules by concern

Each file under `.claude/rules/` states one rule, its reason and the check that enforces it. Claude Code loads one when you open a file under its `paths:`; with any other tool, or before the files exist, Read the rule for your concern before the first edit.

- `pure-core.md`: `packages/room-core` and every pure file: decide, evolve, project, and what may not be imported.
- `protocol.md`: a frame, a command, an event or the protocol version changes.
- `effect.md`: Effect in `apps/api/src/app`, `src/db`, `src/jobs`.
- `transport.md`: the WebSocket and HTTP adapters in `apps/api/src/ws` and `src/http`, and Elysia.
- `tests.md`: any test: ports, Postgres, time, simulator seeds, flakes.
- `strings.md`: anything a person reads: the message catalogue, languages, `Intl`, layout direction.
- `basalt-ui.md`: the interface, and what to do when basalt-ui lacks something.
- `telemetry.md`: names, `recordError`, `recordEvent`, Umami events, what telemetry never carries.
- `migrations.md`: the schema and its migrations.

## Invariants

From `docs/v9/ARCHITECTURE.md`, section Invariants, which holds the full text. They cannot be retrofitted: changing one is a plan change with the owner's verdict, never a side effect of a row.

1. One origin for site, room app, API and WebSocket (Topology).
2. Room URLs are `/room/<slug>`; a locked room's access code rides in the fragment only (Room model).
3. The server is the only writer of room state; clients send commands (How a change happens).
4. A vote value leaves the server only after the reveal, before it only to its own seat; one function builds each seat's view (`project`).
5. A seat is proven by a server-minted secret scoped to one room; the device id counts visitors and authorises nothing (Data model).
6. Every server event carries the room's `seq`, every command a client message id; reconnect is last `seq` in, snapshot out (Protocol).
7. The protocol version is negotiated in `hello`; changes are additive, a breaking one raises the version (Protocol; rule `protocol.md`).
8. Durable state and ephemeral `fx` are separate: reactions are never stored and get no `seq`.
9. The reducer is pure: time, chance and ids come in through its context; room-core imports no runtime library (rule `pure-core.md`).
10. Measurement sets no cookie and shows no banner (Measurement).
11. Telemetry carries no vote value, display name, room name, topic title, tracker key or access code (rule `telemetry.md`).
12. One process owns a room at a time, by an epoch column in Postgres (Server).
13. The topic is the unit of estimation; topic and round ids are UUID v7 minted by the reducer (Room model).
14. Access is decided when a seat is minted; no owner, no admin, no key in a room (Room model).
15. One result contract, defined in room-core, for history, exports, embed messages and webhooks.
16. Activities are namespaced: `poker.*` commands and events; seats, presence, access and topics belong to the room.
17. One table, keyed by the address, holds every number and name that leads to a room (Data model).
18. No visible string lives in a component: message catalogue, `Intl`, logical properties, no language in a room URL (rule `strings.md`).

## Before your first edit: what an agent never does here

- **Start no dev server.** `bun run dev` is the owner's; prove a change with tests.
- **Listen on no fixed port and touch no shared database**, because many leads run their suites on one host at once: a port from `freePort()` (`@fpp/test-kit/port`), a database from `startPostgres()` (`@fpp/test-kit/postgres`), which starts a private cluster from `PG_BIN_DIR` (or the `initdb` on PATH) in a temporary directory. A test that needs Postgres is named `*.server.test.ts` and runs in `make check`, not in `check-fast`.
- **`packages/room-core` is pure.** No `node:*`, `bun` or `bun:*` import, no `fetch`, `WebSocket`, timers, `Date.now`, `Math.random`, `process` or `Bun`: time, chance and I/O arrive as arguments or ports. `scripts/boundaries.ts` refuses the rest.
- **Elysia** (`elysia`, `@elysia/*`) only in `apps/api/src/http` and `src/ws`, because it is a pinned release candidate (`2.0.0-rc.3`) whose API may move. **Effect** (`effect`, `@effect/*`) only in `apps/api/src/app`, `src/db` and `src/jobs`; nothing from `effect/unstable/*` anywhere. oxlint and the boundaries check both refuse the rest.
- **Install by version, never by npm tag**: `latest` of Elysia is the 1.4 line and tags have moved before. Pin every dependency exactly in the package that uses it (the isolated linker resolves nothing undeclared); check a version with `agw web package npm <name>` on the day. `bunfig.toml` refuses versions younger than 3 days.
- **Add no visible string outside the message catalogue** (invariant 18, rule `strings.md`), English and German complete in the same change.
- **Read v1 with `git show origin/v1:<path>`**, list it with `git ls-tree -r --name-only origin/v1`. Never merge `v1` and `master` in either direction and never push to `v1` from a row; v1's fixes and redeploys: `docs/shipping.md`, section v1.
- Files are kebab-case with a role suffix where a module has several parts (`room.reducer.ts`), named exports only, a test beside its code as `*.test.ts`; a package exposes only what its `exports` map lists. Each app parses its environment once in `env.ts` and passes values down.

## Validate

| Command | Runs | Budget, when |
|-|-|-|
| `bun install --frozen-lockfile` | the workspace; Bun pinned in `package.json` `packageManager` | after a pull |
| `make check-fast` | format check, oxlint, `tsc`, boundaries, unit tests (`*.test.ts`; the room-core properties; 200 simulator seeds), the factory files | 60 s (`budgets.fast`), about 15 s of CPU on the mini; before every push and after every change you author |
| `make check` | `check-fast`, the server tier (`*.server.test.ts`, each with its own Postgres), the build | CI runs it on every pull request; locally only to reproduce a CI failure, as `factory slot run -- make test-server` |
| `make site` | the site's four builds and their tests | lane `site`; CI job `site` |
| `make fmt` | oxfmt over the repo | when the format check fails |
| `make lanes` | which CI lanes this branch touches | when a row adds a lane job |

Each step prints its name and, on failure, `FAILED: <step>`. Later tiers arrive with their rows: component tests (Vitest browser, lane `ui`), the end-to-end suite (`*.e2e.ts`, `make e2e` in a slot, lane `browser`). `nightly.yml` runs 10,000 simulator seeds. A missed budget is reported with its number, never met by removing a check. Toolchain, ports and CI: `docs/development.md`.

## Deploy

1. Work in your worktree; `make check-fast` before each push.
2. Open a pull request into `master` from `.github/pull_request_template.md`: each acceptance line met or not met with its command and output, the decisions you took, the documents you updated.
3. CI (`.github/workflows/ci.yml`) runs `make check` in the job `check`; the job `ci` gates on every job and is the only required check. A new lane job goes into `.github/lanes`, gets `if: needs.lanes.outputs.<lane> == 'true'` and joins the `needs` of `ci`.
4. Merge is rebase-only (linear history) through the merge window: `factory land`.
5. Nothing on `master` deploys yet: `make deploy` is a no-op and v1 deploys from `v1`. From `v9-next-deploy` on, a push touching lane `app` rolls to the beta host.

Commits: `<type>(<scope>): <subject>`, types feat, fix, perf, refactor, docs, ci, chore, test, style, build; scope optional, `JK-<number>` if present; header at most 80 characters, body lines at most 300 (`commitlint.config.ts`, run by lefthook). No AI attribution anywhere. Releases are manual (`release.yml`); never edit `CHANGELOG.md` by hand. Branch protection, workflows, Vercel: `docs/shipping.md`.

## Verify & Monitor

`make verify` probes production, which is v1 until the cutover: `https://server.free-planning-poker.com/health`, `https://analytics.free-planning-poker.com/health` and the web root. Uptime Kuma monitors `FPP - Server - HTTP` and `FPP - Analytics - HTTP`; v1's OTel `service.name` is `fpp-server`. v9 emits as `fpp-api`, `fpp-room` and `fpp-site`, each registered in the vps repo's `observability/services.yaml` by the row that first emits it. `make logs` tails a v1 container.

## Gotchas

- oxfmt leaves Markdown alone, because it pads tables; write tables with the minimal `|-|-|` separator.
- `factory plan check` and `factory project check` run inside `check-fast` only where the factory CLI exists; CI skips them, so run `make check-fast` locally after editing `docs/plan.yaml` or `project.yaml`.
- A test target writes JUnit to `$FACTORY_JUNIT_DIR` only when it is set; a new test target follows the pattern in the `Makefile`.
- A fact in `docs/v9` that your row proves wrong is corrected in the same pull request.

## Keeping this setup true

- You lost time to something these files did not say: add the missing line to the nearest `AGENTS.md` or rule in the same pull request, within its budget (this file: 12,000 bytes).
- You find a rule wrong: change the rule and say so in the pull request.
- Friction with the factory itself goes to `factory signal file`, never into these files.
- A skill is added by the row that creates the loop it wraps (replaying a simulator seed, scoring an arena entry), not ahead of it.
