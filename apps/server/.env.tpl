# FPP Server (Bun + Elysia WS) — local dev env via 1Password.
# Resolved at runtime: `op run --account tkrumm --env-file=.env.tpl -- <cmd>`.
# Production env is injected by docker-compose on the VPS (see vps/apps/fpp).

# --- Hardcoded local config ---
NODE_ENV=development
LOG_LEVEL=debug
PORT=7721
TRPC_URL=http://localhost:7720/api/trpc
REDIS_URL=redis://localhost:6379

# --- OpenTelemetry → ClickStack (no auth on :4319, docker bridge in prod) ---
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4319
OTEL_SERVICE_NAME=fpp-server

# --- Shared with fpp-web (must match — same source of truth) ---
FPP_SERVER_SECRET=op://vps/fpp/SERVER_SECRET
