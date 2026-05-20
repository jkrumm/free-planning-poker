# FPP Web (Next.js) — local dev env via 1Password.
# Resolved at runtime: `op run --account tkrumm --env-file=.env.tpl -- <cmd>`.
# Production secrets live in Vercel — not here.

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

# --- What actually needs to work locally ---
# DATABASE_URL is composed in the `dev` script from MARIADB_FPP_PASSWORD —
# `op run` resolves `op://` refs but doesn't interpolate ${VAR} within values,
# so the URL assembly happens one layer up. Keeps the FPP MariaDB password
# as a single source of truth in op://vps/mariadb/FPP_PASSWORD; if you rotate
# it on the VPS, local dev picks it up automatically with no fpp-side edit.
MARIADB_FPP_PASSWORD=op://vps/mariadb/FPP_PASSWORD

# Shared with fpp-server (web ↔ server auth for flip callback)
FPP_SERVER_SECRET=op://vps/fpp/SERVER_SECRET

# Shared with fpp-analytics (only needed if you hit analytics admin pages)
ANALYTICS_SECRET_TOKEN=op://vps/fpp/ANALYTICS_SECRET_TOKEN
