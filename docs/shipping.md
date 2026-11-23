# Shipping, CI and releases

Read this before changing CI workflows, branch settings, releases or deploy wiring. The ship path (PR, merge, verify) is in `AGENTS.md` §Deploy.

## Two branches

| | `master` | `v1` |
|-|-|-|
| Holds | the v9 rewrite | v1, frozen; tag `v1-freeze` is its last commit shared with `master` |
| Production | nothing deploys to production; the beta host is rolled by `deploy-next.yml` | Vercel (web) and `deploy.yml` → RollHook (fpp-server, fpp-analytics, fpp-analytics-updater) |
| Workflows | `ci.yml` on pull requests and pushes to `master`; `deploy-next.yml` on pushes to `master` and by dispatch; `release.yml` (`workflow_dispatch` only) | `deploy.yml` and `sonarcloud.yml` on push to `v1`; `validate.yml`, `sonarcloud.yml` and `comment.yml` on pull requests into `v1` |
| Gate | the check `ci` of `ci.yml`, which runs `make check` | `validate.yml`, lefthook pre-commit |

A workflow started by a push runs from the pushed branch's own file, so `v1` keeps its pipeline with none of it on `master`. A workflow is dispatched by hand (`workflow_dispatch`) or run on a schedule only while its file is on the default branch, so none of `v1`'s workflows can be started from the Actions tab or with `gh workflow run`.

## v1

- **Read:** `git show origin/v1:<path>`, `git ls-tree -r --name-only origin/v1`.
- **Fix:** a commit on `v1`, pushed to `v1` directly or through a pull request into `v1` (which runs `validate.yml`). The push runs `deploy.yml` from `v1` and Vercel builds a production deployment of it. Work on `v1` follows `git show origin/v1:AGENTS.md`.
- **Redeploy without a code change** (an env var changed in 1Password, say): an empty commit on `v1`.
  ```bash
  git fetch origin && git switch -c redeploy-v1 origin/v1
  git commit --allow-empty -m "chore: redeploy v1" && git push origin HEAD:v1
  ```
  It redeploys all three VPS services and the web app. `gh workflow run deploy.yml` no longer works (see above).
- RollHook accepts these deploys because the three fpp containers carry `rollhook.allowed_refs=refs/heads/v1` (vps `apps/fpp/compose.yml`). Without the label it allows only `main` and `master`; `master` is left out on purpose, so nothing on it can deploy into v1's containers.
- Never merge between `v1` and `master`. `v1` gets no dependency updates while frozen.

## Vercel

The project `free-planning-poker` builds the Root Directory `apps/web`. Its Production Branch is `v1` (Settings, Environments, Production, Branch Tracking). Its Ignored Build Step builds production deployments only, so every commit on another branch, `master` included, is cancelled before it builds: the commit gets the status `Vercel: Canceled by Ignored Build Step` (state `success`) and no GitHub deployment.

Tested on 2026-11-21 with two throwaway branches, both deleted afterwards:

| Branch | Result | What it means |
|-|-|-|
| a commit without `apps/web` | `Canceled by Ignored Build Step`, no deployment | the Ignored Build Step runs even when the Root Directory is missing; no failed build |
| `apps/web/vercel.json` with `git.deploymentEnabled` false for that branch | no status and no deployment at all | `git.deploymentEnabled` is read from the pushed commit's own `vercel.json` |

So `git.deploymentEnabled` on `v1` cannot stop a `master` commit, which has no `apps/web/vercel.json`. The switch that keeps `master` off Vercel is the project's Ignored Build Step. Changing it to a command that names a branch, or to Automatic, would make Vercel try every `master` commit.

## Branch protection

| Rule | `master` | `v1` |
|-|-|-|
| Pull request required | yes, 0 approvals, stale reviews dismissed | no |
| Required status checks | `ci` only, from GitHub Actions (strict mode on) | none |
| Linear history | yes; the repo allows rebase merges only | no |
| Conversation resolution | yes | no |
| Force push, deletion | refused | refused |
| Admins | not enforced; the owner can push directly | not enforced |

The ruleset `protect-default-branch` adds pull request, non-fast-forward, deletion and linear history on `master`, with the repository admin role as bypass. `ci` is the one required check: `ci.yml`'s last job, which fails when any job it needs failed or was cancelled, so adding or renaming a job never touches branch protection. Read it with `gh api repos/jkrumm/free-planning-poker/branches/master/protection/required_status_checks`.

## Releases

Manual, deliberate. Nothing releases automatically; version bumps are intentional. A release is cut from `master`; `v1` is not released while frozen.

**CI-based (canonical):**
```bash
gh workflow run release.yml                       # auto-bump per conventional commits
gh workflow run release.yml -f dry_run=true       # preview only
gh workflow run release.yml -f allow_major=true   # required for a major bump
```
Runs on a fresh runner using `RELEASE_TOKEN` (PAT) to push past branch protection; falls back to `GITHUB_TOKEN`.

A pre-flight step resolves the next version and **fails the run** on either of the
two cases release-it would otherwise wave through:

| Case | Behaviour |
|-|-|
| No bump-eligible commits since the last tag | Fails — otherwise the run is green and releases nothing |
| Major bump without `allow_major=true` | Fails — a stray `feat!:` or `BREAKING CHANGE:` footer can't cut a major by accident |

**Local with AI-enhanced notes — `/release-fpp [version]`:**
- Pre-flight → analyze commits → AI-generated summary → `release-it --ci` locally → `gh release edit` to prepend AI summary to the auto-generated changelog
- See `.claude/skills/release-fpp/SKILL.md`

**What release-it does** (config in `.release-it.json`): bumps version → updates `CHANGELOG.md` → commits `chore: release v<version>` + tag → pushes to master → creates `Release <version>` GitHub release with changelog as body.

**Notes:**
- The release chore commit lands on `master` and deploys nothing.
- `CHANGELOG.md` is auto-managed — never edit by hand. AI summary lives only in GitHub release notes.
- Must be on `master` with clean working dir (release-it enforces).

**Changelog visibility and bump eligibility** (per `.release-it.json`):

`conventional-changelog-conventionalcommits` v10 controls both with one `effect`
field per type, so a type cannot be hidden from the changelog *and* still count
toward a version bump — `hidden` means neither.

| Section | Types | `effect` | Bumps? |
|-|-|-|-|
| Features | `feat` | `bump` | minor |
| Bug Fixes | `fix` | `bump` | patch |
| Performance | `perf` | `bump` | patch |
| Refactoring | `refactor` | `bump` | patch |
| Documentation | `docs` | `bump` | patch |
| CI/CD | `ci` | `bump` | patch |
| _hidden_ | `chore`, `test`, `style`, `build` | `hidden` | no |

A release window containing only hidden types therefore resolves to no version.
`release.yml` fails loudly in that case rather than passing with nothing released
(release-it's own behaviour is to print "No new version to release" and exit 0).

The tag `v1-freeze` is not a version: `.release-it.json` sets `git.tagMatch` to `[0-9]*.[0-9]*.[0-9]*`, so release-it takes the last semver tag as the previous version. Without it, `git describe` returns `v1-freeze`.

## Beta host

`https://next.free-planning-poker.com` runs the whole of v9 (API, WebSocket, room app) from one image, noindex, until the cutover. `.github/workflows/deploy-next.yml` builds `apps/api/Dockerfile` and rolls it out through RollHook (`jkrumm/rollhook-action`, image `fpp-api`, build argument `OTEL_SERVICE_VERSION` the short commit hash).

- **When:** a push to `master` that touches lane `app` of `.github/lanes` (plus the root manifests the image is built from), the workflow itself, or a dispatch (`gh workflow run deploy-next.yml`, possible because the file is on the default branch). The path list copies the lane, because a workflow's `paths:` cannot read `.github/lanes`: change both together. No required check lives in this workflow, so a path filter is safe.
- **Queue:** concurrency group `deploy-next` with `cancel-in-progress: false`: a rollout in flight finishes, then the next starts.
- **Auth:** GitHub OIDC, no secret. RollHook reads `rollhook.allowed_repos` and `rollhook.allowed_refs=refs/heads/master` off the running `fpp-api` container (vps `apps/fpp/compose.yml`); the v1 services allow `refs/heads/v1` only, so the two lines cannot deploy into each other.
- **Proof:** `/api/version` names the commit's short hash; `make verify-next` probes `/api/health`; `make e2e-beta E2E_BASE_URL=https://next.free-planning-poker.com` runs the `@smoke` tests (`e2e/AGENTS.md`); `make logs SERVICE=fpp-api` tails the container.
- **First start:** RollHook issues a registry credential only for a running `fpp-api` container, so a fresh VPS needs one start before the first rollout: on the VPS `docker pull ghcr.io/jkrumm/free-planning-poker:sha-<short hash>` (the image `publish-image.yml` pushes), `docker tag` it as `rollhook.jkrumm.com/fpp-api:latest`, then `make fpp-api-up` in the vps repo; then `gh workflow run deploy-next.yml`. Done on 2026-11-22.
- **Image modes:** the runtime user is not the owner of `/app`, so every directory needs the execute bit for others; the Dockerfile sets modes with `chmod` in the build stage and `make v9-image-perms` (CI job `image`) fails on a directory it cannot search. A symbolic `COPY --chmod` left nested directories closed under the daemon's own BuildKit, which RollHook's `docker build` uses and buildx does not.
- **Rollback:** a revert of the commit on `master`; nothing deploys from a checkout (`make deploy` is a no-op).

## Site

`apps/site` runs on the beta host as the Worker `fpp-site-beta`: Workers static assets with the beta build and no Worker code (`apps/site/wrangler.jsonc`). The split by path and the three measured answers are `docs/v9/evidence/edge-routing.md`.

| Route on the zone | Worker | Served by |
|-|-|-|
| `next.free-planning-poker.com/*` | `fpp-site-beta` | the site's static assets |
| `next.free-planning-poker.com/room*`, `/_room/*`, `/api/*` | none | the tunnel, Traefik and `fpp-api` |

The most specific route wins, so the three routes with no Worker take their paths away from `/*`. `apps/site/scripts/edge-routes.ts` keeps them: it creates a missing one and detaches a Worker set on one, and leaves every other route alone.

- **When:** a push to `master` that touches lane `site` of `.github/lanes` (plus the root manifests), the workflow itself, or a dispatch (`gh workflow run deploy-site.yml`). The path list copies the lane: change both together.
- **What runs:** `.github/workflows/deploy-site.yml`: `make site` (both targets built and tested), `make site-deploy` (`edge-routes.ts` first, so `/*` never exists without the routes beside it, then `wrangler deploy`), `make indexnow` (skips on the beta target), `make verify-next`.
- **Queue:** concurrency group `deploy-site` with `cancel-in-progress: false`.
- **Auth:** two repository secrets. `CLOUDFLARE_API_TOKEN` is `cf-deploy`, the owner's one CI deploy token for Cloudflare across repos (Workers Scripts edit and Zone: Workers Routes edit, Zone read among its scopes; no DNS); `CLOUDFLARE_ACCOUNT_ID` is the account. Both live in 1Password item `common/cloudflare` (`DEPLOY_API_TOKEN`, `ACCOUNT_ID`) and are seeded without printing them: `ssh vps "op read 'op://common/cloudflare/DEPLOY_API_TOKEN'" | { IFS= read -r t && [ -n "$t" ] && printf %s "$t" | gh secret set CLOUDFLARE_API_TOKEN --repo jkrumm/free-planning-poker; }`, the same for the account id. A bare `op read | gh secret set` stores an empty secret and exits 0 when the field is missing. The token table is the `cloudflare` skill's.
- **Headers:** each build writes its own `_headers` (`apps/site/src/lib/headers.ts`): the security headers Traefik's `security-headers` middleware sets on the API's route, and on the beta build `X-Robots-Tag: noindex` on every path. `_headers` never reaches a response of Worker code; if Worker code is ever added, it sets these headers itself.
- **No other way in:** `workers_dev` and `preview_urls` are false, so the Worker has no `workers.dev` address and no public version URLs.
- **Rollback:** a revert on `master` deploys the previous build; `wrangler rollback` from a machine with the token is quicker. Removing the `/*` route hands the whole host back to `fpp-api`.
- **Cutover:** the apex needs the same three routes with no Worker (`edge-routes.ts --host free-planning-poker.com`), a production Worker with the production build, and the zone settings `docs/v9/evidence/edge-routing.md` lists.

## Verify and monitor

`make verify` probes production, which is v1 until the cutover, and the beta host: `/api/health`, and `/` and `/guide` for 200 with `X-Robots-Tag: noindex`. `make verify-production` and `make verify-next` probe one each; `project.yaml` lists the beta host as the deploy target `next`. Uptime Kuma monitors `FPP - Server - HTTP` and `FPP - Analytics - HTTP`. Probe URLs live in the root `Makefile` (`SERVER_URL`, `ANALYTICS_URL`, `WEB_URL`, `NEXT_URL`).
