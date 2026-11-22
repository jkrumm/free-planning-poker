.DEFAULT_GOAL := help
.PHONY: help check-fast check fmt fmt-check lint types boundaries test test-server build site site-run arena arena-score indexnow factory-files bun-version lanes deploy verify logs

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

# The production URLs new or changed since the last deploy go to IndexNow (apps/site/scripts/indexnow.ts). The beta
# target skips; DRY_RUN=1 prints the list and sends nothing.
indexnow: ## Ping IndexNow with the URLs changed since the last deploy (lane site; DRY_RUN=1 lists them)
	@bun apps/site/scripts/indexnow.ts $(if $(DRY_RUN),--dry-run)

# Bounded tail of a production container's logs over SSH, then return. Never
# follows (-f). The container is matched by its Compose service label.
logs: ## Tail the last 200 lines of a production service's logs
	@ssh vps 'docker logs --tail 200 $$(docker ps -q --filter "label=com.docker.compose.service=$(SERVICE)" | head -n1)'
