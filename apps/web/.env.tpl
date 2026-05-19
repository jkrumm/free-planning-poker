# FPP Web (Next.js) — local dev env via 1Password.
# Resolved at runtime: `op run --account tkrumm --env-file=.env.tpl -- <cmd>`.
# Production secrets live in Vercel — not here.
#
# Most env.ts entries are required by zod even though their *values* are
# meaningless locally (Sentry no-ops, Upstash rate-limit fails open, email
# isn't sent, Todoist isn't called). For those: hardcode a value that
# satisfies the schema. Only the three vars that gate the real dev loop
# resolve from 1Password — and two of them already exist in op://vps/fpp/*.

# --- Hardcoded local config (matches Caddy hostnames) ---
NEXT_PUBLIC_NODE_ENV=development
NEXT_PUBLIC_API_ROOT=https://fpp.test/
NEXT_PUBLIC_FPP_SERVER_URL=fpp-server.test
# Server-side fetch: Node's TLS trust store doesn't include Caddy's local CA,
# so internal calls bypass Caddy and hit fpp-analytics on the raw port.
ANALYTICS_URL=http://localhost:7722
VERCEL_GIT_COMMIT_SHA=local-dev

# --- Disabled-in-local dummies (satisfy zod, no real connection) ---
# Sentry DSN public-key must match \w+ (no hyphens) or @sentry/* rejects it.
NEXT_PUBLIC_SENTRY_DSN=https://devdummy@sentry.local/0
SENTRY_API_KEY=local-dev-noop
UPSTASH_REDIS_REST_URL=https://dev-disabled.local
UPSTASH_REDIS_REST_TOKEN=local-dev-noop
SEND_EMAIL=dev@example.com
SEND_EMAIL_PASSWORD=local-dev-noop
TARGET_EMAIL=dev@example.com
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
