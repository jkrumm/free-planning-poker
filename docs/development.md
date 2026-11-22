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
| lefthook | 2.2.2 | root | pre-commit: oxfmt check and oxlint on staged files; commit-msg: commitlint |
| drizzle-orm, drizzle-kit | 0.45.4, 0.31.11 | `apps/api` | the 0.45 line of the ORM, not the 1.0 release candidate; drizzle-kit has its own 0.31 line. Driver `drizzle-orm/bun-sql` on Bun's built-in `SQL`: the repository tests passed 20 runs in a row on Bun 1.4.2, so no `postgres` package. `bun --env-file=.env.tpl run db:migrate` in `apps/api` (`scripts/migrate.ts`) applies the migrations to `DATABASE_URL` (local value in `apps/api/.env.tpl`); drizzle-kit's own `migrate` would need a second driver package |
| Astro | 7.4.13 | `apps/site` | with `@astrojs/mdx` 8.1.6 and `@astrojs/sitemap` 3.7.6, checked with `agw web package` on 2026-11-22; Vite 8, Node 22.23.4 or newer, run on Bun in CI |
| Elysia | 2.0.0-rc.3 | `apps/api` | by the owner's ruling; never installed by tag. Its peers `typebox` 1.4.7, `exact-mirror` 1.2.7 and `openapi-types` 12.1.3 are pinned beside it |

`bunfig.toml` sets the isolated linker (a package resolves only what it declares), exact pins for `bun add`, and a 3-day release-age cooldown. CI installs with `bun install --frozen-lockfile`.

## Check tiers

| Target | Steps |
|-|-|
| `make check-fast` | oxfmt `--check`, oxlint `--deny-warnings`, `tsc --noEmit`, `scripts/boundaries.ts`, `bun test` without `*.server.test.ts` and `*.site.test.ts`, `factory plan check` and `factory project check` (skipped where the CLI is absent, as in CI) |
| `make check` | `check-fast`, then `make test-server` (the `*.server.test.ts` files), then `make build` |

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

Agents never start these servers. The API opens a room socket only for an `Origin` listed in `ALLOWED_ORIGINS` (comma-separated); unset, it allows `https://fpp-next.test`, `http://localhost:7739` and its own port. Behind a proxy, `CLIENT_IP_HEADER` names the single-valued header the edge overwrites with the client's address (`cf-connecting-ip` behind Cloudflare, never `x-forwarded-for`), so the per-address limit on wrong access codes counts clients and not the proxy; unset, the socket's peer address counts.

## CI

`.github/workflows/ci.yml`, on pull requests and pushes to `master`, on `ubuntu-24.04`:

| Job | Does |
|-|-|
| `lanes` | `.github/lanes.sh` reads `.github/lanes` and the diff and outputs `app` and `site` as booleans; a change on the `every` line (`.github/`, `bun.lock`, `package.json`, `bunfig.toml`, `tsconfig.base.json`) selects every lane |
| `check` | installs the PostgreSQL 18 server binaries from PGDG (`.github/postgres.sh`, no cluster), `bun install --frozen-lockfile`, `make check` with `PG_BIN_DIR` set |
| `site` | lane `site`: `make site` builds `apps/site` for production and beta and tests the output (scripts, links, page budgets, the draft rule); apps/site/AGENTS.md |
| `ci` | `if: always()`; `.github/gate.sh` reads `toJSON(needs)` and fails when a needed job failed or was cancelled, or was skipped while `lanes` did not succeed. The only required check of `master` |

A row that adds a lane job (`image`, `e2e`, `site`) gives it `if: needs.lanes.outputs.<lane> == 'true'` and adds it to the `needs` of `ci`; `gate.sh` needs no change.

**No dependency cache.** `bun install --frozen-lockfile` of this workspace (320 packages) was timed on `ubuntu-24.04` on 2026-11-21, in two runs of a job with two arms: one with `~/.bun/install/cache` removed, one with it restored by `actions/cache` v6.1.0.

| Run | Without a cache | With a restored cache |
|-|-|-|
| 1 (the cache was still empty) | 0.69 s | 0.72 s (a miss) |
| 2 | 2.59 s | 3.08 s, plus 1 s for the restore step |

A restored cache did not beat a cold install, so CI keeps none beyond the Bun binary that `setup-bun` caches. Measure again when the install passes 15 s.
