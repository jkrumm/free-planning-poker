.PHONY: help check deploy verify logs db-sync-from-prod db-setup-local analytics-update-local

# Public production hostnames for the web app and its two VPS services.
# Overridable so `verify` can be pointed at a preview/staging host if needed.
WEB_URL ?= https://free-planning-poker.com/
SERVER_URL ?= https://server.free-planning-poker.com/health
ANALYTICS_URL ?= https://analytics.free-planning-poker.com/health

# Compose service whose logs `make logs` tails. Server by default; override for
# another container, e.g. `make logs SERVICE=fpp-analytics`.
SERVICE ?= fpp-server

help: ## List available targets
	@grep -hE '^[a-zA-Z0-9_-]+:.*## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2}'

# The same validation CI runs, mirrored locally. Non-mutating: `format:check`
# never writes, and only gitignored build output/caches are produced. Run
# `bun install --frozen-lockfile` first; `uv` must be on PATH for fpp-analytics.
check: ## Run the local validation CI runs (format, lint, type-check, build)
	@bun run --filter=@fpp/web format:check
	@SKIP_ENV_VALIDATION=1 bun run --filter=@fpp/web lint
	@SKIP_ENV_VALIDATION=1 bun run --filter=@fpp/web type-check
	@SKIP_ENV_VALIDATION=1 bun run --filter=@fpp/web build
	@bun run --filter=@fpp/server format:check
	@bun run --filter=@fpp/server lint
	@bun run --filter=@fpp/server type-check
	@bun run --filter=@fpp/server build
	@bun run --filter=@fpp/db format:check
	@bun run --filter=@fpp/db lint
	@bun run --filter=@fpp/db type-check
	@bun run --filter=@fpp/shared format:check
	@bun run --filter=@fpp/shared lint
	@bun run --filter=@fpp/shared type-check
	@cd fpp-analytics && uv sync --extra dev
	@cd fpp-analytics && uv run ruff format --check .
	@cd fpp-analytics && uv run ruff check .
	@cd fpp-analytics && uv run mypy .

# Deploys are owned by CI, not run locally: Vercel rebuilds the web app on every
# push to master, and `deploy.yml` ships the server/analytics images via RollHook.
deploy: ## No-op — CI deploys on push to master (Vercel + RollHook)
	@echo "deployed by CI on push"

# Probe production. Exits non-zero if any endpoint is down or unhealthy.
verify: ## Probe production health (web + server + analytics)
	@curl -fsS $(SERVER_URL) >/dev/null
	@curl -fsS $(ANALYTICS_URL) >/dev/null
	@curl -fsS $(WEB_URL) >/dev/null
	@echo "production healthy"

# Bounded tail of a production container's logs over SSH, then return. Never
# follows (-f). The container is matched by its Compose service label.
logs: ## Tail the last 200 lines of a production service's logs
	@ssh vps 'docker logs --tail 200 $$(docker ps -q --filter "label=com.docker.compose.service=$(SERVICE)" | head -n1)'

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
