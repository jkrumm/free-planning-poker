#!/usr/bin/env bash
# Compose DATABASE_URL from the MariaDB password resolved by `op run` from
# .env.tpl, then hand off to Next.js. Lives in a script (not inline in
# package.json) because the bash quoting gets gnarly in JSON.
#
# MARIADB_FPP_PASSWORD comes from op://vps/mariadb/FPP_PASSWORD — same
# source the VPS uses to provision the FPP user, so password rotation is
# automatic on the local side.
set -eu
: "${MARIADB_FPP_PASSWORD:?op run did not resolve MARIADB_FPP_PASSWORD — check 1Password access}"
export DATABASE_URL="mysql://fpp:${MARIADB_FPP_PASSWORD}@localhost:13306/free-planning-poker"
exec next dev -p 7720
