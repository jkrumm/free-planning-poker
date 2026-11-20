# Freezing v1 on a maintenance branch

Research run of 2026-11-20 (`agw research`, depth standard). Run status: ok. Citations grounded against fetched pages: 14/14. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line

- **Vercel:** Branch-level deployment rules are documented: `git.deploymentEnabled` defaults to `true` for every branch not listed, and a single `false` turns off all automatic deployments. Switching the Production Branch, what a missing Root Directory does, and whether a production deployment stays served on Hobby were not verified in this run and need a test.
- **GitHub Actions:** The events reference says several event types run only if the workflow file exists on the default branch. The page I read was cut off before `push`, `schedule` and `workflow_dispatch`, so their behaviour for a maintenance-only workflow is unverified.
- **Required checks:** Not researched. Unverified.
- **Self-hosted runners:** GitHub recommends self-hosted runners only with private repositories, because fork pull requests can run code on the runner. For this public repository the answer is: do not use them, or restrict them to default-branch pushes, schedules and dispatches behind an approval gate.
- **Bun 1.3:** Isolated installs became the default for new workspaces only; Bun 1.3.2 restored hoisted installs for existing workspaces. Catalogs exist. One-lockfile and two-major-version behaviour was not verified.
- **Dependabot:** The `target-branch` option exists, and it changes how security pull requests are created. Renovate was not researched.

## 1. Vercel

**Verified**

- `git.deploymentEnabled` defaults to `true`, and any branch not listed deploys. The object form maps branch patterns (minimatch syntax) to booleans. Setting the whole value to `false` disables automatic deployments for all branches.
- When a branch matches several rules and at least one is `true`, a deployment happens. The documented example is `experiment-my-branch-dev`, which matches `experiment-*: false` and `*-dev: true` and therefore deploys.
- Setting this in a repo file is documented as `vercel.json` or `vercel.ts`. The docs match on the branch identifier. They do not say which copy of `vercel.json` (the pushed commit's or the production branch's) is read. That needs a test: push a branch that changes the file and watch the result.
- A rule set for the freeze, derived from the matching rules above and not tested: `{"git":{"deploymentEnabled":{"*":false,"v1":true}}}`. Use `**` instead of `*` if the maintenance branch name contains a slash. The `v1` rule overrides the wildcard, so only v1 deploys. This is the project-wide 'disable preview deployments' equivalent for every other branch.
- Ignored Build Step: a Vercel knowledge-base article says a return code of `0` skips the build, so a failing or missing-path step can change outcomes.

**Unverified (test before relying on it)**

- Changing the Production Branch to a non-default branch via dashboard, REST API or CLI: the mechanics and any side effects on the existing production alias were not read.
- A commit where the project Root Directory no longer exists: whether the deployment fails, is skipped, and whether the Ignored Build Step runs. Test with a throwaway branch that deletes the directory and record the deployment state.
- Whether a production deployment stays served indefinitely on Hobby when no new deployment is created. Not verified.

## 2. GitHub Actions

**Verified**

- The events reference lists `branch_protection_rule`, `check_run`, `check_suite`, `delete`, `discussion`, `fork`, `issue_comment`, `issues`, `label` and `repository_dispatch` with the note 'This event will only trigger a workflow run if the workflow file exists on the default branch.'

**Unverified**

- A `push` workflow that exists only on the maintenance branch: the page I read ended before `push`. Expected to run because the push's own commit contains the file, but this must be tested.
- `workflow_dispatch` for a workflow that exists only on a non-default branch: not read. Test by dispatching with the ref set to the maintenance branch.
- `schedule`: not read. My expectation, from prior knowledge and not verified here, is that scheduled workflows run from the default branch only, so a cron in a maintenance-only file would never fire. Confirm in the 'Events that trigger workflows' page's `schedule` section before relying on it.

## 3. Branch protection and rulesets

Not researched in this run. Unverified. Reasoning only: required status checks are matched by check name, so a required check that no longer reports on a branch can block merges there. Scope rulesets to a branch pattern per branch so the default branch's required checks do not gate the maintenance branch. Confirm before implementing.

## 4. Self-hosted runners on a public repository

**Current guidance (GitHub)**

- 'We recommend that you only use self-hosted runners with private repositories. This is because forks of your public repository can potentially run dangerous code on your self-hosted runner machine by creating a pull request that executes the code in a workflow.' This is in the current 'Adding self-hosted runners' page.
- GitHub-hosted runners are a clean VM per job and are destroyed afterwards. Self-hosted runners do not need a clean instance per job and can persist state. This is stated in an older GitHub Enterprise Server 2.22 page (discontinued), so treat it as the general principle, not as a current product page.
- `pull_request_target` and `workflow_run`, when combined with checking out untrusted pull request code, are privileged and can expose the repository. Avoid them unless needed. For privilege separation, `workflow_run` is preferred over `pull_request_target`. Source: GitHub's 'Secure use reference'.
- Environments with required reviewers: 'A workflow job cannot access environment secrets until approval is granted by a reviewer.' Source: same page.
- Runner groups: organisation policies can limit which repositories may use a self-hosted runner. This is the access-control mechanism, though it does not apply to a personal public repository the way an org does.

**Safe patterns (recommendation; ephemeral runners not verified)**

- Allow self-hosted jobs only on `push` to the default branch, `schedule` and `workflow_dispatch`. Do not allow `pull_request` or `pull_request_target`.
- Put self-hosted jobs behind a GitHub environment with required reviewers.
- Use ephemeral runners (one job, then discarded). This is standard practice but its GitHub configuration was not read.
- For this project, the simplest safe option is no self-hosted runners on the public repo: deploy from GitHub-hosted runners to the VPS over SSH, or pull from the VPS.

## 5. Bun workspaces

**Verified**

- Bun 1.3 (released 10 October 2025) added 'Isolated installs, catalogs, minimumRelease, and more for workspaces'.
- Bun 1.3.0 made isolated installs the default for workspaces. Bun 1.3.2 (8 November 2025) changed that: isolated is now the default only for new projects. Existing workspaces keep hoisted installs unless set explicitly, with `linker = "isolated"` in `bunfig.toml` or `bun install --linker=isolated`.
- `bun install` writes a `configVersion` to `bun.lock`. New projects get `configVersion` 1, where workspaces use the isolated linker by default. An existing lockfile with no version gets `configVersion` 0, which keeps hoisted. Migrating from pnpm yields 1; from npm or yarn yields 0.
- Newer: Bun v1.3.13 (20 April 2026) release notes mention 'Faster bun install with isolated linker' in a peer-heavy monorepo (search snippet, medium confidence).
- Catalogs: a Bun pull request (#29664, 24 April 2026) fixes hoisting of `catalog:` peer dependencies, a sign that catalog edge cases were still being fixed in 2026. Use `catalog:` in `package.json` and check the current docs for exact syntax.

**Unverified**

- One `bun.lock` for all workspaces: expected from the single-lockfile model, not read directly. Confirm.
- Two major versions of one package in different workspaces: under isolated linker each workspace should get its own copy; under hoisted the root copy may be shared. Test with two majors across two workspaces and inspect `node_modules` under both linkers.

## 6. Dependabot and Renovate on a maintenance branch

**Verified (Dependabot)**

- `dependabot.yml` has a `target-branch` option. Options marked as affecting security pull requests do so, 'except where target-branch is used'. `assignees` and `commit-message` apply only 'unless target-branch defines updates to a non-default branch'. Security updates to a non-default branch therefore behave differently from the default branch.

**Unverified**

- Renovate: not researched (its `baseBranches` setting is the likely mechanism, but not verified).
- Whether to keep updates on the frozen branch at all: a decision, not a sourced fact. A frozen branch that still gets updates is no longer frozen.

## Recommendation

Freeze v1 at the Vercel and Actions layer, not by relying on branch naming. Use the `v1` branch as Vercel's Production Branch. Restrict Vercel automatic deployments to `v1` with the rule above. Keep the rewrite's CI on the default branch and PR branches, and move any v1-only workflow onto the `v1` branch. Run the untested items above in a throwaway branch before the cutover.

The rewrite is served from the VPS and Cloudflare, not Vercel, so Vercel only needs to keep serving v1.

## Main tradeoffs

- Same repo (keeps history, shared issues, one place for the project) versus a separate frozen repo (no shared default branch, workflows or required checks, at the cost of moving history and links).
- Branch-level Vercel rules (one repo, subtle rule matching) versus a separate Vercel project (cleaner, more setup).
- Dependabot on the frozen branch (security fixes, more noise) versus off (frozen, but unpatched).

## Must decide now (cannot be retrofitted)

- Whether v1 lives in this repo or a separate one. Moving later changes Git connections, history and URLs.
- URL scheme: keep `/room/<slug>` stable, and decide whether v1 URLs redirect.
- A protocol version field in the first Zod frame, so a v2 server can reject v1 clients clearly. This is an engineering recommendation, not a sourced claim.
- Stable check and job names, since required checks match by name.
- Committed `bun.lock` with `configVersion` 1 and the isolated linker pinned in `bunfig.toml` from day one.
- Runner policy: no self-hosted runners on the public repo.
- Whether v1 receives dependency updates at all.

## Read afterwards

Three of the open items were read directly in the vendors' documentation on 2026-11-20.

- **GitHub Actions, `push`:** "Runs your workflow when you push a commit or tag […]. This includes workflows that are not merged into the default branch." A workflow that exists only on the maintenance branch therefore runs on pushes to it.
- **GitHub Actions, `workflow_dispatch` and `schedule`:** "This event will only trigger a workflow run if the workflow file exists on the default branch." A frozen branch's workflow cannot be dispatched by hand or run on a schedule once its file leaves the default branch.
- **Vercel, Production Branch:** changed under Environments, Production, Branch Tracking; "Whenever a new commit is then pushed to the branch you configured here, a production deployment will be created for you."
- **Vercel, `git.deploymentEnabled`:** a map of branch patterns (minimatch) to booleans; unlisted branches deploy; `false` for the whole key turns automatic deployments off. The page does not say which commit's `vercel.json` is read, and nothing read says what happens to a commit without the project's root directory. Both are tested by the row `v9-freeze-v1`.

## Not verified

- Vercel: changing Production Branch to a non-default branch (dashboard, REST API, CLI) and its effect on the current production alias: Not read; budget ended before the Vercel production-branch docs were fetched.
- Vercel: commit where the project Root Directory does not exist (failed, skipped, Ignored Build Step runs?): Only a search snippet on the Ignored Build Step was seen; the missing-root behaviour is not documented in anything read. Needs a throwaway-branch test.
- Vercel: whether the production deployment stays served indefinitely on Hobby with no new deployment: Not researched.
- Vercel: which copy of vercel.json (pushed commit or production branch) git.deploymentEnabled is read from: The page describes branch-name matching but does not say which file version is read. Needs a test push.
- GitHub Actions: push workflow that exists only on the maintenance branch: The events page was cut off before the push section.
- GitHub Actions: workflow_dispatch for a workflow that exists only on a non-default branch: The events page was cut off before the workflow_dispatch section; not read elsewhere.
- GitHub Actions: scheduled workflows run from the default branch only: The schedule section was not read; expectation is from prior knowledge, not a source.
- Branch protection and rulesets when the required status check set changes completely: Not researched in this run.
- Ephemeral self-hosted runners configuration: Not researched in this run.
- One bun.lock for all workspaces; two major versions of one package in different workspaces under each linker: The release notes cover linker defaults but not these cases; needs the Bun workspaces docs or a test install.
- Bun catalogs syntax and the status of the catalog peer-dependency hoisting fix: Only the pull request snippet was seen; the merged state and current catalog docs were not read.
- Renovate on a maintenance branch (baseBranches and related options): Not researched in this run.
- Current versions and release dates of Elysia 2 RC, Zod 4, Drizzle, React 19 and the other stack items: Out of the call budget for this question's scope.

## Sources

- https://domains.vercel.com/docs/project-configuration/git-configuration
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- https://docs.github.com/en/enterprise-server@2.22/actions/hosting-your-own-runners/about-self-hosted-runners
- https://docs.github.com/en/actions/reference/security/secure-use
- https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference
- https://bun.com/blog/bun-v1.3
- https://bun.sh/blog/release-notes/bun-v1.3.2
- https://changelog.vercel.com/kb/guide/why-aren-t-commits-triggering-deployments-on-vercel
- https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/adding-self-hosted-runners?learn=hosting_your_own_runners&learnProduct=actions
- https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/manage-access?learn=hosting_your_own_runners&learnProduct=Actions
- https://bun.sh/blog/release-notes/bun-v1.3.13
- https://github.com/oven-sh/bun/pull/29664
- https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference
