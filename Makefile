.PHONY: help check deploy verify logs

# Public production hostnames of v1, which runs from the branch v1 until the
# cutover. Overridable so `verify` can be pointed at another host.
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

# The gate until v9-foundation adds the code checks: the plan and the factory
# project file must parse and agree.
check: ## Check docs/plan.yaml and project.yaml
	@factory plan check
	@factory project check

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
