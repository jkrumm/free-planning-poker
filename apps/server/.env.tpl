# FPP Server (Bun + Elysia WS) — local dev env via 1Password.
# Resolved at runtime: `op run --account tkrumm --env-file=.env.tpl -- <cmd>`.
# Production env is injected by docker-compose on the VPS (see vps/apps/fpp).
#
# Only FPP_SERVER_SECRET needs to resolve from 1Password — it must match the
# value the web app sends for flip-tracking callbacks. Pulling both sides
# from op://vps/fpp/SERVER_SECRET keeps them in lockstep with zero drift.

# --- Hardcoded local config ---
NODE_ENV=development
LOG_LEVEL=debug
PORT=7721
TRPC_URL=http://localhost:7720/api/trpc
REDIS_URL=redis://localhost:6379

# --- Disabled-in-local dummy (Sentry no-ops in dev anyway) ---
SENTRY_DSN=https://dev-disabled@local.invalid/0

# --- Shared with fpp-web (must match — same source of truth) ---
FPP_SERVER_SECRET=op://vps/fpp/SERVER_SECRET
