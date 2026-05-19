# FPP Analytics (FastAPI) — local dev env via 1Password.
# Resolved at runtime: `op run --account tkrumm --env-file=.env.tpl -- <cmd>`.
# Production env is injected by docker-compose on the VPS (see vps/apps/fpp).
#
# Only ANALYTICS_SECRET_TOKEN actually matters for the local dev loop —
# it must match what the Next.js side sends so the API accepts requests.
# Pulling both from op://vps/fpp/ANALYTICS_SECRET_TOKEN keeps them in lockstep.

DATA_DIR=./data
SENTRY_ENVIRONMENT=development

# Shared with fpp-web (must match — same source of truth)
ANALYTICS_SECRET_TOKEN=op://vps/fpp/ANALYTICS_SECRET_TOKEN
