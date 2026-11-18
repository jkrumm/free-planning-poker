# CI on GitHub-hosted runners for a Bun monorepo

Research run of 2026-11-18 (`agw research`, depth deep). Run status: ok. Citations grounded against fetched pages: 36/36. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line
- **Versions.** Current majors as of 18 Nov 2026: actions/checkout v7 (7.0.1, released 20 Jul 2026), actions/cache v6 (6.1.0, 26 Jun 2026), oven-sh/setup-bun v2 (2.2.0, 14 Mar 2026), docker/build-push-action v7 (7.4.0, 15 Sep 2026), dorny/paths-filter v4 (4.0.3, 5 Aug 2026), and @playwright/test 1.65.1 on npm. setup-bun caches only the Bun executable, not Bun's package cache.
- **Bun cache vs node_modules.** Do not restore node_modules. Bun's own benchmark gives 210 ms for a frozen install with a warm cache and 951 ms with no cache, for a 220-package Next.js app. The cache saves under a second there, and a cache restore costs more than that. Measure on this repo before adding any restore step.
- **Runners.** Public repositories get standard Linux x64 and arm64 runners with 4 vCPU, 16 GB RAM and 14 GB SSD, free and unlimited. The Free plan allows 20 concurrent jobs.
- **Path selection.** Do not put a paths filter on the required workflow. Use one workflow with a change-detection job and a final gate job that always runs. A skipped job counts as success for the gate; a workflow skipped by its paths filter leaves the required check Pending.
- **Concurrency.** Group by PR number and cancel in progress for pull requests only.
- **Docker.** Build once per run and hand the image to the e2e job through GHCR (same-repo PRs) or a single-platform tar artifact (works for forks). Use the gha cache with mode=max and a per-image scope.
- **Playwright.** Run the e2e job in the official Playwright image, pinned to the same version as @playwright/test. This removes the browser cache and the install step. Check that the image tag exists before pinning.
- **Sharding.** Four shards with fullyParallel true, blob reports and one merge job.
- **Postgres.** A postgres:18 service per job, so each shard gets its own database.
- **Summaries.** Write to GITHUB_STEP_SUMMARY. Use the Playwright github reporter only in the merge job.
- **Nightly.** Cron at a minute other than :00. Treat it as best-effort. Public repositories have scheduled workflows auto-disabled after 60 days with no activity.
- **Expected cost.** About 10 to 11 minutes wall-clock and about 28 runner-minutes per same-repo PR. About 4 minutes and 7 runner-minutes for a fork PR, which skips e2e. Runner minutes are free on a public repo, so the real constraints are wall-clock time and the 20-job concurrency cap.

## 1. Current versions
- **actions/checkout v7.0.1** (20 Jul 2026). Its release notes list an unsafe-PR check skip, a branch-name whitespace fix and a dependency update. The GitHub docs examples still show @v6, so the docs lag the release.
- **actions/cache v6.1.0** (26 Jun 2026). The README says v5 runs on Node 24 and needs Actions Runner 2.327.1 or later, which hosted runners already have. A secondary source describes v6 as an ESM migration with the same inputs.
- **oven-sh/setup-bun v2.2.0** (14 Mar 2026), MIT. Without a version input it reads the packageManager field in package.json, then engines.bun, then falls back to latest. Pin with packageManager set to bun with an exact version. The no-cache input (default false) is described as 'Disable caching of the downloaded executable'. The cache-hit output refers to that executable.
- **docker/build-push-action v7.4.0** (15 Sep 2026), Apache-2.0. Build summaries and a build-record artifact are on by default. If you run download-artifact without a pattern, exclude the record with pattern '!*.dockerbuild', or the step fails.
- **dorny/paths-filter v4.0.3** (5 Aug 2026), MIT. On pull_request events it reads changed files from the REST API and needs pull-requests: read. On push events it uses git, so a checkout is needed. Its README warns that filenames in the outputs can be attacker-influenced, so pass them through env and do not interpolate them into run scripts.
- **@playwright/test 1.65.1** on npm. The Playwright Docker docs page shows the image tag v1.64.1-noble, so the docs lag the npm release. The docs say a version mismatch between image and project means Playwright cannot find the browser executables.
- **PostgreSQL 18** was released 25 Sep 2025. The PostgreSQL news page lists a 18.7 minor release dated 12 Nov 2026.
- Licences of Playwright, Bun and PostgreSQL were not checked in this run.

## 2. Caching
**setup-bun** caches the Bun binary, per its README. It does not cache Bun's package store. Treat that as the answer, and cache the package store separately if you decide to.

**Bun's cache.** Bun stores downloads in ~/.bun/install/cache, or in BUN_INSTALL_CACHE_DIR. Before installing, Bun checks whether node_modules already holds every expected package at the right version, and if so the install completes. Bun does not enable --frozen-lockfile in CI automatically; pass the flag or use bun ci. A complete restored cache allows --offline --frozen-lockfile for a network-free install.

**Frozen install with a warm cache vs restored node_modules.** Bun's benchmark page (vendor-run, Linux x64, medians of 3) reports:

| Scenario (T3 Next.js app, ~220 packages) | bun | npm | pnpm | yarn |
|---|---|---|---|---|
| CI without a cache | 951 ms | 4.92 s | 11.69 s | 17.61 s |
| CI with a warm cache, node_modules rebuilt | 210 ms | 4.45 s | 1.92 s | 1.76 s |
| node_modules present, cache cleared | 12 ms | 384 ms | 399 ms | 212 ms |

Restoring node_modules would reach the same end state as the warm-cache install, and it would cost an archive restore of many small files. I found no primary measurement of node_modules restores, so this is an inference. The evidence does not favour a node_modules cache. For a larger lockfile the cold install grows, and that is the one case where a cache could pay. Measure it.

**GitHub cache rules** that affect every cache here: entries not accessed for over 7 days are removed; the limit is 10 GB per repository with least-recently-accessed eviction; uploads are capped at 200 per minute and downloads at 1500 per minute. Scoping: a pull_request run can restore caches from its own merge ref, the base branch and the default branch, but caches it writes are scoped to refs/pull/N/merge. Only push, schedule, workflow_dispatch and a few other triggers write to the default-branch scope. So caches that PRs read must be written by pushes to main. The Docker gha cache shares the same 10 GB pool.

## 3. Hosted runner specs and limits (public repositories)
Standard runners for public repositories are free and unlimited. Each job runs on a fresh VM, except ubuntu-slim.

| Label | vCPU | RAM | SSD | Arch |
|---|---|---|---|---|
| ubuntu-latest, ubuntu-24.04, ubuntu-26.04 | 4 | 16 GB | 14 GB | x64 |
| ubuntu-24.04-arm, ubuntu-26.04-arm | 4 | 16 GB | 14 GB | arm64 |
| ubuntu-slim (container, unprivileged) | 1 | 5 GB | 14 GB | x64 |
| macos-latest (M1) | 3 | 7 GB | 14 GB | arm64 |

Private-repo Linux runners are 2 vCPU and 8 GB, so public visibility doubles the hardware and removes billing. The docs note that -latest images may not be the newest OS release, so pin ubuntu-24.04 for reproducibility.

Limits to design around: Free-plan concurrency is 20 total jobs (Pro 40, Team 60, macOS 5 across plans). A job runs at most 6 hours. A matrix can create at most 256 jobs. A workflow file must be under 500 KB. A concurrency queue holds at most 100 runs. ubuntu-slim has a 15-minute job timeout.

## 4. Path-based job selection
Three ways to select jobs:

1. **Workflow-level paths filter.** The whole workflow does not start, so a required check from it stays 'Pending' and blocks merging. GitHub's example shows exactly this failure. Also, path filtering evaluates at most the first 3,000 changed files.
2. **dorny/paths-filter** at job level. It produces outputs that downstream jobs read in if conditions. It is a third-party Node action, but it is a standard choice (3.4k stars, MIT).
3. **A shell script** running git diff against the base branch. This produces the same outputs with no third-party action. It needs fetch-depth 0 on push events. This is my reasoning, not something a source in this run verified.

The decisive design point is the gate, not the selector. GitHub's troubleshooting doc says a job skipped by a conditional reports Success, and successful statuses are success, skipped and neutral. A job that depends on a failed job is itself skipped and may not block merging, so a required gate needs always() or !cancelled(). The same doc says always() also runs on cancellation, so the gate must still fail on a cancelled dependency. A required check must also have completed successfully within the past seven days.

Recommendation: option 2, plus one final job named ci that is the only required check. The gate fails if any needed job failed or was cancelled.

## 5. Concurrency
- The default queue is 'single': one pending run per group, and a newer pending run replaces an older one. cancel-in-progress: true also cancels the running job.
- queue: max keeps up to 100 pending runs, but cannot be combined with cancel-in-progress.
- Group names are case-insensitive.
- The docs' pattern is a group keyed on the ref, with cancel-in-progress as an expression. Scope the group to the workflow name so other workflows are not cancelled.
- GitHub's troubleshooting doc warns that a stuck run in a concurrency group can block later runs until GitHub Support clears it.

Recommended group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}, with cancel-in-progress set to true only for pull_request events. Pushes to main are not cancelled, but a pending push run is replaced by a newer one.

## 6. Docker: layer caching and passing the image
**Passing the image between jobs.** Each GitHub-hosted job is isolated, so a built image cannot be reused across jobs except through an artifact or a registry. Docker's guide shows the artifact route: build with outputs type=docker,dest=<tar>, upload the tar with upload-artifact, download it, then docker load. That route is single-platform only. Multi-platform images must be pushed to a registry. A registry push from a fork PR will not work, because forks get a read-only token (standard GitHub behaviour; not re-verified here).

**gha cache backend** with docker/build-push-action: cache-from type=gha and cache-to type=gha,mode=max. The action fills in the cache URL and token automatically. Docker's docs warn about GitHub cache API throttling during export ('maximum timeout reached'), fixed by a ghtoken, which the action sets from GITHUB_TOKEN by default. Use a scope per image, because the default scope 'buildkit' is overwritten by every build. Docker's default mode is min. Max exports more layers, so it costs more cache space in the shared 10 GB pool.

## 7. Playwright browsers: cache or official image
**Official image.** mcr.microsoft.com/playwright:v1.64.1-noble is the tag the docs show. It contains the browsers and their OS dependencies. Pin the tag to the project's @playwright/test version. Playwright recommends --ipc=host and --init. The image runs as root by default, which disables the Chromium sandbox, and the docs accept that for trusted end-to-end tests. Ubuntu 26.04 tags also exist.

**Browser cache.** Caching ~/.cache/ms-playwright works for the binaries, but the system libraries live outside that path. So --with-deps (or an install-deps step) still runs every time, which is the slow part. A 2023 Playwright issue reported 3.5 minutes for install --with-deps; that is one user's report.

**Verdict.** The official image wins for the e2e job. You skip both the browser cache and the install, and you pay only the image pull, which I did not measure. The cost is that the app must run as a service from a registry, because service containers pull images and cannot load tar files. Only same-repo PRs can push to GHCR, so fork PRs need a different path.

## 8. Sharding with blob reports
Playwright shards with --shard=x/y. fullyParallel: true balances at the test level; without it, balancing is per file and uneven files skew the shards. Statically skipped tests are not counted. On CI, use the blob reporter, then npx playwright merge-reports --reporter html ./all-blob-reports in one job with needs and if: !cancelled(). The merge can also produce a github reporter output. Playwright's example uses matrix shardIndex and shardTotal, fail-fast: false, and retention-days 1 for blobs.

Two public PRs give a sense of scale. LibreChat (PR 17019) reported a required Playwright job at p50 25.1 minutes on 2026-10-12, up from 10.3 minutes on 2026-09-28 after shards were widened to six. agent-deck (PR 3153) reported a Playwright job median of 612 s and p90 of 670 s over its last 40 runs before moving to four shards. Both are PR descriptions, not measured benchmarks.

## 9. Postgres 18 service
GitHub's guide uses the image postgres with POSTGRES_PASSWORD and health-check options (pg_isready, interval 10 s, timeout 5 s, 5 retries). Service containers need a Linux runner. In a container job, services are reachable by their label as hostnames, so the app can reach the database at postgres:5432 with no port mapping. Use postgres:18. I did not check the Docker Hub tag. Each job gets its own service, so each shard has its own database. Within one job, tests still need per-worker isolation (my advice, not from a source).

## 10. Job summaries and annotations
- GITHUB_STEP_SUMMARY accepts GitHub-flavoured Markdown. Each step's summary is grouped into one job summary when the job finishes. The per-step size limit was not checked here.
- Playwright's github reporter produces annotations. Playwright says not to use it with a matrix, because stack traces multiply and clutter the file view. Use it only in the merge job, as in npx playwright merge-reports --reporter=html,github.
- The JUnit reporter writes XML (PLAYWRIGHT_JUNIT_OUTPUT_NAME). GitHub does not render JUnit natively, so showing it in the PR needs a third-party publisher action, which I did not evaluate.
- The html, json and junit reporters accept onlyFailures to shrink artifacts.

## 11. Nightly schedules
GitHub's troubleshooting doc says scheduled events can be delayed under high load. High load includes the start of every hour, and if the load is high enough some queued jobs may be dropped. Pick a minute other than :00. A schedule runs only from the default branch. Public repositories auto-disable scheduled workflows after 60 days with no repository activity, and forks have schedules disabled by default. Whether a scheduled run counts as activity is not stated. A GitHub discussion reports hourly schedules firing 5 to 6 times a day. That is an anecdote.

Recommendation: nightly.yml with cron '23 4 * * *', plus workflow_dispatch. Use the nightly run for the full browser matrix, multi-platform image builds (a registry push, since the tar route is single-platform), and an arm64 build on ubuntu-24.04-arm, which is free.

## 12. Wall-clock evidence
Published numbers are sparse. The two PR data points above are the only per-PR timings I found. The rest is my estimate, not measured on this repo.

## 13. Recommended layout
Two files: .github/workflows/ci.yml for PRs and main, and nightly.yml. The shape of ci.yml:

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
jobs:
  changes:
    runs-on: ubuntu-24.04
    permissions:
      contents: read
      pull-requests: read
    outputs:
      code: ${{ steps.filter.outputs.code }}
      e2e: ${{ steps.filter.outputs.e2e }}
    steps:
      - uses: actions/checkout@v7
      - id: filter
        uses: dorny/paths-filter@v4
        with:
          filters: |
            code:
              - 'apps/**'
              - 'packages/**'
              - 'bun.lock'
              - 'package.json'
            e2e:
              - 'apps/**'
              - 'packages/**'
              - 'e2e/**'
              - 'bun.lock'
              - 'Dockerfile'
  verify:
    needs: changes
    if: needs.changes.outputs.code == 'true'
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run lint && bun run typecheck && bun run test && bun run build
  image:
    needs: changes
    if: needs.changes.outputs.e2e == 'true'
    runs-on: ubuntu-24.04
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v7
      - uses: docker/setup-buildx-action@v4
      - uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v7
        with:
          context: .
          tags: ghcr.io/OWNER/app:sha-${{ github.sha }}
          push: ${{ github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository }}
          cache-from: type=gha,scope=app
          cache-to: type=gha,mode=max,scope=app
  e2e:
    needs: [changes, image]
    if: ${{ needs.changes.outputs.e2e == 'true' && (github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository) }}
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    container:
      image: mcr.microsoft.com/playwright:v1.65.1-noble
      options: --ipc=host --init
    services:
      postgres:
        image: postgres:18
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      app:
        image: ghcr.io/owner/app:sha-${{ github.sha }}
        env:
          DATABASE_URL: postgres://postgres:postgres@postgres:5432/app
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: npx playwright test --shard=${{ matrix.shard }}/4
        env:
          BASE_URL: http://app:3000
      - uses: actions/upload-artifact@v5
        if: ${{ !cancelled() }}
        with:
          name: blob-report-${{ matrix.shard }}
          path: blob-report
          retention-days: 1
  e2e-report:
    needs: e2e
    if: ${{ !cancelled() && needs.e2e.result != 'skipped' }}
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - uses: actions/download-artifact@v5
        with:
          pattern: blob-report-*
          path: all-blob-reports
          merge-multiple: true
      - run: npx playwright merge-reports --reporter=html,github ./all-blob-reports
      - uses: actions/upload-artifact@v5
        with:
          name: playwright-report
          path: playwright-report
          retention-days: 7
  ci:
    needs: [changes, verify, image, e2e, e2e-report]
    if: ${{ always() }}
    runs-on: ubuntu-slim
    steps:
      - run: |
          if [ '${{ contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') }}' = 'true' ]; then exit 1; fi
```

Notes on the file. The image and app references need a lowercase owner and repo, because GHCR requires lowercase names. Whether the services image field accepts an expression is not verified. The e2e job assumes setup-bun and npx work inside the Playwright container; this is not verified. Only same-repo PRs get the e2e job, so fork PRs pass the gate with e2e skipped. The maintainer covers fork PRs with a manual run or the nightly.

## 14. Expected minutes per PR (estimate)
| Job | Wall-clock | Runner-minutes |
|---|---|---|
| changes | 0.3 | 0.3 |
| verify (lint, typecheck, unit, build) | 3 | 3 |
| image (warm gha cache; 8 to 10 min cold) | 3 | 3 |
| e2e, 4 shards (image pull, install, tests) | 5 | 20 |
| e2e-report | 1 | 1 |
| ci gate on ubuntu-slim | 0.2 | 0.2 |
| Same-repo PR, total | about 10 to 11 | about 28 |
| Fork PR, e2e skipped | about 4 | about 7 |

Peak concurrency is six jobs (verify, image and four shards), so the Free plan's 20-job cap allows about three PRs at full fan-out at once.

## 15. Tradeoffs
- **Playwright image vs cache.** The image is simpler and faster to start, but it adds a large pull, and it forces the app into a registry. The cache keeps the app on the host, but still needs --with-deps each run.
- **GHCR vs tar artifact.** GHCR gives multi-platform builds and one shared image reference. The tar works for forks and needs no registry permissions, but it is single-platform and a large artifact upload.
- **Shared 10 GB cache.** The Docker cache and any other caches evict each other after the limit or 7 days unused. The gha scope per image keeps the Docker caches apart, but not from the rest.
- **Public repo.** Free and unlimited runners, but the repo's code, workflow logs and artifacts are public. Keep secrets out of the e2e path and of any artifact.
- **dorny vs a script.** dorny needs a third-party action and API calls. A script is more code but has no dependency on a third party.
- **Sharding granularity.** Four shards is the right order of magnitude for a suite of this size, but the balance depends on fullyParallel and on test duration data that does not exist yet.
- **Bun test runner.** Bun's test runner may pick up Playwright spec files. Check the default file patterns before naming tests, because this was not verified here.

## 16. Decide now (cannot be retrofitted)
1. **Public repository from day one.** Free unlimited runners, including arm64, depend on it.
2. **bun.lock committed, and packageManager pinned** in the root package.json, so setup-bun and --frozen-lockfile agree.
3. **One Dockerfile at the root**, one image, and one app process serving both the SPA and the WebSocket server. This matches the planned Elysia server, and it makes the e2e target a single image.
4. **GHCR namespace and package visibility**, because image references are written into workflows.
5. **A stable required-check name** (ci). Renaming a required check leaves merges blocked.
6. **Test isolation rules**: no test depends on another test's rows, and each worker owns its data. Sharding and parallelism depend on it, and it is hard to add later.
7. **Playwright fullyParallel: true** and small spec files from the first test.
8. **A health endpoint on the app** for service readiness, and an app that starts with only DATABASE_URL set.
9. **Pin the Playwright version** in both package.json and the image tag, and bump them together.
10. **Which tests run on PRs and which nightly**, expressed as tags or projects in the Playwright config.

## 17. Open points
Several items stayed unverified: the official image tag for 1.65.1, the postgres:18 tag, the per-step summary size limit, the services expression support, the behaviour of setup-bun inside a container job, the fork-PR token behaviour, the 60-day rule's treatment of scheduled runs, licences other than setup-bun, build-push-action, dorny and checkout, the image pull time, the cost of restoring node_modules, the dorny-vs-script comparison, JUnit publishing, the artifact storage limit that applies to public repos, and whether Bun's test runner picks up Playwright specs. The wall-clock figures are estimates, not measurements.

## Not verified in this run

- Playwright image tag v1.65.1-noble exists (docs page shows v1.64.1): The Docker docs show v1.64.1 while npm shows 1.65.1; the MCR tag list was not read, so the tag must be checked before pinning.
- postgres:18 Docker Hub tag: The Postgres 18 release is verified, but the Docker Hub tag name was not checked.
- Expressions in a services image field (for a SHA-tagged app image): The service guide shows a static image name; expression support was not verified.
- setup-bun and npx run inside the Playwright container job: Not tested or documented in the sources read; the container image's Node and Bun availability is assumed.
- Fork PRs receive a read-only token and cannot push images to GHCR: Standard GitHub behaviour, not re-verified in this run; the design depends on it.
- Per-step size limit for GITHUB_STEP_SUMMARY: The page was only partly read; the size limit was not found in the fetched text.
- Whether a scheduled run counts as repository activity for the 60-day auto-disable rule: The docs state the rule but do not say whether scheduled runs reset the 60-day count.
- Licences of Playwright, Bun and PostgreSQL: Not checked in this run; only setup-bun, build-push-action and dorny/paths-filter READMEs were read for licence (MIT or Apache-2.0).
- Image pull time and size of the Playwright official image: Not measured or sourced; the wall-clock estimate assumes a pull of tens of seconds.
- Cost of restoring node_modules versus a Bun install cache restore: Only Bun's vendor benchmark was found; no primary measurement of a node_modules cache restore.
- dorny/paths-filter versus a git-diff script: No head-to-head source; the script option is my reasoning.
- Publishing JUnit results in the PR UI: Needs a third-party publisher action, not evaluated.
- Artifact storage limit (500 MB on Free) for public repos: The plan table lists 500 MB for GitHub Free; whether it applies to public repos was not confirmed.
- Bun test runner picking up Playwright *.spec.ts files: Plausible collision not checked against Bun's default test-file patterns.
- Typical wall-clock and minutes per PR for this pipeline: Only two PR data points exist; the 10 to 11 minute and 28 runner-minute figures are my estimates.
- Frequency of dropped nightly schedules: GitHub says runs can be dropped under load but publishes no rate; the discussion figure is anecdotal.

## Sources

- https://github.com/oven-sh/setup-bun
- https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- https://docs.github.com/en/actions/reference/limits
- https://github.com/actions/checkout/releases/tag/v7.0.1
- https://github.com/actions/cache/releases/tag/v6.1.0
- https://github.com/oven-sh/setup-bun/releases/tag/v2.2.0
- https://github.com/docker/build-push-action/releases/tag/v7.4.0
- https://github.com/dorny/paths-filter/releases/tag/v4.0.3
- https://www.npmjs.com/package/@playwright/test
- https://bun.com/docs/pm/cli/install
- https://bun.com/docs/pm/global-cache
- https://bun.com/package-manager
- https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching
- https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks
- https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency
- https://playwright.dev/docs/test-sharding
- https://playwright.dev/docs/ci-intro
- https://playwright.dev/docs/test-reporters
- https://playwright.dev/docs/docker
- https://docs.docker.com/build/cache/backends/gha/
- https://docs.docker.com/build/ci/github-actions/share-image-jobs/
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- https://docs.github.com/en/actions/how-tos/troubleshoot-workflows
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows
- https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands
- https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers
- https://www.postgresql.org/about/news/postgresql-18-released-3142/
- https://raw.githubusercontent.com/actions/cache/main/README.md
- https://latchkey.dev/learn/speed/github-actions-caching-explained
- https://github.com/orgs/community/discussions/210932
- https://github.com/microsoft/playwright/issues/23388
- https://www.warpbuild.com/answers/how-do-i-cache-playwright-browsers-in-github-actions
- https://github.com/LibreChat-AI/LibreChat/pull/17019
- https://github.com/asheshgoplani/agent-deck/pull/3153
- https://docs.github.com/en/enterprise-server@3.19/actions/reference/workflows-and-actions/workflow-commands
- https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks
- https://github.com/dorny/paths-filter
- https://github.com/docker/build-push-action
