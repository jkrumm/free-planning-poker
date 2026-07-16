#!/usr/bin/env bash
# Compose DATABASE_URL from the MariaDB password injected from .env.tpl, then
# hand off to Next.js. Lives in a script (not inline in package.json) because
# the bash quoting gets gnarly in JSON.
#
# MARIADB_FPP_PASSWORD is a local-only constant (see apps/web/.env.tpl), not
# the prod password — it authenticates against the localhost:13306 dev
# container that `make db-setup-local` provisions.
set -eu
: "${MARIADB_FPP_PASSWORD:?MARIADB_FPP_PASSWORD not set — is .env.tpl being injected?}"
# URL-encode the password — if it contains ':', '@', '/', '?', '#' etc., the
# driver's URI parser will mis-split the connection string. python3 is already
# available locally (uv-managed fpp-analytics) so we lean on urllib.
ENCODED_DB_PASSWORD="$(python3 -c 'import os, urllib.parse; print(urllib.parse.quote(os.environ["MARIADB_FPP_PASSWORD"], safe=""))')"
export DATABASE_URL="mysql://fpp:${ENCODED_DB_PASSWORD}@localhost:13306/free-planning-poker"
exec next dev -p 7720
