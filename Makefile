.DEFAULT_GOAL := help
.PHONY: help check-fast check fmt fmt-check lint types boundaries test test-server build site site-run arena arena-score e2e e2e-beta indexnow factory-files bun-version lanes deploy verify logs import-v1 v1-mariadb v9-image v9-up v9-down v9-logs v9-replace-api v9-smoke v9-size

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

# Effect's type-aware lint rules (effecttsgo/*) run only through effect-tsgo's patched oxlint, over the three folders where Effect lives.
EFFECT_DIRS = apps/api/src/app apps/api/src/db apps/api/src/jobs

# The v9 stack (deploy/compose.yml, the file users self-host with, and deploy/compose.build.yml, which builds the image from
# this checkout): the API image with the room app, and PostgreSQL 18. Docker is driven from these targets only. A lead starts
# the stack inside a slot (`factory slot run -- make v9-up`), never from a bare shell.
V9_PROJECT ?= fpp-v9
V9_COMPOSE = docker compose -p $(V9_PROJECT) -f deploy/compose.yml -f deploy/compose.build.yml
# The self-hosting file has no default for its two secrets; a local stack gets these values (never a deployment's), unless
# deploy/.env exists: Compose ranks the environment above that file, so exporting them would override a real `.env`. The suite
# (e2e/suite/run.ts) and a caller's environment override them.
ifeq ($(wildcard deploy/.env),)
export POSTGRES_PASSWORD ?= fpp-local
export VISITOR_KEY ?= local-visitor-key-change-it-0000000
endif
export FPP_IMAGE ?= fpp-api:local
# CI loads the built image and starts it with V9_UP_FLAGS=--no-build; locally the stack builds its own.
V9_UP_FLAGS ?= --build
export FPP_PORT ?= 7740
export OTEL_SERVICE_VERSION ?= $(shell git rev-parse --short=7 HEAD 2>/dev/null || echo local)

# Site tests read the built output, so they run in `make site` only.
SITE_TESTS = **/*.site.test.ts

help: ## List available targets
	@grep -hE '^[a-zA-Z0-9_-]+:.*## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

check-fast: ## Before every push: format, lint, messages, Effect lint, types, boundaries, unit tests, factory files (budget 60 s)
	@$(MAKE) --no-print-directory bun-version
	@$(call step,format (oxfmt --check),bunx --no-install oxfmt --check >/dev/null || bunx --no-install oxfmt --check)
	@$(call step,lint (oxlint),bunx --no-install oxlint --deny-warnings)
	@$(call step,messages (packages/i18n/scripts/messages.ts),bun packages/i18n/scripts/messages.ts)
	@$(call step,effect lint (effect-tsgo oxlint),bunx --no-install effect-tsgo oxlint --type-aware -c .oxlintrc.effect.json --deny-warnings $(EFFECT_DIRS))
	@$(call step,types (tsc),bunx --no-install tsc --noEmit -p tsconfig.json && bunx --no-install tsc --noEmit -p tsconfig.dom.json && bunx --no-install tsc --noEmit -p e2e/tsconfig.json)
	@$(call step,boundaries (scripts/boundaries.ts),bun scripts/boundaries.ts)
	@$(call step,unit tests (bun test),bun test $(call JUNIT,unit) --path-ignore-patterns='$(SERVER_TESTS)' --path-ignore-patterns='$(SITE_TESTS)')
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

build: ## Build the room app (apps/room/dist) and the API bundle
	@bun run --filter '@fpp/room' build
	@bun apps/room/scripts/budget.ts
	@bun run --filter '@fpp/api' build

# The marketing site (lane site): both targets plus the fixture content, then the tests over the built output.
site: ## Build apps/site for production and beta, then test the output (lane site)
	@$(call step,site,$(call slot,site) $(MAKE) --no-print-directory site-run)
	@echo "==> site passed"

site-run:
	@$(call step,site build (production, beta, fixtures),ASTRO_TELEMETRY_DISABLED=1 bun run --filter '@fpp/site' build)
	@$(call step,site tests,bun test apps/site $(call JUNIT,site))

v9-image: ## Build the API image (apps/api/Dockerfile) as fpp-api:local
	@$(V9_COMPOSE) build api

v9-up: ## Start the v9 stack (API with the room app, PostgreSQL 18) and wait until it is healthy
	@$(V9_COMPOSE) up -d --wait $(V9_UP_FLAGS)
	@echo "==> v9 stack up on http://127.0.0.1:$(FPP_PORT)"

v9-size: ## Print the image's size, uncompressed and as a gzipped `docker save` (what a registry would hold, near enough)
	@docker image inspect fpp-api:local --format 'uncompressed: {{.Size}} bytes'
	@echo "compressed: $$(docker save fpp-api:local | gzip -c | wc -c | tr -d ' ') bytes"

v9-down: ## Remove the v9 stack with its database volume
	@$(V9_COMPOSE) down --volumes --remove-orphans

v9-logs: ## The last 200 lines of every container of the v9 stack
	@$(V9_COMPOSE) logs --no-color --tail=200

# What a deploy does to the API (docs/v9/ARCHITECTURE.md, Server): SIGTERM and the drain, then a new container on the same database.
v9-replace-api: ## Stop the API container, remove it and start a new one against the same database
	@$(V9_COMPOSE) stop api
	@$(V9_COMPOSE) rm --force api
	@$(V9_COMPOSE) up -d --no-deps --no-build --wait api

v9-smoke: ## Probe the running stack: /api/health answers 200 and /room/x returns the shell
	@curl -fsS http://127.0.0.1:$(FPP_PORT)/api/health
	@echo
	@curl -fsS http://127.0.0.1:$(FPP_PORT)/room/x | grep -q '/_room/' || { echo "==> /room/x is not the room app's shell"; exit 1; }
	@echo "==> v9 smoke passed"

# The table arena (docs/v9/ARENA.md): the gallery with every entry under arena/entries, and one entry's scorecard.
arena: ## Build the table arena's gallery (apps/arena/dist) and render every entry through every scenario
	@$(call step,arena build (vite),bun run --filter '@fpp/arena' build)
	@$(call step,arena entries render every scenario,bun test apps/arena $(call JUNIT,arena))

# The scorecard: static checks, then Playwright in the bundled headless shell, in a factory slot where there is one.
# Writes arena/scores/$(ENTRY)/index.html and score.json; exits non-zero when a rule of the floor fails. About 3 min.
arena-score: ## Score one table entry: make arena-score ENTRY=<name> (writes arena/scores/<name>/)
	@test -n "$(ENTRY)" || { echo "usage: make arena-score ENTRY=<name>"; exit 2; }
	@test -f "arena/entries/$(ENTRY)/index.tsx" || { echo "no entry at arena/entries/$(ENTRY)/index.tsx"; exit 2; }
	@$(MAKE) --no-print-directory arena
	@rm -rf "arena/scores/$(ENTRY)"
	@$(call step,arena static checks,bun apps/arena/scripts/static-score.ts $(ENTRY))
	@$(call step,arena browser (headless shell),e2e/node_modules/.bin/playwright install --only-shell chromium ffmpeg >/dev/null)
	@$(call step,arena scorecard (playwright),$(call slot,arena-score) env ARENA_ENTRY=$(ENTRY) e2e/node_modules/.bin/playwright test -c e2e/arena/playwright.config.ts)

# The end-to-end suite (e2e/suite, lane app): one browser context per seat against the image users self-host. e2e/suite/run.ts builds
# the image, starts its own stack on a port the system picks, runs Playwright in the bundled headless shell and removes the
# stack; arguments go to Playwright: make e2e E2E_ARGS='--grep "reload"'. CI starts it with E2E_NO_BUILD and the loaded image.
E2E_ARGS ?=
e2e: ## End-to-end suite against a stack of its own, in a slot (about 20 s of tests plus the image build; E2E_ARGS to Playwright)
	@$(call step,e2e browser (headless shell),e2e/node_modules/.bin/playwright install --only-shell chromium >/dev/null)
	@$(call step,e2e suite (stack + playwright),$(call slot,e2e) bun e2e/suite/run.ts $(E2E_ARGS))

# The tests tagged @smoke against a running host (the beta host), never production: they need no Docker.
e2e-beta: ## Smoke tests against a running host: make e2e-beta E2E_BASE_URL=<origin of the beta host>
	@test -n "$(E2E_BASE_URL)" || { echo "usage: make e2e-beta E2E_BASE_URL=<origin of the beta host>"; exit 2; }
	@$(call step,e2e browser (headless shell),e2e/node_modules/.bin/playwright install --only-shell chromium >/dev/null)
	@$(call step,e2e smoke (playwright),E2E_BASE_URL=$(E2E_BASE_URL) e2e/node_modules/.bin/playwright test -c e2e/suite/playwright.config.ts --grep @smoke $(E2E_ARGS))

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

# The one-time import of v1 (apps/api/src/jobs/import-v1, docs/v9/evidence/import-rehearsal.md): reads a mariadb-dump
# file, plain or gzip, and writes into the Postgres of DATABASE_URL with VISITOR_KEY, both from the environment. A dry run
# unless APPLY=1; ALLOW_OTHER_ORIGINS=1 imports into a database that holds v9 rooms.
REPORT ?= import-v1-report.json
import-v1: ## Import a v1 dump: make import-v1 DUMP=<file.sql[.gz]> [APPLY=1] [REPORT=<file>] (DATABASE_URL, VISITOR_KEY)
	@test -n "$(DUMP)" || { echo "usage: make import-v1 DUMP=<file.sql[.gz]> [APPLY=1]"; exit 2; }
	@bun apps/api/scripts/import-v1.ts --dump "$(DUMP)" --report "$(REPORT)" $(if $(APPLY),--apply) $(if $(ALLOW_OTHER_ORIGINS),--allow-other-origins)

# A scratch MariaDB of v1's version, one shot (scripts/v1-mariadb.sh): started, given DUMP, asked SQL, dumped to OUT and
# removed, all in one command. Never the shared development MariaDB. Run it in a test slot, as every container of a lead:
# factory slot run -- make v1-mariadb DUMP=<file.sql[.gz]> SQL=<file.sql>
v1-mariadb: ## One-shot scratch MariaDB 11.4: DUMP=<file.sql[.gz]> restores, SQL=<file> runs, OUT=<file> DB=<db> dumps; then removed
	@scripts/v1-mariadb.sh

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

# The production URLs new or changed since the last deploy go to IndexNow (apps/site/scripts/indexnow.ts). The beta
# target skips; DRY_RUN=1 prints the list and sends nothing.
indexnow: ## Ping IndexNow with the URLs changed since the last deploy (lane site; DRY_RUN=1 lists them)
	@bun apps/site/scripts/indexnow.ts $(if $(DRY_RUN),--dry-run)

# Bounded tail of a production container's logs over SSH, then return. Never
# follows (-f). The container is matched by its Compose service label.
logs: ## Tail the last 200 lines of a production service's logs
	@ssh vps 'docker logs --tail 200 $$(docker ps -q --filter "label=com.docker.compose.service=$(SERVICE)" | head -n1)'
