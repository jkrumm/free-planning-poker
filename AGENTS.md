# Free Planning Poker - AI Development Guide

## What is on master

`master` holds the v9 rewrite: its documents and no application code yet. `v9-foundation` (a row of `docs/plan.yaml`) builds the root on it: workspaces, tooling, CI, the first packages.

| Path | What |
|-|-|
| `docs/v9/` | the rewrite: `STRATEGY.md`, `UX.md`, `ARCHITECTURE.md`, `ENGINEERING.md`, `PLAN.md`, `GATE-1.md`, `research/` |
| `docs/plan.yaml` | the rows the factory builds, in order |
| other `docs/` files | v1's reference docs, kept until the row that replaces each one |
| `package.json`, `bun.lock` | commitlint, lefthook (commit-msg only) and release-it, nothing else |

## Where v1 lives

v1, the app in production today, is frozen on the branch `v1`; the tag `v1-freeze` marks the last commit it shared with `master`. It needs no work until the cutover (the owner's ruling of 2026-11-20). Contract: `docs/v9/ENGINEERING.md` section Where v1 lives.

- Read v1 with `git show origin/v1:<path>`; list it with `git ls-tree -r --name-only origin/v1`. Its own `AGENTS.md` (`git show origin/v1:AGENTS.md`) applies to work on that branch.
- A fix, should one be needed, is a commit on `v1`; the push deploys it. A redeploy is an empty commit on `v1`. Both in `docs/shipping.md` section v1.
- Never merge `v1` into `master` or `master` into `v1`.

## Commands

- Install: `bun install --frozen-lockfile`.
- Validate: `make check` runs `factory plan check` and `factory project check`. Run it before the first push and after every change. It is the gate until `v9-foundation` replaces it.
- Verify: `make verify` probes production (still v1: web, server, analytics) and exits non-zero when one is down. `make logs` tails the last 200 lines of prod fpp-server (`make logs SERVICE=fpp-analytics` for another).
- Validation, research and review run through forked skills: `/check`, `/research`, `/review`.

## Shipping

- **Direct to master** only when all hold: one concern, small diff (typo, docs, config), lefthook passes. Everything else is a PR. When in doubt, open a PR.
- **Commits:** `<type>(<scope>): <subject>`. Types: feat, fix, perf, refactor, docs, ci, chore, test, style, build. Scope is optional and must be `JK-<number>` if present. Header ≤ 80 characters, no trailing period (`commitlint.config.ts`, enforced by lefthook). Branch: `<type>/<short-description>`. No AI attribution anywhere.
- **PR:** `git push -u origin HEAD`, then `gh pr create --base master --fill`. Fold review fixes into the originating commit and `git push --force-with-lease`.
- **Merge** is rebase-only (linear history), inside the merge window (`factory land`, or `factory merge-lock --project free-planning-poker -- ...`).
- **Deploy:** nothing on `master` deploys to production. No workflow runs on a push to `master`, and Vercel cancels every commit outside its Production Branch `v1`. `make deploy` is a no-op.
- **Releases** are manual: `release.yml` or `/release-fpp`. Never edit `CHANGELOG.md` by hand. Branch protection, workflows, Vercel and release rules: `docs/shipping.md`.
