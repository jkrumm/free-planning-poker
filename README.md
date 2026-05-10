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

Bun-managed monorepo. Next.js + tRPC + Drizzle + Mantine on the web side, Elysia + TypeBox on the WebSocket server, FastAPI + Polars for analytics. Self-hosted MariaDB using my [sideproject-docker-stack](https://github.com/jkrumm/sideproject-docker-stack).

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

| Service          | Runtime          | Port | Workspace     | Entry           |
| ---------------- | ---------------- | ---- | ------------- | --------------- |
| Next.js App      | Node 24          | 3001 | `@fpp/web`    | `apps/web`      |
| WebSocket Server | Bun              | 3003 | `@fpp/server` | `apps/server`   |
| Analytics API    | Python 3.14 (uv) | 5100 | n/a           | `fpp-analytics` |

**For detailed architecture**, see `ARCHITECTURE.md`, `apps/server/CLAUDE.md`, and `fpp-analytics/CLAUDE.md`.

---

## Quick Start

```bash
bun install                        # workspace root — populates all packages

# Start everything (Next.js + server + analytics + Logdy UI)
bun run dev:all

# Or individually
bun run dev                        # Next.js only (port 3001)
bun run --filter=@fpp/server dev   # WebSocket server only (port 3003)
cd fpp-analytics && uv run uvicorn main:app --reload --port 5100   # Analytics only
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

1. Install Node 24 (`nvm install`), Bun (`curl -fsSL https://bun.sh/install | bash`), Docker + Compose, Doppler CLI, and uv (`curl -LsSf https://astral.sh/uv/install.sh | sh`).
2. Clone [sideproject-docker-stack](https://github.com/jkrumm/sideproject-docker-stack) and bring it up — it provides the MariaDB this project talks to.
3. Request access to the Doppler projects `sideproject-docker-stack` and `free-planning-poker`.
4. `doppler setup` in this repo root.
5. `bun install`
6. `bun run dev` (or `bun run dev:all` for the full stack with Logdy log UI on http://localhost:8080)

### WebSocket server (standalone)

```bash
bun run --filter=@fpp/server dev   # port 3003
```

Env vars (root Doppler project covers these; for standalone runs, create `apps/server/.env`):

```bash
TRPC_URL=http://localhost:3001/api/trpc   # callback for vote persistence
FPP_SERVER_SECRET=dev-secret              # shared with Next.js
SENTRY_DSN=                               # optional
NODE_ENV=development
```

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
