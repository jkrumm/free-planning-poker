# v9 engineering

How v9 code is written, checked and run: the patterns, the rules a script enforces, the CI pipeline and the development loop. `ARCHITECTURE.md` says what the system is; this file says how work on it goes. It binds everything on `master`. Sources: `research/r09-testing-ci.md`, `research/r14-ci-hosted-runners.md`, and the pipelines this estate already runs in basalt-ui, weatherorb and software-factory.

## Where v1 lives

v1 needs no work until the cutover (the owner's ruling of 2026-11-20), so the two versions do not share a branch. `master` becomes v9 only. v1 is frozen on the branch `v1` and keeps running in production from there.

| | v1 | v9 |
|-|-|-|
| Code | the branch `v1`, tagged at the freeze | `master` |
| Production | Vercel builds `v1` as its Production Branch; `deploy.yml` on that branch rolls out the server and the analytics service | the beta host until the cutover |
| A fix, should one be needed | a commit on `v1`; the push deploys it | a row |
| CI | that branch's own workflows | `ci.yml` |

Two other layouts were weighed.

- **Side by side in one tree**, as the first version of this plan had it. The root `package.json`, the lockfile, the lint and format configs, lefthook, the Makefile, `AGENTS.md` and `project.yaml` each exist once. Sharing them means two toolchains in every one of those files for months, a v1 lane in CI, and a root `AGENTS.md` that tells every lead about the Pages Router.
- **A `v9/` directory, promoted at the end.** The promotion renames every path at the worst moment, the cutover.

The row `v9-freeze-v1` does the freeze in this order. Production sees one redeploy of unchanged code.

1. Tag the last v1 commit, create the branch `v1` from it, protect it against force pushes.
2. On `v1`, point the triggers of `deploy.yml` and of the pull-request workflows at `v1`. A workflow started by a push runs from the pushed branch's own file, so v1 keeps its pipeline with nothing on `master`.
3. The owner sets the Vercel project's Production Branch to `v1` (Environments, Production, Branch Tracking).
4. The row tests, on a throwaway branch without `apps/web`, which documented switch keeps Vercel from building other branches: `git.deploymentEnabled` in `vercel.json`, or the project's Ignored Build Step. If it is the second, the owner sets it too.
5. Only then, on `master`, one pull request removes v1's directories and workflows and keeps `docs/`, the release tooling and the licence. `v9-foundation` builds on the cleared root.
6. `make verify` keeps probing production, which is still v1.

Two limits. A manual redeploy of v1 is an empty commit on `v1`, because a workflow can be dispatched by hand only while its file is on the default branch. And v1 gets no dependency updates while frozen; the repo has neither Dependabot nor Renovate today, so nothing changes there.

Leads read v1 with `git show origin/v1:<path>`: the behaviour behind the table "What changes for a v1 user" in `UX.md`, the sounds, the copy and the importer's source schema come from there.

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

Ten patterns carry the codebase. Each names the failure it prevents.

| Pattern | Rule | Prevents |
|-|-|-|
| Functional core, imperative shell | `packages/room-core` decides; adapters do. The core returns state, events and effects as data. Adapters persist, publish and time them | logic that can only be tested through a socket |
| Decide, then evolve | A command becomes events in `decide`. Only `evolve` changes state. Only events are published (`ARCHITECTURE.md`, "How a change happens") | rules scattered over handlers, and state that changed without a trace |
| Effect where I/O fails | In `apps/api`, code that waits on something that can fail (Postgres, a schedule, a webhook, shutdown) is an Effect program behind a plain port. The core, the room loop and the browser import no Effect | hand-rolled retry loops and half-released resources on one side, a runtime inside pure code on the other |
| Ports and adapters | Every outside thing the core needs is an interface in `room-core` (transport, store, history, clock, ids, telemetry) with one production adapter and one in-memory adapter. Tests replace an adapter; they never mock a module | test doubles that drift from the real thing |
| Parse at the edge | A frame or request is validated once, where it enters the process. Past that point code trusts its types and validates nothing again | double validation and the bugs between two validators |
| Expected outcomes are values | A rejected command is a `nack` with a reason from a closed enum; an HTTP business error is a typed response. Exceptions mean a bug | `try` and `catch` as control flow, and user mistakes paged as errors |
| Capture once | An exception is recorded once, at a boundary: the runtime's command boundary, Elysia's `onError`, the browser's global handlers. Code below a boundary never catches to log | double capture |
| Injected time and chance | Nothing below an app's entry file reads the clock, a random source or the environment. They arrive as arguments | tests that sleep, and runs that cannot be replayed |
| Messages, not strings | Everything a person reads comes from the message catalogue, with plural rules; numbers and dates go through `Intl`; spacing and alignment use logical properties (`ARCHITECTURE.md`, invariant 18) | a second pass over every component when the second language arrives |
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

Effect is pinned at one 4.1.x version, and lint refuses imports from `effect/unstable/*`. A lead that writes Effect loads the library's own guidance for version 4 and runs its type-aware lint rules, which work under oxlint: models trained on 3.x otherwise mix the two (`research/r18-effect.md`).

## What a script enforces

A rule that can be checked is a check, not a sentence. All of these run in `make check-fast`, with two exceptions: size-limit needs a build and runs in CI's `check` job, and the transport contract suite needs sockets and runs in `make check`.

| Check | Enforces |
|-|-|
| `scripts/boundaries.ts` over a table in the repo root | The dependency arrows of the repo map; a class per module (`pure`, `adapter`, `shell`); a `pure` module does no I/O: its imports are resolved and may not reach `node:*` or `bun:*`, and its source is scanned for the globals `fetch`, `WebSocket`, the timer functions, `Date.now` and `Math.random`; no import reaches into another package past its `exports`; apps never import each other. The pattern is software-factory's `scripts/boundaries.ts` and weatherorb's `class-lint` |
| oxlint | restricted imports (OpenTelemetry APIs outside `packages/telemetry`, `@fpp/room-client` inside `packages/table`, `elysia` and `@elysia/*` outside `apps/api/src/http` and `apps/api/src/ws`, `effect` and `@effect/*` outside `apps/api/src/app`, `src/db` and `src/jobs`, anything under `effect/unstable`), no explicit `any`, the React hook rules, type-only imports, unused code |
| Type check | strict mode; the protocol types shared by server and client |
| Core tests and 200 simulator seeds | the invariants of `ARCHITECTURE.md` |
| Telemetry content test | no display name, slug or vote value in any exported span, log or metric |
| Protocol drift test | schemas, fixtures and `protocol.md` name the same frames |
| Transport contract suite | frames, close codes, the drain and a slow consumer against the transport adapter; it decided the bake-off and runs on every version bump (server tier, in `make check`) |
| Message check | no literal text in JSX, and no message key missing in a shipped language |
| size-limit (CI only) | the bundle budgets |
| `factory plan check`, `factory project check` | the plan and project files |

`pure`: `packages/room-core`, the names in `packages/telemetry`, the layout function in `packages/table`. `adapter`: `apps/api/src/ws`, `apps/api/src/db`, `packages/room-client`, the facades in `packages/telemetry`. `shell`: the entry files of the three apps.

## Local checks

| When | Runs | Budget |
|-|-|-|
| On commit (lefthook) | oxfmt check and oxlint on staged files | 2 s |
| Before every push | `make check-fast`: format check, lint, types, boundaries, core tests, 200 simulator seeds, the unit tests of every package | 60 s |
| On demand | `make check`: `check-fast` plus the server and fault tests against Postgres and the build. `make e2e` and `make load` are separate targets that need Docker and run through `factory slot run` | CI runs `make check` and the end-to-end suite on every pull request; a lead reruns a heavy suite locally only to reproduce a CI failure. The load test is nightly and on demand, never part of the gate |

Every test target writes a JUnit file to `$FACTORY_JUNIT_DIR` when that variable is set, and no JUnit file when it is not. The factory sets it inside a slot, so it measures duration and flake rate per step; CI and a bare local run skip the report.

## CI

One workflow, `ci.yml`, on pull requests and on pushes to `master`. Hosted runners: the repository is public, so standard runners are free, with 4 vCPU and 16 GB each and 20 jobs at once.

| Job | Runs when | Does | Expected |
|-|-|-|-|
| `lanes` | always | reads `.github/lanes` and the diff, outputs one boolean per lane | 20 s |
| `check` | always | `make check` against a `postgres:18` service, then size-limit | 3 min |
| `image` | lane `app` | builds the API image with the GitHub cache backend, one scope per image; hands it on as an artifact | 3 min warm, up to 10 cold |
| `e2e` (2 shards) | lane `app` | loads the image, starts `deploy/compose.yml`, runs Playwright in Chromium with blob reports and a trace on first retry | 4 min |
| `e2e-report` | after `e2e` | merges the blobs into one HTML report and writes annotations | 1 min |
| `site` | lane `site`, from stage 3 | builds the Astro site, checks links and the page budgets | 2 min |
| `ci` | always | fails if any needed job failed or was cancelled. The only required check | 10 s |

Decisions in that table, each with its reason:

- **Lanes by a file and a script, not by `paths:` on the workflow.** A workflow that a path filter skips leaves its required check pending forever; a job skipped by a condition counts as passed. `.github/lanes` holds one line per lane with its path specs (`app`: the core, the API, the client, the table and the room app; `site`: the marketing site and its content), `.github/lanes.sh` diffs against the base, and the Makefile reads the same file, so local and CI agree on what a change touches. A change under `.github/`, to `bun.lock` or to the root `package.json` runs every lane. This is weatherorb's mechanism.
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

Deploys are separate workflows: `deploy-next.yml` rolls the API image to the beta host on pushes that touch lane `app`, and from stage 3 the site deploys with wrangler. Path filters are safe there because no required check lives in them. v1's workflows live on its own branch. SonarCloud keeps running outside the gate.

## Built for the factory

Rows are built by leads that run side by side, each in its own worktree, with nobody watching. The repo is arranged for that.

| Need | How the repo meets it |
|-|-|
| Rows that do not collide | The repo map gives each row one module. A dependency is declared in the package that uses it. The lockfile and `docs/plan.yaml` are the only shared files, and the plan has a merge driver |
| Many leads on one host | No test listens on a fixed port: ports come from the operating system. Each test run starts its own Postgres cluster from the binaries in `PG_BIN_DIR`, in a temporary directory. No test touches the shared database |
| Heavy steps off the mini | `project.yaml` declares the server and fault tests as steps with `remote: true`, so the factory may run them on its Linux step host. That host's image has PostgreSQL 16 and production runs 18: the schema uses nothing newer than 16, and CI proves it on 18 |
| Checks while a lead works | The fast and the full gate are declared in `project.yaml`, so the factory runs a lead's own format, lint, type and test steps before a pull request exists, on the mini or on its Linux step host. CI repeats the gate on GitHub's runners for the pull request (owner ruling of 2026-11-20) |
| Steps that need Docker | The end-to-end suite and the load test run in a slot on the mini and, on every pull request, in CI. A lane `browser: 2` caps how many leads run Playwright at once |
| A lead that knows when it is done | Every acceptance line is a command with an expected output or a number. A row for the interface attaches the arena's screenshots of the states it touched |
| No waiting on the owner | No row carries a Spec. The plan has five gates, each a product verdict: concept, table, finished room, cutover, v1's data. Everything else a lead decides and records in its pull request |
| A red run that explains itself | Every test target writes JUnit where the factory asks. A failing simulator seed prints the command that replays it |

**CI stays on GitHub's runners.** The repository is public, and GitHub advises against self-hosted runners on public repositories: a pull request from a fork can run its code on the machine (`research/r21-freeze-v1-branch.md`). Hosted runners cost nothing here. Linux capacity outside GitHub is used through the factory's step host, which runs the steps of the factory's own leads and never a stranger's pull request.

## Ready for agents before the first feature

The owner ruled on 2026-11-20 that the setup for agents and the factory comes before implementation and is improved along the way. `v9-agent-setup` builds it after the foundation, and every row that builds v9's features waits for it.

| Part | What it holds |
|-|-|
| Root `AGENTS.md`, at most 12,000 bytes | what every task needs: the repo map with each module's class, the commands and their budgets, the invariants as one line each, how a row ships, what an agent never does here |
| A module's `AGENTS.md` | written by the row that creates the module, in the same pull request |
| `.claude/rules/`, loaded by path | one short file per concern, each with the rule, its reason and the check that enforces it: the pure core, a protocol change, Effect in the adapters, the transport, tests, visible strings, basalt-ui, telemetry, migrations |
| Skills | added by the row that creates the loop a skill wraps: replaying a simulator seed, scoring an arena entry |
| The pull request template | the evidence for each acceptance line, the decisions a lead took, the documents it updated |
| `project.yaml` | checks, remote steps, lanes and budgets, each with its reason |

It is proven by a cold read. An agent that knows only the repository answers seven questions a lead must be able to answer, and the files are changed until it does.

A lead that lost time to something the files did not say adds the missing line in the same pull request; friction with the factory itself is reported with `factory signal file`.

## The development loop

| Need | Command or place |
|-|-|
| Run everything | `bun run dev`: Astro on 7738, Vite on 7739, the API on 7740 with hot reload. One address, `https://fpp-next.test`, splits paths as production does |
| A database | `fpp` on the mini's Postgres. `bun run db:migrate`, `db:reset`, and `db:seed`, which writes a room with a year of rounds so the insights have something to show |
| A full table without colleagues | `bun run bots --room demo --seats 12`: simulator bots join a real local room through `@fpp/room-client`, vote, drop and return. Flags choose behaviour and speed |
| Every state of the table | the arena, driven by the simulator: entry, seat count, round state, presence, deck, width, reduced motion |
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
8. A gap in basalt-ui is filed there; the pull request names the Issue.

## Working with basalt-ui

Four rules apply to every row that touches the interface. They exist because v9 is the first consumer built on basalt-ui 3 from nothing, so what it finds should flow back.

- **A gap is fixed upstream.** A missing component, token or lint seam becomes a factory Issue in basalt-ui with a minimal reproduction from this repo. The row then waits for it (`after: [basalt-ui:<row>]`), or builds behind a named seam with the Issue's number in a comment, and a later row deletes the seam.
- **No local overrides.** basalt's lint, format and tsconfig presets are used as shipped. A waiver names its reason and the upstream Issue.
- **Its agent layer is used.** The rules, the skills and the design reviewer that basalt-ui ships are installed with it, and a row for the interface runs the reviewer before it asks for review. A rule that is wrong for a game surface is changed in basalt-ui.
- **Every interface row reports** what it filed upstream, in one line of its pull request.

What v9 needs from basalt-ui 3, from a reading of its `master` on 2026-11-20. These are worth taking before 3.0.0 ships:

| Area | In basalt-ui today | v9 needs |
|-|-|-|
| Motion | the tokens `dur-fast` (150 ms), `dur-base` (250 ms) and one easing. Its `AGENTS.md` names `MOTION_DURATION`, `MOTION_SPRING` and `MOTION_EASE_STANDARD`, which no source file defines. No motion guideline | those constants, a slow step, spring presets, a stagger helper, enter and exit presets, a reduced-motion policy, and the guideline. The table and the landing page both lean on them |
| Marketing blocks | prose, article layout, table of contents, callout and MDX parts, as React components. Nothing named hero, bento or FAQ | hero, bento grid, feature tile, question list, comparison table, call-to-action band, footer |
| Astro | no `./astro` export. The `tokens` profile has no lint preset. The marketing app's own guide describes the 1.x era | a documented `tokens` setup for Astro 7 with a lint preset, and article parts that render without client JavaScript |
| A bespoke surface | `primitive-bypass` denies positioned geometry outside its seam | a sanctioned seam for a game surface, so the table passes the lint without a waiver |
| Reporting upstream | no documented channel for what a consumer finds | one line in the shipped `AGENTS` block that says where a gap is filed |
| Icons | none shipped | a recommended set, so site and room agree |
