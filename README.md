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

![demo](https://raw.githubusercontent.com/jkrumm/planning-poker/master/public/recording.gif)

---

## Technical Overview

Based on Next.js, tRPC, Drizzle and Mantine UI components.

Uses a three-service architecture: Next.js app (port 3001), Bun WebSocket server (port 3003) for real-time features, and FastAPI analytics (port 5100). Self-hosted MariaDB using my [sideproject-docker-stack](https://github.com/jkrumm/sideproject-docker-stack).

## Quick Start

Free Planning Poker runs on three services. Start all at once with `npm run dev:all` or individually:

| Service | Runtime | Port | Command | Config |
|---------|---------|------|---------|--------|
| **Next.js App** | Node 22 | 3001 | `doppler run -- npm run dev` | Doppler |
| **WebSocket Server** | Bun | 3003 | `cd fpp-server && bun dev` | .env file |
| **Analytics API** | Python 3.12 (uv) | 5100 | `cd fpp-analytics && uv run uvicorn main:app --reload --port 5100` | .env file |

**For detailed architecture**, see `ARCHITECTURE.md` and `fpp-server/CLAUDE.md`, `fpp-analytics/CLAUDE.md`

**Note:** Run `cd fpp-analytics && uv run python update_readmodel.py` once before first start to generate Parquet files.

---

## Validation

The project uses comprehensive validation across all three services.

### Local Development

```bash
# Validate all services in parallel (fastest)
npm run validate

# Validate individual services
npm run validate:nextjs       # Next.js: format, lint, type-check, build
npm run validate:fpp-server   # fpp-server: format, lint, type-check, build
npm run validate:fpp-analytics # fpp-analytics: format, lint, type-check
```

### Service-Specific Commands

**Next.js:**
```bash
npm run format        # Auto-fix formatting
npm run lint:fix      # Auto-fix linting
npm run type-check    # TypeScript check
npm run build         # Next.js build
npm run pre           # All checks combined
```

**fpp-server:**
```bash
cd fpp-server
bun run format        # Auto-fix formatting
bun run lint:fix      # Auto-fix linting
bun run type-check    # TypeScript check
bun run build         # Bun build
bun run validate      # All checks combined
```

**fpp-analytics:**
```bash
npm run fpp-analytics:format       # Auto-fix formatting
npm run fpp-analytics:lint:fix     # Auto-fix linting
npm run fpp-analytics:type-check   # mypy check
npm run fpp-analytics:validate     # All checks combined

# Or directly:
cd fpp-analytics
uv run ruff format .       # Auto-fix formatting
uv run ruff check --fix .  # Auto-fix linting
uv run mypy .              # Type checking
```

### CI Validation

GitHub Actions validates all services in parallel on every PR:
- **Next.js**: 4 jobs (formatting, linting, type-checking, build)
- **fpp-server**: 4 jobs (formatting, linting, type-checking, build)
- **fpp-analytics**: 3 jobs (formatting, linting, type-checking)

**Total: 11 parallel jobs**

---

### Run locally

1. Install any Node 20 version (exact 20.11.1) and Docker and Docker Compose and Doppler CLI
2. Clone [sideproject-docker-stack](https://github.com/jkrumm/sideproject-docker-stack)
3. Request access to the Doppler Dev projects `sideproject-docker-stack` and `free-planning-poker`
4. Run `sideproject-docker-stack` by following the instructions in the README
5. Set up the `free-planning-poker` Doppler project by running `doppler setup`
6. Install dependencies with `npm ci`
7. Run `doppler run -- npm run dev`

### Database Migrations

The project uses Drizzle Kit for database migrations. Available commands:

- `npm run db:generate` - Generate migration files from schema changes
- `npm run db:migrate` - Apply pending migrations to database
- `npm run db:studio` - Open Drizzle Studio database GUI
- `npm run db:check` - Check if schema and database are in sync

**Important**: Before running any migration commands, verify that your `.env` file contains the correct `DATABASE_URL` - ensure it points to your local development database, not production!

**Migration workflow:**
1. Make changes to `src/server/db/schema.ts`
2. Run `npm run db:generate` to create migration files
3. Review the generated SQL in `drizzle/` folder
4. Switch the `.env` URL to use local database
5. Run `npm run db:migrate` to apply changes to local database
6. Validate locally if nothing breaks (functionality and data)
7. Switch the `.env` URL to use prod database
8. Run `npm run db:migrate` to apply changes to prod database

### Run fpp-server locally
1. [Install Bun](https://bun.sh/docs/installation) if not already installed
2. Create `.env` file in `fpp-server/` directory (see `fpp-server/.env.example`):
   ```bash
   TRPC_URL=http://localhost:3001/api/trpc
   FPP_SERVER_SECRET=dev-secret  # Or from Doppler: doppler secrets get FPP_SERVER_SECRET --plain
   SENTRY_DSN=  # Optional
   NODE_ENV=development
   ```
3. Run `cd fpp-server && bun dev`

### Run fpp-analytics locally
1. Install uv: `curl -LsSf https://astral.sh/uv/install.sh | sh`
2. Install dependencies: `cd fpp-analytics && uv sync`
3. Copy `.env.example` to `.env` and populate variables (see `fpp-analytics/.env.example`)
4. Generate Parquet files (first time only): `uv run python update_readmodel.py`
5. Run the API: `uv run uvicorn main:app --reload --port 5100`

### Releases

Releases are created via `npm run release` (release-it) or `/release-fpp` Claude Code command for AI-enhanced release notes.
