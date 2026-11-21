# Shipping, CI and releases

Read this before changing CI workflows, branch settings, releases or deploy wiring. The ship path (PR, merge, verify) is in `AGENTS.md` §Shipping.

## Two branches

| | `master` | `v1` |
|-|-|-|
| Holds | the v9 rewrite | v1, frozen; tag `v1-freeze` is its last commit shared with `master` |
| Production | nothing deploys | Vercel (web) and `deploy.yml` → RollHook (fpp-server, fpp-analytics, fpp-analytics-updater) |
| Workflows | `release.yml` (`workflow_dispatch` only) | `deploy.yml` and `sonarcloud.yml` on push to `v1`; `validate.yml`, `sonarcloud.yml` and `comment.yml` on pull requests into `v1` |
| Gate | `make check` (`factory plan check`, `factory project check`) | `validate.yml`, lefthook pre-commit |

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
| Required status checks | none (strict mode on, empty list) | none |
| Linear history | yes; the repo allows rebase merges only | no |
| Conversation resolution | yes | no |
| Force push, deletion | refused | refused |
| Admins | not enforced; the owner can push directly | not enforced |

The ruleset `protect-default-branch` adds pull request, non-fast-forward, deletion and linear history on `master`, with the repository admin role as bypass. `master` has no required check because no workflow reports on its pull requests after the freeze; `v9-foundation`'s `ci.yml` brings the next ones.

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

## Verify and monitor

`make verify` probes production, which is v1 until the cutover. Uptime Kuma monitors `FPP - Server - HTTP` and `FPP - Analytics - HTTP`. Probe URLs live in the root `Makefile` (`SERVER_URL`, `ANALYTICS_URL`, `WEB_URL`).
