# v9 engineering

How v9 code is written, checked and run: the patterns, the rules a script enforces, the CI pipeline and the development loop. `ARCHITECTURE.md` says what the system is; this file says how work on it goes. It binds the same directories. Sources: `research/r09-testing-ci.md`, `research/r14-ci-hosted-runners.md`, and the pipelines this estate already runs in basalt-ui, weatherorb and software-factory.

## Targets

| What | Target | Measured by |
|-|-|-|
| `make check-fast`, warm, on the mini | 60 s at most | `budgets.fast` in `project.yaml`; the factory signals a breach |
| CI on a pull request, wall clock | 8 min median, 12 min at the 90th percentile | the elapsed time of the whole `ci.yml` run, read weekly from `gh run list` |
| End-to-end suite in CI | 6 min at most, no retry used in a green run | Playwright report |
| Format and lint of staged files on commit | 2 s at most | lefthook's summary |
| Room entry JavaScript | 180 kB gzip at most | size-limit in CI |
| Flaky tests | none tolerated: a test that fails once without a code change is fixed or deleted in the next row that touches its area | JUnit history through `factory read throughput` |

A target that is missed is reported with its number; it is never met by removing a check.

## Code patterns

Seven patterns carry the codebase. Each names the failure it prevents.

| Pattern | Rule | Prevents |
|-|-|-|
| Functional core, imperative shell | `packages/room-core` decides; adapters do. The reducer returns state, events and effects as data. Adapters persist, publish and time them | logic that can only be tested through a socket |
| Ports and adapters | Every outside thing the core needs is an interface in `room-core` (transport, store, history, clock, ids, telemetry) with one production adapter and one in-memory adapter. Tests replace an adapter; they never mock a module | test doubles that drift from the real thing |
| Parse at the edge | A frame or request is validated once, where it enters the process. Past that point code trusts its types and validates nothing again | double validation and the bugs between two validators |
| Expected outcomes are values | A rejected command is a `nack` with a reason from a closed enum; an HTTP business error is a typed response. Exceptions mean a bug | `try` and `catch` as control flow, and user mistakes paged as errors |
| Capture once | An exception is recorded once, at a boundary: the runtime's command boundary, Elysia's `onError`, the browser's global handlers. Code below a boundary never catches to log | double capture |
| Injected time and chance | Nothing below an app's entry file reads the clock, a random source or the environment. They arrive as arguments | tests that sleep, and runs that cannot be replayed |
| One store per room on the client | `@fpp/room-client` owns room state. Components read it through selectors. TanStack Query holds HTTP data only. Preferences go through basalt-ui's `persisted`. No global store library | state in three places, which is v1's hardest bug source |

Carried over from v1 because they work (`docs/observability.md`):

- the `recordError(error, { component, action }, severity)` signature with its severity tree
- the list of what is never captured: user input, business conflicts, WebSocket close 1006
- the registry of attribute, event and metric names with derived types
- events as log records with `event.name`
- gauges as callbacks that sample state

Changed from v1:

- Domain events are emitted by the adapter from the reducer's output, never inside the reducer.
- The untyped `extra` bag and the module-level user context are gone.

### React

- The React Compiler is on. No `useMemo`, `useCallback` or `memo` for speed; keep one only where an identity feeds an external API, with the reason beside it.
- An effect synchronises with something outside React and does nothing else. `exhaustive-deps` is on (v1 switched it off).
- A component in `packages/table` takes a view and callbacks. It never imports `@fpp/room-client`, so every table state can be rendered from a fixture.
- A lint suppression carries its reason on the same line.

### Validation

Protocol frames are Zod schemas in `packages/room-core`: the package depends on no framework, so the protocol does not move when Elysia does. HTTP routes in `apps/api` use Elysia's own `t` (TypeBox 1.x in Elysia 2), because Eden's type inference and the OpenAPI output are native to it; whether Eden keeps its types with Zod schemas is not documented. The browser bundle imports types only and ships no validator.

### Files and names

- Files are kebab-case, with a role suffix where a module has several parts: `room.reducer.ts`, `room.project.ts`, `room.ports.ts`, as v1's server does.
- Named exports only. `type` for data, `interface` for ports.
- A package exposes what its `exports` map lists and nothing else. No other barrel file.
- A test sits beside its code as `*.test.ts`. Playwright files end in `*.e2e.ts`, so `bun test` never picks them up.
- Each app parses its environment once in `env.ts` and passes values down.

### Migrations

Two server versions run against one database during every deploy. A migration must therefore work with the previous release's code: add first (expand), ship, remove in a later release (contract). A migration that drops or renames something the previous release reads is refused by review. Migrations only go forward.

### Dependencies

Exact pins. A pre-release such as Elysia 2 is installed by version, never by tag: `latest` on npm is still the 1.4 line, and the tags have moved before. A new runtime dependency names its reason and its size in the pull request. The versions in `ARCHITECTURE.md` are a starting point: check each with `agw web package` on the day.

## What a script enforces

A rule that can be checked is a check, not a sentence. All of these run in `make check-fast`, with two exceptions: size-limit needs a build and runs in CI's `check` job, and the transport contract suite needs sockets and runs in `make check`.

| Check | Enforces |
|-|-|
| `scripts/boundaries.ts` over a table in the repo root | The dependency arrows of the repo map; a class per module (`pure`, `adapter`, `shell`); a `pure` module does no I/O: its imports are resolved and may not reach `node:*` or `bun:*`, and its source is scanned for the globals `fetch`, `WebSocket`, the timer functions, `Date.now` and `Math.random`; no import reaches into another package past its `exports`; apps never import each other. The pattern is software-factory's `scripts/boundaries.ts` and weatherorb's `class-lint` |
| oxlint | restricted imports (OpenTelemetry APIs outside `packages/telemetry`, `@fpp/room-client` inside `packages/table`, `elysia` and `@elysia/*` outside `apps/api/src/http` and `apps/api/src/ws`), no explicit `any`, the React hook rules, type-only imports, unused code |
| Type check | strict mode; the protocol types shared by server and client |
| Core tests and 200 simulator seeds | the invariants of `ARCHITECTURE.md` |
| Telemetry content test | no display name, slug or vote value in any exported span, log or metric |
| Protocol drift test | schemas, fixtures and `protocol.md` name the same frames |
| Transport contract suite | frames, close codes and the drain against the pinned Elysia; it runs on every version bump (server tier, in `make check`) |
| size-limit (CI only) | the bundle budgets |
| `factory plan check`, `factory project check` | the plan and project files |

`pure`: `packages/room-core`, the names in `packages/telemetry`, the layout function in `packages/table`. `adapter`: `apps/api/src/ws`, `apps/api/src/db`, `packages/room-client`, the facades in `packages/telemetry`. `shell`: the entry files of the three apps.

## Local checks

| When | Runs | Budget |
|-|-|-|
| On commit (lefthook) | oxfmt check and oxlint on staged files of v9 paths; v1's commands only when v1 paths are staged | 2 s |
| Before every push | `make check-fast`: format check, lint, types, boundaries, core tests, 200 simulator seeds, the unit tests of every v9 package | 60 s |
| On demand | `make check`: `check-fast` plus the server tests against Postgres, the build and v1's gate. `make e2e` and `make load` are separate targets that need Docker and run through `factory slot run` | CI runs `make check` and the end-to-end suite on every pull request; a lead reruns a heavy suite locally only to reproduce a CI failure. The load test is nightly and on demand, never part of the gate |

Every test target writes a JUnit file to `$FACTORY_JUNIT_DIR` when that variable is set, and no JUnit file when it is not. The factory sets it inside a slot, so it measures duration and flake rate per step; CI and a bare local run skip the report.

## CI

One workflow, `ci.yml`, on pull requests and on pushes to `master`. Hosted runners: the repository is public, so standard runners are free, with 4 vCPU and 16 GB each and 20 jobs at once.

| Job | Runs when | Does | Expected |
|-|-|-|-|
| `lanes` | always | reads `.github/lanes` and the diff, outputs one boolean per lane | 20 s |
| `check` | lane `v9` | the v9 part of `make check` against a `postgres:18` service, then size-limit | 3 min |
| `image` | lane `v9` | builds the API image with the GitHub cache backend, one scope per image; hands it on as an artifact | 3 min warm, up to 10 cold |
| `e2e` (2 shards) | lane `v9` | loads the image, starts `deploy/compose.yml`, runs Playwright in Chromium with blob reports and a trace on first retry | 4 min |
| `e2e-report` | after `e2e` | merges the blobs into one HTML report and writes annotations | 1 min |
| `v1` | lane `v1` | v1's existing validation, called as a reusable workflow | as today |
| `ci` | always | fails if any needed job failed or was cancelled. The only required check | 10 s |

Decisions in that table, each with its reason:

- **Lanes by a file and a script, not by `paths:` on the workflow.** A workflow that a path filter skips leaves its required check pending forever; a job skipped by a condition counts as passed. `.github/lanes` holds one line per lane with its path specs, `.github/lanes.sh` diffs against the base, and the Makefile reads the same file, so local and CI agree on what a change touches. A change under `.github/`, to `bun.lock` or to the root `package.json` runs every lane. This is weatherorb's mechanism.
- **One gate job.** Branch protection names `ci` and nothing else, so adding or renaming a job never blocks merges. The gate passes a skipped lane only when `lanes` said to skip it.
- **Cancel superseded runs on pull requests only.** The concurrency group is the workflow plus the pull request number; pushes to `master` always finish, because they deploy.
- **No dependency cache beyond the Bun binary, unless measurement says otherwise.** Bun's own benchmark puts a frozen install of a 220-package app at about one second without a cache and 0.2 s with one, so a restore step has under a second to win. The foundation row measures both on a hosted runner and keeps the faster; it is revisited if the install passes 15 s.
- **The suite tests the compose file users self-host with.** It runs on the runner itself, not in a container, because one test replaces the API container mid-round and needs Docker. Chromium only on pull requests keeps the browser install small.
- **Actions are pinned** to the majors current on 2026-11-18 (`checkout` v7, `cache` v6, `setup-bun` v2, `build-push-action` v7), Bun to one exact version from a file every workflow reads, runners to `ubuntu-24.04`.

`nightly.yml` starts at a minute that is not on the hour and runs:

- 10,000 simulator seeds
- the reduced load profile
- Firefox, WebKit and a phone profile, in the official Playwright image
- an arm64 build

A scheduled run is best effort on GitHub, so nothing depends on it having run. A red nightly is a signal to the factory, not a merge blocker.

Deploys are separate workflows: `deploy-next.yml` rolls the API image to the beta host on pushes that touch v9 paths, and from stage 3 the site deploys with wrangler. Path filters are safe there because no required check lives in them. v1's `deploy.yml` and its Vercel build get the same kind of filter in the foundation row: until then every push to `master` redeploys v1's server and interrupts rooms in progress. SonarCloud keeps running outside the gate, with v9's sources added to its configuration.

## The development loop

| Need | Command or place |
|-|-|
| Run everything | `bun run dev:v9`: Astro on 7738, Vite on 7739, the API on 7740 with hot reload. One address, `https://fpp-next.test`, splits paths as production does |
| A database | `fpp` on the mini's Postgres. `bun run db:migrate`, `db:reset`, and `db:seed`, which writes a room with a year of rounds so the insights have something to show |
| A full table without colleagues | `bun run bots --room demo --seats 12`: simulator bots join a real local room through `@fpp/room-client`, vote, drop and return. Flags choose behaviour and speed |
| Every state of the table | the playground route, driven by the simulator: seat count, round state, presence, deck, width, reduced motion |
| Replay a failure | `bun run sim --seed <n>` prints the same trace every time |
| A server restart mid-round | restart the API: rooms come back from their snapshot, so hot reload never costs a test session |
| The shipped artefact | `make v9-up`: the image and Postgres from `deploy/compose.yml` |
| The real thing | `https://next.free-planning-poker.com`, at the commit `/api/version` names |

Environment files hold local values only; nothing in the loop needs 1Password. Agents never start the dev servers: a lead proves a change with tests, the compose stack in a slot, or the beta host.

## How a row ships

1. The lead reads its facts and the sections of `docs/v9` they name.
2. It works in its own worktree and runs `make check-fast` before each push.
3. The pull request states each acceptance line as met or not met, with the number or the output.
4. CI runs the full gate on the head; review runs at the tier the change needs.
5. The merge goes through the repo's merge window, rebased, with a linear history.
6. The push deploys to the beta host; `make verify` proves it.
7. A fact this page or `ARCHITECTURE.md` got wrong is corrected in the same pull request.
