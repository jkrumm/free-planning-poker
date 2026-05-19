#!/usr/bin/env bash
# Provision/refresh the `fpp` MariaDB user against the LOCAL mariadb container.
#
# The vps repo's setup-mariadb.sh creates the user with REQUIRE SSL (prod uses
# TLS), but the local dev mariadb has no certs configured, so the prod-style
# user can't authenticate. This script mirrors the prod SQL minus REQUIRE SSL.
#
# Idempotent — safe to re-run after db-sync-from-prod (which DROPs the DB and
# wipes per-database grants).
#
# Invoke via: make db-setup-local (which wraps this in `op run`).
set -euo pipefail

: "${MARIADB_DB:?op run did not resolve MARIADB_DB}"
: "${MARIADB_ROOT_PASSWORD:?op run did not resolve MARIADB_ROOT_PASSWORD}"
: "${MARIADB_FPP_PASSWORD:?op run did not resolve MARIADB_FPP_PASSWORD}"

echo "==> Provisioning fpp user on local mariadb (db: $MARIADB_DB)..."

# Escape ' in the password for SQL string literals. MariaDB doubles single
# quotes inside single-quoted strings.
SQL_FPP_PASSWORD=${MARIADB_FPP_PASSWORD//\'/\'\'}

docker exec -i -e MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb \
  mariadb -u root <<SQL
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
docker exec -i -e MYSQL_PWD="$MARIADB_FPP_PASSWORD" mariadb \
  mariadb -u fpp -h 127.0.0.1 "$MARIADB_DB" \
  -e "SELECT 1 AS ok;"
