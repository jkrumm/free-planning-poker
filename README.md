# [Free-Planning-Poker.com](https://free-planning-poker.com/)

Straightforward planning poker. Create a room, share the link, vote instantly. No fuzz.

## Why Free Planning Poker?

- **Free forever** - No limits, no premium tiers, no hidden costs
- **No sign-up required** - Create a room and start voting immediately
- **Privacy-first** - No tracking cookies, no IP addresses stored, all data stays in your browser's localStorage
- **GDPR compliant** - Privacy by design, hosted on a private German VPS
- **Unlimited** - No cap on participants, rooms, or votes
- **Mobile-friendly** - Works on any device
- **Battle-tested** - Stable in production with hundreds of daily users
- **Open source** - Inspect the code yourself

**[Start Planning](https://free-planning-poker.com/?source=github)**

![demo](https://raw.githubusercontent.com/jkrumm/planning-poker/master/apps/web/public/recording.gif)

---

## Technical Overview

Bun-managed monorepo. Next.js + tRPC + Drizzle + Mantine on the web side, Elysia + TypeBox on the WebSocket server, FastAPI + Polars for analytics. Self-hosted MariaDB on my [vps](https://github.com/jkrumm/vps) stack.

### Monorepo Layout

```
free-planning-poker/
├── apps/
│   ├── web/         # Next.js 16 (Pages Router) — deployed to Vercel        → @fpp/web
│   └── server/      # Bun + Elysia WebSocket server — deployed to VPS       → @fpp/server
├── packages/
│   ├── db/          # Drizzle schema + migrations (MySQL)                   → @fpp/db
│   └── shared/      # WebSocket action schemas, room DTOs, validators       → @fpp/shared
├── fpp-analytics/   # Python 3.14 FastAPI service (Polars + Parquet) — VPS
├── package.json     # Bun workspace root
└── bun.lock
```

Workspace packages resolve via Bun symlinks; `@fpp/db` and `@fpp/shared` are imported directly by both web and server. `@fpp/db` exposes schema + types from the default entry and the drizzle/mysql2 client wrapper from a `@fpp/db/client` subpath, so client code never bundles `mysql2`.

Tooling is centralised: `tsconfig.base.json` + `prettier.config.cjs` + `.prettierignore` at repo root; each workspace `extends` (tsconfig) or inherits via discovery (prettier). All four workspaces have `format / lint / type-check / validate` scripts; CI and lefthook run them in parallel.

### Services

| Service          | Runtime          | Local port | `.test` host        | Workspace     | Entry           |
| ---------------- | ---------------- | ---------- | ------------------- | ------------- | --------------- |
| Next.js App      | Node 24          | 7720       | `fpp.test`          | `@fpp/web`    | `apps/web`      |
| WebSocket Server | Bun              | 7721       | `fpp-server.test`   | `@fpp/server` | `apps/server`   |
| Analytics API    | Python 3.14 (uv) | 7722       | `fpp-analytics.test`| n/a           | `fpp-analytics` |
| Logdy (logs UI)  | Go               | 7723       | `fpp-logdy.test`    | n/a           | -               |

Container ports stay 3003 (server) and 5100 (analytics); the local `PORT` env override lives in each service's `.env.tpl`.

**For detailed architecture**, see `ARCHITECTURE.md`, `apps/server/CLAUDE.md`, and `fpp-analytics/CLAUDE.md`.

---

## Quick Start

```bash
bun install                        # workspace root — populates all packages

# Start everything (Next.js + server + analytics + Logdy UI)
bun run dev:all

# Or individually
bun run dev                        # Next.js only (port 7720)
bun run --filter=@fpp/server dev   # WebSocket server only (port 7721)
cd fpp-analytics && secrets-run run --env-file=.env.tpl -- uv run uvicorn main:app --reload --port 7722
```

**First-time analytics setup:** `cd fpp-analytics && uv run python update_readmodel.py` once to generate the Parquet files.

---

## Validation

```bash
# All workspaces in parallel (fastest)
bun run validate

# Per-workspace
bun run validate:web         # @fpp/web: format, lint, type-check, build
bun run validate:server      # @fpp/server: format, lint, type-check, build
bun run validate:db          # @fpp/db: format, lint, type-check
bun run validate:shared      # @fpp/shared: format, lint, type-check
bun run validate:analytics   # fpp-analytics: format, lint, type-check
```

### Service-specific commands

**Next.js (`apps/web`):**

```bash
bun run --filter=@fpp/web format
bun run --filter=@fpp/web lint:fix
bun run --filter=@fpp/web type-check
bun run --filter=@fpp/web build
bun run --filter=@fpp/web pre      # all combined
```

**WebSocket server (`apps/server`):**

```bash
bun run --filter=@fpp/server format
bun run --filter=@fpp/server lint:fix
bun run --filter=@fpp/server type-check
bun run --filter=@fpp/server build
bun run --filter=@fpp/server validate   # all combined
```

**Analytics (`fpp-analytics`):**

```bash
bun run fpp-analytics:format       # ruff format
bun run fpp-analytics:lint:fix     # ruff check --fix
bun run fpp-analytics:type-check   # mypy
bun run fpp-analytics:validate     # all combined
```

### CI

GitHub Actions runs 17 jobs in parallel on every PR:

- Next.js: format, lint, type-check, build
- WebSocket server: format, lint, type-check, build
- DB package: format, lint, type-check
- Shared package: format, lint, type-check
- Analytics: format, lint, type-check

---

## Run Locally

1. Install Node 24 (`nvm install`), Bun (`curl -fsSL https://bun.sh/install | bash`), Docker + Compose, [1Password CLI](https://developer.1password.com/docs/cli/get-started/) (`brew install 1password-cli`), and uv (`curl -LsSf https://astral.sh/uv/install.sh | sh`).
2. Clone [vps](https://github.com/jkrumm/vps) and bring up the FPP stack — it provides the MariaDB this project talks to.
3. Sign in to 1Password with the personal `tkrumm` account; secrets are resolved at runtime from `op://vps/fpp/*` and `op://vps/mariadb/FPP_PASSWORD` via per-service `.env.tpl` files.
4. `bun install`
5. `bun run dev` (or `bun run dev:all` for the full stack with Logdy log UI on http://localhost:7723)

Each service has its own `.env.tpl` (`apps/web/.env.tpl`, `apps/server/.env.tpl`, `fpp-analytics/.env.tpl`). The `dev` scripts wrap `op run --account tkrumm --env-file=.env.tpl -- ...` so 1Password references resolve to live values without ever writing them to disk.

### WebSocket server (standalone)

```bash
bun run --filter=@fpp/server dev   # port 7721
```

Env vars are populated by `op run` from `apps/server/.env.tpl`. The only secret that resolves from 1Password is `FPP_SERVER_SECRET` (must match the Next.js side for flip-tracking callbacks); the rest are hardcoded local defaults.

### Analytics service (standalone)

```bash
cd fpp-analytics
uv sync
cp .env.example .env                       # populate from 1Password / Doppler
uv run python update_readmodel.py          # first-time only — builds Parquet
uv run uvicorn main:app --reload --port 5100
```

---

## Database Migrations

Drizzle Kit, scoped to the `@fpp/db` package:

```bash
bun run db:generate   # generate migrations from schema changes
bun run db:migrate    # apply pending migrations
bun run db:studio     # open Drizzle Studio
bun run db:check      # verify schema/db are in sync
```

**Migration workflow:**

1. Edit `packages/db/src/schema.ts`
2. `bun run db:generate` — SQL lands in `packages/db/drizzle/`
3. Review the generated SQL
4. Point `DATABASE_URL` at your local DB and `bun run db:migrate`
5. Validate locally
6. Switch `DATABASE_URL` to prod and `bun run db:migrate` again

⚠️ Verify `DATABASE_URL` before every migrate.

---

## Releases

```bash
bun run release              # release-it locally
gh workflow run release.yml  # release-it via CI (canonical)
```

For AI-generated release notes use `/release-fpp` (see `.claude/skills/release-fpp/SKILL.md`).
