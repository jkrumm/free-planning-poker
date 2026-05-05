.PHONY: help release release-dry deploy

help:
	@echo "FPP — convenience targets"
	@echo ""
	@echo "  make release       — bump version, tag, push, GitHub release (triggers deploy + Vercel)"
	@echo "  make release-dry   — analyze next version without publishing"
	@echo "  make deploy        — manually trigger a redeploy of fpp-server and fpp-analytics"
	@echo ""
	@echo "Frontend deploys to Vercel automatically on every push to master."
	@echo "Backends (fpp-server, fpp-analytics) deploy on every push to master via RollHook."

release:
	gh workflow run release.yml

release-dry:
	gh workflow run release.yml -f dry_run=true

deploy:
	gh workflow run deploy.yml -f service=both
