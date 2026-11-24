.DEFAULT_GOAL := help
.PHONY: help load check-fast check fmt fmt-check lint types boundaries test test-server build site site-run arena arena-score e2e e2e-beta site-deploy indexnow factory-files bun-version lanes deploy verify verify-production verify-next logs import-v1 v1-mariadb v9-image v9-image-perms v9-up v9-down v9-sweep v9-logs v9-replace-api v9-smoke v9-size

# Public production hostnames of v1, which runs from the branch v1 until the
# cutover, and the beta host, where every push that touches lane app rolls out (deploy-next.yml).
# Overridable so `verify` can be pointed at another host.
WEB_URL ?= https://free-planning-poker.com/
SERVER_URL ?= https://server.free-planning-poker.com/health
ANALYTICS_URL ?= https://analytics.free-planning-poker.com/health
NEXT_ORIGIN ?= https://next.free-planning-poker.com
NEXT_URL ?= $(NEXT_ORIGIN)/api/health
# The site's pages verify-next probes on the beta host: each answers 200 from the Worker with the noindex header.
NEXT_SITE_PATHS ?= / /guide

# Compose service whose logs `make logs` tails. v1's server by default; override for
# another container, e.g. `make logs SERVICE=fpp-analytics`, or the beta host's: `make logs SERVICE=fpp-api`.
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

# The load test (docs/v9/evidence/load.md, load/AGENTS.md): k6 in a container against the v9 stack, in a Compose project of its
# own that load/run.ts starts and removes. Always in a slot, which is where a lead's containers belong. LOAD_SCALE=full is
# the claim (500 rooms, about 3.5 minutes); nightly is the CI guard (50 rooms). HANDOFF=1 replaces the API container halfway.
LOAD_SCALE ?= full

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
	@$(call step,types (tsc),bunx --no-install tsc --noEmit -p tsconfig.json && bunx --no-install tsc --noEmit -p tsconfig.dom.json && bunx --no-install tsc --noEmit -p e2e/tsconfig.json && bunx --no-install tsc --noEmit -p load/k6/tsconfig.json)
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

load: ## Load test with k6: make load [LOAD_SCALE=full|nightly] [LOAD_ROOMS=n] [HANDOFF=1] [NO_BUILD=1]; exits non-zero when a threshold fails
	@$(call step,load (k6, $(LOAD_SCALE)$(if $(HANDOFF), + handoff)),$(call slot,load) bun load/run.ts --scale $(LOAD_SCALE) $(if $(HANDOFF),--handoff) $(if $(NO_BUILD),--no-build) $(if $(LOAD_ROOMS),--rooms $(LOAD_ROOMS)))

v9-image: ## Build the API image (apps/api/Dockerfile) as fpp-api:local
	@$(V9_COMPOSE) build api

v9-up: ## Start the v9 stack (API with the room app, PostgreSQL 18) and wait until it is healthy
	@$(V9_COMPOSE) up -d --wait $(V9_UP_FLAGS)
	@echo "==> v9 stack up on http://127.0.0.1:$(FPP_PORT)"

# The runtime user (bun, uid 1000) is neither owner nor group of /app: it needs read on every file and search on every directory.
# A symbolic COPY --chmod once left nested directories without the execute bit under the daemon's own BuildKit, which CI's buildx did not show.
v9-image-perms: ## Fail when a directory of the image fpp-api:local is not searchable, or a file not readable, by every user
	@bad=$$(docker run --rm --entrypoint sh fpp-api:local -c 'find /app \( -type d ! -perm -005 \) -o \( -type f ! -perm -004 \)'); \
	if [ -n "$$bad" ]; then echo "==> not accessible to the runtime user:"; echo "$$bad"; exit 1; fi; \
	echo "==> image modes ok"

v9-size: ## Print the image's size, uncompressed and as a gzipped `docker save` (what a registry would hold, near enough)
	@docker image inspect fpp-api:local --format 'uncompressed: {{.Size}} bytes'
	@echo "compressed: $$(docker save fpp-api:local | gzip -c | wc -c | tr -d ' ') bytes"

v9-down: ## Remove the v9 stack with its database volume
	@$(V9_COMPOSE) down --volumes --remove-orphans

# A run that was killed never reached its cleanup. A stack older than two hours (a run takes minutes) is removed; never fatal.
v9-sweep: ## Remove fpp-e2e-* stacks older than two hours, left by a killed image-mode run
	@bun e2e/suite/sweep.ts

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

# The end-to-end suite (e2e/suite, lane app): one browser context per seat against a stack of its own on a port the system picks. e2e/suite/run.ts
# builds the room app and the API and runs them as plain processes on a private PostgreSQL (E2E_MODE=native, the default: no Docker
# engine). E2E_MODE=image builds and starts the image users self-host (deploy/compose.yml), as CI does with E2E_NO_BUILD and the
# loaded image. Arguments go to Playwright: make e2e E2E_ARGS='--grep "reload"'.
E2E_ARGS ?=
e2e: ## End-to-end suite against a stack of its own, in a slot (native, no Docker; E2E_MODE=image for the image; E2E_ARGS to Playwright)
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

# Nothing on master deploys to production: v1 deploys from the branch v1 (docs/shipping.md section v1). The beta host
# is rolled by CI (.github/workflows/deploy-next.yml), never from a checkout.
deploy: ## No-op: CI rolls the beta host, v1 deploys from the branch v1
	@echo "nothing deploys from a checkout; CI rolls the beta host, v1 deploys from the branch v1"

# Probe production (v1) and the beta host (v9). Exits non-zero if any endpoint is down or unhealthy.
verify: verify-production verify-next ## Probe health: production (web + server + analytics) and the beta host

verify-production: ## Probe production health (v1: web + server + analytics)
	@curl -fsS $(SERVER_URL) >/dev/null
	@curl -fsS $(ANALYTICS_URL) >/dev/null
	@curl -fsS $(WEB_URL) >/dev/null
	@echo "production healthy"

verify-next: ## Probe the beta host (v9): /api/health answers 200; / and /guide answer 200 with X-Robots-Tag noindex
	@curl -fsS $(NEXT_URL) >/dev/null
	@for path in $(NEXT_SITE_PATHS); do \
		headers=$$(curl -sS -o /dev/null -D - "$(NEXT_ORIGIN)$$path") || exit 1; \
		status=$$(printf '%s\n' "$$headers" | head -n1 | tr -d '\r'); \
		case "$$status" in *" 200"*) ;; *) echo "==> $(NEXT_ORIGIN)$$path answered $$status, not 200"; exit 1;; esac; \
		printf '%s\n' "$$headers" | grep -qi '^x-robots-tag: *noindex' || { echo "==> $(NEXT_ORIGIN)$$path has no X-Robots-Tag: noindex"; exit 1; }; \
	done
	@echo "beta host healthy: $(NEXT_URL), site $(NEXT_SITE_PATHS) noindex"

# The site's deploy to the beta host (docs/shipping.md, Site): first the routes with no Worker for /room*, /_room/* and
# /api/*, so those paths never reach the Worker, then the beta build as the Worker's static assets (apps/site/wrangler.jsonc).
# CI runs it (deploy-site.yml) after make site, with CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID; a checkout has neither.
SITE_HOST ?= next.free-planning-poker.com
site-deploy: ## Deploy apps/site's beta build to the beta host (CI only: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID; after make site)
	@test -n "$$CLOUDFLARE_API_TOKEN" && test -n "$$CLOUDFLARE_ACCOUNT_ID" || { echo "==> CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID unset: the site deploys from CI (deploy-site.yml)"; exit 2; }
	@test -f apps/site/dist/beta/_headers || { echo "==> no beta build at apps/site/dist/beta: run make site first"; exit 2; }
	@$(call step,routes with no Worker ($(SITE_HOST)),bun apps/site/scripts/edge-routes.ts --host $(SITE_HOST))
	@$(call step,wrangler deploy (fpp-site-beta),cd apps/site && WRANGLER_SEND_METRICS=false node_modules/.bin/wrangler deploy)

# The production URLs new or changed since the last deploy go to IndexNow (apps/site/scripts/indexnow.ts). The beta
# target skips; DRY_RUN=1 prints the list and sends nothing.
indexnow: ## Ping IndexNow with the URLs changed since the last deploy (lane site; DRY_RUN=1 lists them)
	@bun apps/site/scripts/indexnow.ts $(if $(DRY_RUN),--dry-run)

# Bounded tail of a production container's logs over SSH, then return. Never
# follows (-f). The container is matched by its Compose service label.
logs: ## Tail the last 200 lines of a production service's logs
	@ssh vps 'docker logs --tail 200 $$(docker ps -q --filter "label=com.docker.compose.service=$(SERVICE)" | head -n1)'
