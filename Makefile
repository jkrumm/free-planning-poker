.PHONY: db-sync-from-prod db-setup-local analytics-update-local

# Sync production MariaDB → local. Thin wrapper around the canonical script
# that lives in the vps repo (single source of truth). Drops + recreates the
# local DB, streams a single-transaction mariadb-dump over SSH with gzip,
# resolves secrets remotely via `op run` on the VPS side.
#
# OP_ACCOUNT=tkrumm pins the right 1Password account (SourceRoot personal).
# vps Makefile's `op run` invocation doesn't pass --account explicitly,
# so the env var is the cleanest pin.
#
# Requires: vps repo cloned at ../vps, `make` available, SSH access to vps host.
db-sync-from-prod:
	@OP_ACCOUNT=tkrumm $(MAKE) -C ../vps fpp-sync-from-prod ENV=dev

# Provision/refresh the `fpp` MariaDB user on the LOCAL container.
# Local dev mariadb has no TLS, so the prod-style REQUIRE SSL user can't
# authenticate. This target creates the user without SSL, scoped to the
# free-planning-poker schema. Re-run after db-sync-from-prod (which drops
# the DB and wipes per-database grants).
db-setup-local:
	@OP_ACCOUNT=tkrumm op run --env-file=../vps/.env.tpl -- ./scripts/db-setup-local.sh

# Refresh fpp-analytics parquet files from the local MariaDB. The analytics
# service reads from parquet (not MariaDB directly); in prod the
# fpp-analytics-updater sidecar writes them every 10 min. Locally we run the
# same updater once on demand. Run this after `make db-sync-from-prod` to
# rehydrate the /analytics page with real data.
analytics-update-local:
	@OP_ACCOUNT=tkrumm op run --env-file=../vps/.env.tpl -- sh -c ' \
		cd fpp-analytics && \
		DB_HOST=127.0.0.1 DB_PORT=13306 DB_USERNAME=fpp DB_PASSWORD="$$MARIADB_FPP_PASSWORD" DATA_DIR=./data \
		uv run python update_readmodel.py'
