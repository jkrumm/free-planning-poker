.DEFAULT_GOAL := help
.PHONY: help check-fast check fmt fmt-check lint types boundaries test test-server build factory-files bun-version lanes deploy verify logs

# Public production hostnames of v1, which runs from the branch v1 until the
# cutover. Overridable so `verify` can be pointed at another host.
WEB_URL ?= https://free-planning-poker.com/
SERVER_URL ?= https://server.free-planning-poker.com/health
ANALYTICS_URL ?= https://analytics.free-planning-poker.com/health

# Compose service whose logs `make logs` tails. Server by default; override for
# another container, e.g. `make logs SERVICE=fpp-analytics`.
SERVICE ?= fpp-server

# A step prints its name, and on failure the step that failed, then stops the target.
step = echo "==> $(1)"; $(2) || { echo "==> FAILED: $(1)"; exit 1; }

# JUnit for one test step, only when the factory asks for it (factory slot run sets FACTORY_JUNIT_DIR).
JUNIT = $(if $(FACTORY_JUNIT_DIR),--reporter=junit --reporter-outfile=$(FACTORY_JUNIT_DIR)/$(1).xml)

# The server tier runs in a factory test slot when the factory is on this host (project.yaml steps.test-server); in CI directly.
slot = $(if $(shell command -v factory 2>/dev/null),factory slot run --name "free-planning-poker $(1)" --,)

# Server-tier tests start Postgres and run in `make check` only.
SERVER_TESTS = **/*.server.test.ts

help: ## List available targets
	@grep -hE '^[a-zA-Z0-9_-]+:.*## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

check-fast: ## Before every push: format, lint, types, boundaries, unit tests, factory files (budget 60 s)
	@$(MAKE) --no-print-directory bun-version
	@$(call step,format (oxfmt --check),bunx --no-install oxfmt --check >/dev/null || bunx --no-install oxfmt --check)
	@$(call step,lint (oxlint),bunx --no-install oxlint --deny-warnings)
	@$(call step,types (tsc),bunx --no-install tsc --noEmit -p tsconfig.json)
	@$(call step,boundaries (scripts/boundaries.ts),bun scripts/boundaries.ts)
	@$(call step,unit tests (bun test),bun test $(call JUNIT,unit) --path-ignore-patterns='$(SERVER_TESTS)')
	@$(MAKE) --no-print-directory factory-files
	@echo "==> check-fast passed"

check: check-fast ## The full gate CI runs: check-fast, the server tests against Postgres, the build
	@$(call step,server tests,$(call slot,test-server) $(MAKE) --no-print-directory test-server)
	@$(call step,build,$(MAKE) --no-print-directory build)
	@echo "==> check passed"

fmt: ## Format every file in place
	@bunx --no-install oxfmt

test-server: ## Server-tier tests: each starts its own Postgres from PG_BIN_DIR
	@bun test $(call JUNIT,server) server.test

build: ## Build the API bundle
	@bun run --filter '@fpp/api' build

# The plan and the project file must parse; skipped where the factory CLI is not installed (CI).
factory-files:
	@if command -v factory >/dev/null; then \
		$(call step,factory files (plan + project),factory plan check >/dev/null && factory project check); \
	else echo "==> factory files: skipped, no factory CLI on this host"; fi

# package.json's packageManager pins Bun for CI and the factory's step image; a different local Bun is a warning.
bun-version:
	@want=$$(sed -n 's/.*"packageManager": "bun@\([^"]*\)".*/\1/p' package.json); have=$$(bun --version); \
	[ "$$want" = "$$have" ] || echo "==> warning: bun $$have runs here, package.json pins $$want"

lanes: ## Which CI lanes this branch touches against origin/master (.github/lanes)
	@EVENT=local .github/lanes.sh

# Nothing on master deploys to production. v1 deploys from the branch v1
# (docs/shipping.md section v1).
deploy: ## No-op: nothing on master deploys
	@echo "nothing on master deploys; v1 deploys from the branch v1"

# Probe production (v1). Exits non-zero if any endpoint is down or unhealthy.
verify: ## Probe production health (web + server + analytics)
	@curl -fsS $(SERVER_URL) >/dev/null
	@curl -fsS $(ANALYTICS_URL) >/dev/null
	@curl -fsS $(WEB_URL) >/dev/null
	@echo "production healthy"

# Bounded tail of a production container's logs over SSH, then return. Never
# follows (-f). The container is matched by its Compose service label.
logs: ## Tail the last 200 lines of a production service's logs
	@ssh vps 'docker logs --tail 200 $$(docker ps -q --filter "label=com.docker.compose.service=$(SERVICE)" | head -n1)'
