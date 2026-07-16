.PHONY: db-sync-from-prod db-setup-local analytics-update-local

# The local dev password for the `fpp` MariaDB user. NOT a secret: it only ever
# authenticates against the localhost:13306 dev container, never prod. Keeping
# it a plain constant (rather than the prod password via `op`) is what lets fpp
# be developed on the headless mini — see apps/web/.env.tpl for the rationale.
# Must match MARIADB_FPP_PASSWORD in apps/web/.env.tpl.
LOCAL_FPP_DB_PASSWORD ?= fpp-local-dev

# Sync production MariaDB → local. Thin wrapper around the canonical script
# that lives in the vps repo (single source of truth). Drops + recreates the
# local DB, streams a single-transaction mariadb-dump over SSH with gzip,
# resolves secrets remotely via `op run` on the VPS side.
#
# Needs no local 1Password: the prod credential is resolved on the VPS by its
# own op service account, and the local half of the script reads the dev
# container's own env. Runs on the headless mini too.
#
# Requires: vps repo cloned at ../vps, `make` available, SSH access to vps host.
db-sync-from-prod:
	@$(MAKE) -C ../vps fpp-sync-from-prod ENV=dev

# Provision/refresh the `fpp` MariaDB user on the LOCAL container.
# Local dev mariadb has no TLS, so the prod-style REQUIRE SSL user can't
# authenticate. This target creates the user without SSL, scoped to the
# free-planning-poker schema. Re-run after db-sync-from-prod (which drops
# the DB and wipes per-database grants).
#
# No 1Password needed — the script reads the root password from the running
# container's own env and grants a local-only password. Runs on any machine.
db-setup-local:
	@LOCAL_FPP_DB_PASSWORD='$(LOCAL_FPP_DB_PASSWORD)' ./scripts/db-setup-local.sh

# Refresh fpp-analytics parquet files from the local MariaDB. The analytics
# service reads from parquet (not MariaDB directly); in prod the
# fpp-analytics-updater sidecar writes them every 10 min. Locally we run the
# same updater once on demand. Run this after `make db-sync-from-prod` to
# rehydrate the /analytics page with real data.
#
# No 1Password needed — it reads the LOCAL database as the `fpp` user.
analytics-update-local:
	@cd fpp-analytics && \
		DB_HOST=127.0.0.1 DB_PORT=13306 DB_USERNAME=fpp DB_PASSWORD='$(LOCAL_FPP_DB_PASSWORD)' DATA_DIR=./data \
		uv run python update_readmodel.py
