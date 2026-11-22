# Development

How the v9 workspace is built and checked. The rules every change follows are in `AGENTS.md` and, by concern, in `.claude/rules/`; the reasons behind them in `docs/v9/ENGINEERING.md`.

## Toolchain

Every version is pinned exactly and was checked with `agw web package` on 2026-11-21.

| Tool | Version | Where it is pinned | Note |
|-|-|-|-|
| Bun | 1.4.4 | `packageManager` in `package.json` | CI's `setup-bun` and the factory's step image read it. `make check-fast` warns when the local Bun differs. 1.4.5 was two days old and inside the cooldown |
| TypeScript | 7.0.2 | root `package.json` | the newest stable major, the native compiler. `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` in `tsconfig.base.json` |
| oxlint | 1.94.0 | root | `.oxlintrc.json`: correctness and suspicious as errors, no `any`, type-only imports, no default export, the import restrictions below |
| oxfmt | 0.79.0 | root | `.oxfmtrc.json` copies basalt-ui's settings, so the switch to its presets in `v9-ui-foundation` reformats nothing. Markdown is left out: oxfmt pads tables, and the docs keep the minimal `|-|-|` separator |
| @effect/tsgo, oxlint-tsgolint | 0.70.0, 7.0.2007 | root | Effect's type-aware lint rules, run by `effect-tsgo oxlint` with `.oxlintrc.effect.json` over `apps/api/src/app`, `src/db` and `src/jobs`. Stock oxlint cannot load them. They move with oxlint as a set: the `@effect/tsgo` README lists the TypeScript, oxlint and oxlint-tsgolint versions each release supports (0.70.0: TypeScript 7.0.2, oxlint 1.91 to 1.94, oxlint-tsgolint 7.0.2005 to 7.0.2007). 0.73.2 was inside the cooldown on 2026-11-22 |
| lefthook | 2.2.2 | root | pre-commit: oxfmt check and oxlint on staged files; commit-msg: commitlint |
| drizzle-orm, drizzle-kit | 0.45.4, 0.31.11 | `apps/api` | the 0.45 line of the ORM, not the 1.0 release candidate; drizzle-kit has its own 0.31 line. Driver `drizzle-orm/bun-sql` on Bun's built-in `SQL`: the repository tests passed 20 runs in a row on Bun 1.4.2, so no `postgres` package. `bun --env-file=.env.tpl run db:migrate` in `apps/api` (`scripts/migrate.ts`) applies the migrations to `DATABASE_URL` (local value in `apps/api/.env.tpl`); drizzle-kit's own `migrate` would need a second driver package |
| Astro | 7.4.13 | `apps/site` | with `@astrojs/mdx` 8.1.6 and `@astrojs/sitemap` 3.7.6, checked with `agw web package` on 2026-11-22; Vite 8, Node 22.23.4 or newer, run on Bun in CI |
| Vite, React, TanStack Router | 8.3.8, 19.3.1, 1.170.46 | `apps/room` | checked with `agw web package` on 2026-11-22. `@vitejs/plugin-react` 6.3.0 with `@rolldown/plugin-babel` 0.3.1 and `babel-plugin-react-compiler` 1.0.0 runs the React Compiler; `@tanstack/router-plugin` 1.169.0 writes the committed `routeTree.gen.ts`. Peers the isolated linker needs are declared beside them (`@babel/*`, `rolldown`). Versions inside the 3-day cooldown were stepped back (`@babel/runtime` 7.29.14) |
| Lingui | 6.12.0 | `packages/i18n`, `apps/room` | `@lingui/core`, `react`, `cli`, `vite-plugin` (native macro transform: no Babel step for macros). Its Bun twin for tests is `apps/room/test/lingui-bun.ts` |
| happy-dom | 21.0.4 | `apps/room` | the DOM of the component tests, through `@happy-dom/global-registrator` |
| Effect | 4.1.4 | `apps/api` | checked with `agw web package` on 2026-11-22; 4.1.5 was two days old and inside the cooldown. Only in `apps/api/src/app`, `src/db`, `src/jobs`; nothing from `effect/unstable`. Drizzle 0.45 has no Effect integration, so the adapters wrap each repository call in `Effect.tryPromise` (`src/db/resilience.ts`) |
| Elysia | 2.0.0-rc.3 | `apps/api` | by the owner's ruling; never installed by tag. Its peers `typebox` 1.4.7, `exact-mirror` 1.2.7 and `openapi-types` 12.1.3 are pinned beside it |

`bunfig.toml` sets the isolated linker (a package resolves only what it declares), exact pins for `bun add`, and a 3-day release-age cooldown. CI installs with `bun install --frozen-lockfile`.

The API needs `DATABASE_URL` and `VISITOR_KEY` (the device hash's key, 32 characters or more) and refuses to start without them. `bun run dev` in `apps/api` loads both from `apps/api/.env.tpl` (local values, no secret) and expects a database migrated with `db:migrate`.

## Check tiers

| Target | Steps |
|-|-|
| `make check-fast` | oxfmt `--check`, oxlint `--deny-warnings`, the message check (`packages/i18n/scripts/messages.ts`), `effect-tsgo oxlint --type-aware` over the Effect folders, `tsc --noEmit`, `scripts/boundaries.ts`, `bun test` without `*.server.test.ts` and `*.site.test.ts`, `factory plan check` and `factory project check` (skipped where the CLI is absent, as in CI) |
| `make check` | `check-fast`, then `make test-server` (the `*.server.test.ts` files), then `make build` (the room app into `apps/room/dist`, its entry-size budget of 130 kB gzip, the API bundle) |

Each step prints `==> <step>`; a failure prints `==> FAILED: <step>` and stops the target. Measured on the mini on 2026-11-21: `make check-fast` 2.9 s wall clock. A test step writes JUnit to `$FACTORY_JUNIT_DIR/<step>.xml` only when that variable is set.

`make check` runs the server tier through `factory slot run` where the factory CLI exists; `project.yaml` declares it as the step `test-server` with `remote: true`, so the factory may run it on its Linux step host (PostgreSQL 16 there, 18 in CI).

## Tests

- **A port** comes from `freePort()` (`@fpp/test-kit/port`): the OS hands one out on 127.0.0.1.
- **A database** comes from `startPostgres()` (`@fpp/test-kit/postgres`): `initdb` into a new temporary directory, `pg_ctl start` on a free port, TCP on 127.0.0.1 only, no Unix socket, durability off. `stop()` stops the cluster and deletes the directory. Binaries come from `PG_BIN_DIR`, else from the directory of the `initdb` on PATH. Startup retries on a port another process took meanwhile. Twenty parallel runs of its test pass on the mini.
- A file that starts Postgres is named `*.server.test.ts`. `@fpp/test-kit` may be imported by test files only.

## Boundaries

`scripts/boundaries.ts` reads `boundaries.toml`, the repo map as data, and checks every source file under `apps/`, `packages/` and `e2e/`:

- an import of `@fpp/<x>` only where the table draws the arrow, type-only where it says `types`, and only through `<x>`'s `exports` map; no relative path into another module; no module directory the table does not list
- a pure file: no `node:*`, `bun` or `bun:*` import, relative imports only to pure files, and no `fetch`, `WebSocket`, timers, `Date.now`, `new Date()`, `performance.now`, `Math.random`, crypto randomness, `process` or `Bun`
- an adapter: no `process.env`, `Bun.env` or `import.meta.env`
- `elysia` and `@elysia/*` only in `apps/api/src/http` and `src/ws`; `effect` and `@effect/*` only in `apps/api/src/app`, `src/db` and `src/jobs`; `effect/unstable` nowhere

Test files are exempt from the class rules, not from the arrows. `scripts/boundaries.test.ts` plants one violation of each kind. oxlint repeats the Elysia and Effect restrictions so an editor shows them as you type.

## Ports

| Port | What |
|-|-|
| 7738 | the Astro site (from stage 3) |
| 7739 | the room app (Vite) |
| 7740 | the API; `bun run dev` starts it with `--watch` |

The API serves the built room app from `apps/room/dist` (`ROOM_APP_DIR` names another directory, as the image will) under `/room`, `/room/*` and `/_room/*`: the shell is never cached, a hashed file is cached as immutable. Without a build `/room` answers 404 and `src/main.ts` says so on start.

Agents never start these servers. The API opens a room socket only for an `Origin` listed in `ALLOWED_ORIGINS` (comma-separated); unset, it allows `https://fpp-next.test`, `http://localhost:7739` and its own port. Behind a proxy, `CLIENT_IP_HEADER` names the single-valued header the edge overwrites with the client's address (`cf-connecting-ip` behind Cloudflare, never `x-forwarded-for`), so the per-address limit on wrong access codes counts clients and not the proxy; unset, the socket's peer address counts. `POST /api/contact` and `POST /api/feedback` need the same `Origin` list and send through `EMAIL_GATEWAY_URL` with `EMAIL_GATEWAY_SECRET_KEY`, and `FACTORY_FEEDBACK_URL` with `FACTORY_FEEDBACK_TOKEN`; a route whose two variables are not both set answers 503, so a local API sends nothing unless you set them (`apps/api/.env.tpl`).

## Image

`apps/api/Dockerfile` builds the one image of the API and the room app it serves (docs/v9/ARCHITECTURE.md, Topology); `deploy/compose.yml` runs it with PostgreSQL 18. The build context is the repository root, trimmed by `.dockerignore`.

**Self-hosting** is that same file, published (row `v9-selfhost`). Decisions:

- **One compose file, one override.** `deploy/compose.yml` is what a self-hoster downloads: the published image, no `build:`, no default for `POSTGRES_PASSWORD` and `VISITOR_KEY` (`${VAR:?message}` stops `docker compose` with a message that names the variable). `deploy/compose.build.yml` adds the `build:` of this checkout; the Makefile layers it (`V9_COMPOSE`) and exports local values for the two secrets, so `make v9-up` needs no setup. The end-to-end suite starts the strict file with secrets it generates per run (`e2e/suite/run.ts`), so it tests the file users run. `ALLOWED_ORIGINS` defaults to `localhost` and `127.0.0.1` on the published port, right for the machine itself; a deployment behind a domain sets it.
- **`deploy/.env.example`** lists every setting the compose file passes on, with its default and what unset means. No secret value is in the repository: the two secret lines are empty and the page's commands fill them.
- **The public image** is `ghcr.io/jkrumm/free-planning-poker`, published by `.github/workflows/publish-image.yml`: on every push to `master` as `sha-<7 characters>` and `latest`, and on a release (`release.yml` calls it with the tag it made) also as `<version>` and `<major>.<minor>`. `latest` is the newest master build, not the newest release, because no release of 9 exists yet and the default tag must pull today. It does not wait for `ci`: a push to master is a merged pull request whose `ci` was green. amd64 only. The package must be public; the image's `org.opencontainers.image.source` label links it to this repository, and `selfhost.yml` pulls it with no login, so a private package fails that step.
- **`/self-hosting`** (`apps/site/src/pages/self-hosting.astro`) holds the commands in `<pre data-commands="start|update|backup|restore">` blocks. `apps/site/scripts/page-commands.ts <block>` prints one from the page's source.
- **`.github/workflows/selfhost.yml`** (pull requests that touch `deploy/`, the page or the workflow; nightly at 04:41 UTC; dispatch) runs those blocks as written on a clean `ubuntu-24.04` runner, waits for `/api/health`, runs the `@smoke` tests of the suite against `http://localhost:7740`, then backup and restore, and on a run that is not a pull request the update. It also checks that a start with only the example file stops and names `POSTGRES_PASSWORD`, then `VISITOR_KEY`. On a pull request the raw-file address is swapped for the checkout and the image is built from it under the published name; any other run pulls the published tag anonymously. It is a signal: it is not in the `needs` of `ci`.

| Target | Does |
|-|-|
| `make v9-image` | builds `fpp-api:local` |
| `make v9-up` | builds if needed, starts the stack, waits until both containers are healthy. `FPP_PORT` (default 7740) is the host port on loopback, `FPP_BIND=0.0.0.0` publishes it; `V9_UP_FLAGS=--no-build` starts a loaded image, `V9_PROJECT` names the Compose project |
| `make v9-smoke` | `/api/health` answers 200 and `/room/x` returns the shell |
| `make v9-size` | the image's size, uncompressed and as a gzipped `docker save` |
| `make v9-down` | removes the stack **and its database volume** |
| `make v9-logs` | the last 200 lines of every container |
| `make v9-replace-api` | what a deploy does to the API: `stop` (SIGTERM and the drain), `rm`, then a new container on the same database, waited until healthy |

A lead starts the stack inside a slot, on a port from the OS and a project name of its own: `factory slot run -- make v9-up V9_PROJECT=<name> FPP_PORT=<port>`; the factory's Docker hook refuses a bare `v9-up` from a worktree.

- **Stages.** `oven/bun:<packageManager version>-alpine` builds: `bun install --frozen-lockfile` for the room app and the API only (every workspace manifest is copied first, because Bun checks the whole graph against `bun.lock`: a new workspace member needs its `COPY` line, and the image job says so when it is missing), the Vite build, and `bun build` of the API into one file, never minified (span names come from function names). The runtime stage holds only `main.js`, `drizzle/` and the built room app, owned by root, and runs as the base image's `bun` user.
- **Moving Bun.** `BUN_VERSION` in the Dockerfile is the `packageManager` version; change both together.
- **Environment.** `DATABASE_URL` is built from `POSTGRES_PASSWORD`, and `VISITOR_KEY` and `POSTGRES_PASSWORD` have no default in the compose file; the Makefile exports local values for them (`make v9-up`), a deployment's `.env` sets them and `ALLOWED_ORIGINS`. `OTEL_SERVICE_VERSION` is a build argument (the commit; `local` without one) and reaches the API as `GIT_SHA`.
- **Migrations** run on start where `MIGRATE_ON_START=true` (the image sets it; development and tests leave it off, so a process still starts without a database) (`migrateOnStart` in `src/db/client.ts`, called by `src/main.ts`): a session advisory lock on a connection of its own makes two starting containers apply them one after the other. `MIGRATIONS_DIR` names the folder (`/app/drizzle` in the image). A failed migration, or a database that is not there, stops the process: the container never serves on an old schema, and the restart policy (or the orchestrator's health wait) tries again.
- **Health and stop.** The health check is `/api/health` (503 while draining, so a stopping container is unhealthy). SIGTERM reaches Bun as PID 1; the drain exits 0 well inside the compose `stop_grace_period` of 30 s.

## End-to-end suite

`e2e/suite` drives one browser context per seat against the image of the previous section (`e2e/AGENTS.md` has the rules of writing a test). `make e2e` builds the image as `fpp-api:e2e-<pid>`, starts a stack of its own on a port the system picks, runs Playwright in the bundled headless shell and removes the stack and the image, in a factory slot where there is one; `E2E_ARGS` goes to Playwright. `make e2e-beta E2E_BASE_URL=<origin>` runs the tests tagged `@smoke` against a running host and refuses the production host. Every test makes its own room; `restart.e2e.ts` starts a stack of its own, because it replaces the API container.

## CI

`.github/workflows/ci.yml`, on pull requests and pushes to `master`, on `ubuntu-24.04`:

| Job | Does |
|-|-|
| `lanes` | `.github/lanes.sh` reads `.github/lanes` and the diff and outputs `app` and `site` as booleans; a change on the `every` line (`.github/`, `bun.lock`, `package.json`, `bunfig.toml`, `tsconfig.base.json`) selects every lane |
| `check` | installs the PostgreSQL 18 server binaries from PGDG (`.github/postgres.sh`, no cluster), `bun install --frozen-lockfile`, `make check` with `PG_BIN_DIR` set |
| `image` | lane `app`: builds `apps/api/Dockerfile` with BuildKit's GitHub cache backend (scope `fpp-api`), prints the image size to the job summary, starts `deploy/compose.yml` from the built image, runs `make v9-smoke`, removes the stack, and hands the image on as the artifact `fpp-api-image` (a tar, one day). No registry push: `publish-image.yml` publishes, and nothing rolls out from here (`v9-next-deploy`) |
| `e2e`, `e2e-report` | lane `app`, after `image`: two shards, each loads the image artifact as `fpp-api:local`, starts its own stack (`bun e2e/suite/run.ts --shard=n/2`, Playwright on the runner because one test replaces the API container) and uploads a blob report; `e2e-report` merges them into the HTML report `e2e-report` and annotates the failures. One retry records a trace and `failOnFlakyTests` keeps the test red; both are in the needs of `ci` |
| `site` | lane `site`: `make site` builds `apps/site` for production and beta and tests the output (scripts, links, page budgets, the draft rule); apps/site/AGENTS.md |
| `ci` | `if: always()`; `.github/gate.sh` reads `toJSON(needs)` and fails when a needed job failed or was cancelled, or was skipped while `lanes` did not succeed. The only required check of `master` |

A row that adds a lane job (`image`, `e2e`, `site`) gives it `if: needs.lanes.outputs.<lane> == 'true'` and adds it to the `needs` of `ci`; `gate.sh` needs no change.

**No dependency cache.** `bun install --frozen-lockfile` of this workspace (320 packages) was timed on `ubuntu-24.04` on 2026-11-21, in two runs of a job with two arms: one with `~/.bun/install/cache` removed, one with it restored by `actions/cache` v6.1.0.

| Run | Without a cache | With a restored cache |
|-|-|-|
| 1 (the cache was still empty) | 0.69 s | 0.72 s (a miss) |
| 2 | 2.59 s | 3.08 s, plus 1 s for the restore step |

A restored cache did not beat a cold install, so CI keeps none beyond the Bun binary that `setup-bun` caches. Measure again when the install passes 15 s.
