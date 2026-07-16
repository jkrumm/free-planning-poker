# FPP Web (Next.js) — local dev env.
# Resolved at runtime: `secrets-run run --env-file=.env.tpl -- <cmd>`.
# Production secrets live in Vercel — not here.
#
# This template holds no op:// references: local dev needs no 1Password access
# and runs on any machine, headless mini included. Only `make db-sync-from-prod`
# still needs 1Password (it reaches the real production database).

# --- Hardcoded local config (matches Caddy hostnames) ---
NEXT_PUBLIC_NODE_ENV=development
NEXT_PUBLIC_API_ROOT=https://fpp.test/
NEXT_PUBLIC_FPP_SERVER_URL=fpp-server.test
ANALYTICS_URL=http://localhost:7722
VERCEL_GIT_COMMIT_SHA=local-dev

# --- OpenTelemetry / HyperDX ---
# Local: unauthed receiver on the ClickStack monitoring-net bridge.
# Browser SDK ingests the API key into the bundle at build time —
# treat it like a Sentry DSN (public-by-design).
NEXT_PUBLIC_HYPERDX_API_KEY=local-dev-noop
# Browser SDK ingest origin. Locally it points at the Next.js dev server,
# which rewrites /v1/traces and /v1/logs to the unauthed :4319 receiver
# (see next.config.js rewrites). Prod (Vercel): https://otel.jkrumm.com.
NEXT_PUBLIC_HYPERDX_URL=https://fpp.test
# Server-side OTLP ingest (Next.js instrumentation.ts). Same unauthed
# receiver — runs on the host so it can hit localhost:4319 directly,
# no proxy needed. Prod: clickstack:4319 via Docker monitoring-net.
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4319

# --- Disabled-in-local dummies (satisfy zod, no real connection) ---
TODOIST_SECRET=local-dev-noop
BEA_BASE_URL=https://dev-disabled.local
BEA_SECRET_KEY=local-dev-noop

# --- What actually needs to work locally (local-only values, NOT secrets) ---
# These were once op://vps/* refs so they'd match prod. Nothing local needs
# them to: the database is a localhost container (:13306) and the two shared
# secrets only need the local services to agree with each other. Sourcing them
# from prod made fpp undevelopable on the headless Mac mini, where the only way
# to resolve an op:// ref is to cache it — and prod refs must never enter that
# cache (see dotfiles-private/headless.refs). Local literals cost nothing here
# and let fpp run on any machine with no 1Password access at all.
#
# DATABASE_URL is composed in the `dev` script from MARIADB_FPP_PASSWORD
# because env-file resolution doesn't interpolate ${VAR} within values, so the
# URL assembly happens one layer up.
#
# Must match LOCAL_FPP_DB_PASSWORD in the root Makefile — `make db-setup-local`
# grants exactly this password to the local `fpp` user.
MARIADB_FPP_PASSWORD=fpp-local-dev

# Shared with fpp-server (web ↔ server auth for flip callback).
# Must match FPP_SERVER_SECRET in apps/server/.env.tpl.
FPP_SERVER_SECRET=local-dev-server-secret

# Shared with fpp-analytics (only needed if you hit analytics admin pages).
# Must match ANALYTICS_SECRET_TOKEN in fpp-analytics/.env.tpl.
ANALYTICS_SECRET_TOKEN=local-dev-analytics-token
