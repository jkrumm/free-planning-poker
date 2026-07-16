# FPP Server (Bun + Elysia WS) — local dev env.
# Resolved at runtime: `secrets-run run --env-file=.env.tpl -- <cmd>`.
# Production env is injected by docker-compose on the VPS (see vps/apps/fpp).
#
# This template holds no op:// references — local dev needs no 1Password access
# and runs on any machine, headless mini included.

# --- Hardcoded local config ---
NODE_ENV=development
LOG_LEVEL=debug
PORT=7721
TRPC_URL=http://localhost:7720/api/trpc
REDIS_URL=redis://localhost:6379

# --- OpenTelemetry → ClickStack (no auth on :4319, docker bridge in prod) ---
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4319
OTEL_SERVICE_NAME=fpp-server

# --- Shared with fpp-web (must match apps/web/.env.tpl) ---
# Local-only value, not a secret: it only needs the local web and server to
# agree with each other, never to match prod. See apps/web/.env.tpl for why
# this is a literal rather than an op:// ref.
FPP_SERVER_SECRET=local-dev-server-secret
