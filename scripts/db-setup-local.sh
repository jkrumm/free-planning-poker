#!/usr/bin/env bash
# Provision/refresh the `fpp` MariaDB user against the LOCAL mariadb container.
#
# The vps repo's setup-mariadb.sh creates the user with REQUIRE SSL (prod uses
# TLS), but the local dev mariadb has no certs configured, so the prod-style
# user can't authenticate. This script mirrors the prod SQL minus REQUIRE SSL.
#
# Needs NO 1Password access, so it runs anywhere — headless Mac mini included.
# Two reasons:
#   - The root password is read from the container's OWN environment. The local
#     container (vps/compose.dev.yml) was started with MARIADB_ROOT_PASSWORD
#     already set, so there is nothing to resolve, and the credential never
#     enters the host shell — it stays inside the container it already lives in.
#   - The `fpp` password is a local-only constant, not the prod one. Local dev
#     talks to localhost:13306, so it never needed to match prod.
#
# Idempotent — safe to re-run after db-sync-from-prod (which DROPs the DB and
# wipes per-database grants).
#
# Invoke via: make db-setup-local
set -euo pipefail

CONTAINER="${MARIADB_CONTAINER:-mariadb}"
MARIADB_DB="${MARIADB_DB:-free-planning-poker}"
# Must match MARIADB_FPP_PASSWORD in apps/web/.env.tpl and LOCAL_FPP_DB_PASSWORD
# in the root Makefile.
FPP_PASSWORD="${LOCAL_FPP_DB_PASSWORD:-fpp-local-dev}"

docker inspect "$CONTAINER" >/dev/null 2>&1 || {
  echo "==> ERROR: mariadb container '$CONTAINER' not found." >&2
  echo "    Start the local stack first (vps/compose.dev.yml)." >&2
  exit 1
}

echo "==> Provisioning fpp user on local mariadb (container: $CONTAINER, db: $MARIADB_DB)..."

# Escape ' in the password for SQL string literals. MariaDB doubles single
# quotes inside single-quoted strings.
SQL_FPP_PASSWORD=${FPP_PASSWORD//\'/\'\'}

# The `sh -c` body is single-quoted so the HOST shell leaves it alone —
# $MARIADB_ROOT_PASSWORD expands inside the container, from the container's env.
# The heredoc is unquoted, so the host expands the SQL values below.
docker exec -i "$CONTAINER" \
  sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -u root' <<SQL
CREATE DATABASE IF NOT EXISTS \`${MARIADB_DB}\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'fpp'@'%' IDENTIFIED BY '${SQL_FPP_PASSWORD}';
ALTER USER 'fpp'@'%' IDENTIFIED BY '${SQL_FPP_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${MARIADB_DB}\`.* TO 'fpp'@'%';
FLUSH PRIVILEGES;
SQL

echo "==> Done. fpp user has full grants on $MARIADB_DB (no SSL requirement)."

# Smoke test: connect as fpp from inside the container (same TCP path Next.js
# uses, just from inside the docker bridge). A plain SELECT 1 confirms auth +
# grants without requiring any table to exist yet — important when this runs
# before db-sync-from-prod against a freshly created empty schema.
echo "==> Smoke test (auth + grants)..."
docker exec -i -e MYSQL_PWD="$FPP_PASSWORD" "$CONTAINER" \
  mariadb -u fpp -h 127.0.0.1 "$MARIADB_DB" \
  -e "SELECT 1 AS ok;"
