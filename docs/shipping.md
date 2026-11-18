# Shipping, CI and releases

Read this before changing CI workflows, branch settings, releases or deploy wiring. The ship path (PR, merge, verify) is in `AGENTS.md` §Shipping.

### Branch protection (master)

| Rule | State |
|-|-|
| `required_pull_request_reviews` | enabled, 0 approvals — PR required structurally |
| `required_linear_history` | true — no merge commits; the repo allows rebase merges only |
| `required_conversation_resolution` | true — open PR threads block merge |
| `allow_force_pushes` | false |
| `enforce_admins` | false — repo owner can push directly to master |

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

### CI workflows (`.github/workflows/`)

| Workflow | Trigger | Purpose |
|-|-|-|
| `validate.yml` | `pull_request` | 17 parallel jobs — Next.js (typecheck/format/lint/build), fpp-server (same 4), @fpp/db (format/lint/typecheck), @fpp/shared (format/lint/typecheck), fpp-analytics (format/lint/typecheck) |
| `sonarcloud.yml` | `push` master + `pull_request` | SonarCloud scan for all three services |
| `comment.yml` | `pull_request` (path-filtered) | Auto-posts notes when `**/schema.ts`, `apps/server/**`, or `fpp-analytics/**` change |
| `deploy.yml` | `push` master + `workflow_dispatch` | Builds + ships Docker images via RollHook (`https://rollhook.jkrumm.com`) |
| `release.yml` | `workflow_dispatch` only | Runs `release-it --ci` on a fresh runner; pushes chore commit + tag back to master |

`deploy.yml` uses `concurrency.cancel-in-progress: false` — deploys queue rather than cancel.

### Releases

Manual, deliberate. Master pushes deploy automatically but never auto-release — version bumps are intentional.

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
- The release chore commit re-triggers `deploy.yml`. Build is idempotent (same source = same digest), so RollHook detects no rollout needed. Vercel rebuilds Next.js with the new version string.
- `CHANGELOG.md` is auto-managed — never edit by hand. AI summary lives only in GitHub release notes.
- Must be on `master` with clean working dir (release-it enforces).

## Deploy

Deploys are owned by CI, never run locally — `make deploy` is a no-op that
prints `deployed by CI on push`. On every push to master:

| Service | Runtime | Trigger |
|-|-|-|
| Next.js web | Vercel | Vercel GitHub integration on every master push |
| fpp-server | VPS Docker | `deploy.yml` → RollHook (rolling, zero-downtime) |
| fpp-analytics | VPS Docker | `deploy.yml` → RollHook |
| fpp-analytics-updater | VPS Docker | `deploy.yml` → RollHook |

**Auth:** GitHub OIDC → RollHook exchanges for short-lived registry creds; RollHook authorizes via the `rollhook.allowed_repos` label on the running container (`vps/apps/fpp/compose.yml`). `deploy.yml` uses `concurrency.cancel-in-progress: false` — deploys queue, never cancel.

**Manual redeploy** (e.g. an env var changed in 1Password, no code change):
```bash
gh workflow run deploy.yml -f service=<all|fpp-server|fpp-analytics|fpp-analytics-updater>
```

## Verify & monitor

Uptime Kuma monitors: `FPP - Server - HTTP` and `FPP - Analytics - HTTP`. Probe URLs live in the root `Makefile` (`SERVER_URL`, `ANALYTICS_URL`, `WEB_URL`).
