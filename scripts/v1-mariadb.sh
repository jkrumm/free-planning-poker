#!/usr/bin/env bash
# A scratch MariaDB of v1's version for the v1 import (make v1-mariadb), one shot: start, restore DUMP, run SQL, dump DB to
# OUT, remove. The SQL file names its database itself (USE). The container is named per run and its data lives in a tmpfs, so nothing outlives the command, a failure
# included. No port is published: every statement goes through docker exec. The root password only guards this
# container for the minute it lives.
set -euo pipefail

image=${V1_MARIADB_IMAGE:-mariadb:11.4}
name="fpp-v1-mariadb-$$"
exec_db() { docker exec -i -e MYSQL_PWD=scratch "$name" "$@"; }

docker run -d --rm --name "$name" -e MARIADB_ROOT_PASSWORD=scratch \
  --tmpfs /var/lib/mysql:rw,size=${V1_MARIADB_TMPFS:-8g} "$image" >/dev/null
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT

ready=
for _ in $(seq 1 90); do
  if exec_db mariadb -uroot -e 'SELECT 1' >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[ -n "$ready" ] || { echo "scratch MariaDB did not start" >&2; exit 1; }

if [ -n "${DUMP:-}" ]; then
  start=$(date +%s)
  case "$DUMP" in
    *.gz) gunzip -c "$DUMP" | exec_db mariadb -uroot ;;
    *) exec_db mariadb -uroot <"$DUMP" ;;
  esac
  echo "restored $DUMP in $(( $(date +%s) - start )) s" >&2
fi

if [ -n "${SQL:-}" ]; then
  exec_db mariadb -uroot --table <"$SQL"
fi

if [ -n "${OUT:-}" ]; then
  [ -n "${DB:-}" ] || { echo "OUT needs DB=<database>" >&2; exit 2; }
  exec_db mariadb-dump -uroot --single-transaction --routines --triggers --events --databases "$DB" >"$OUT"
  echo "dumped $DB to $OUT" >&2
fi
