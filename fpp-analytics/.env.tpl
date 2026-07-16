# FPP Analytics (FastAPI) — local dev env.
# Resolved at runtime: `secrets-run run --env-file=.env.tpl -- <cmd>`.
# Production env is injected by docker-compose on the VPS (see vps/apps/fpp).
#
# This template holds no op:// references — local dev needs no 1Password access
# and runs on any machine, headless mini included.
#
# Only ANALYTICS_SECRET_TOKEN actually matters for the local dev loop —
# it must match what the Next.js side sends so the API accepts requests.

DATA_DIR=./data

# Shared with fpp-web (must match apps/web/.env.tpl).
# Local-only value, not a secret: it only needs the local services to agree
# with each other, never to match prod.
ANALYTICS_SECRET_TOKEN=local-dev-analytics-token
