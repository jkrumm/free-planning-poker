# Testing strategy and CI

Research run of 2026-11-18 (`agw research`, depth deep). Run status: partial. Citations grounded against fetched pages: 38/54. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line

- **Premise correction.** The current major is Vitest 5, not 4: Vitest 5.0 shipped on 3 Sep 2026 and 5.1.1 is the latest release (17 Nov 2026). TypeScript 7.0 (the Go-native compiler, tsgo's successor) went GA on 8 Jul 2026. oxfmt is still pre-1.0. Lost Pixel is archived, so it should not be used.
- **Unit and logic tests:** bun test for server, protocol, shared and reducer code. Vitest 5 Browser Mode (real Chromium) for React components only.
- **Multi-user E2E:** Playwright 1.65.x, one browser context per simulated user, sharded with blob reports, traces on first retry. Runs on every PR.
- **Protocol:** a versioned schema package with checked-in message fixtures. Fixtures from the last deployed version must keep passing during rolling deploys.
- **Reducer:** keep it a pure function. Use fast-check 4.10 properties and a `fc.commands` model test. The privacy rule (no vote value visible before reveal) is the core property.
- **Deterministic simulation:** a seeded, single-threaded simulator of rooms with a fake network, run nightly over thousands of seeds. I found no mature TypeScript framework; this is a build-it-yourself item.
- **Load:** k6 v2.4.0 with the stable `k6/websockets` module, run nightly and before releases, not per PR. Artillery 2.0.34 (MPL-2.0) is the alternative.
- **Visual regression:** Playwright `toHaveScreenshot` in a pinned container, for about 10 to 20 key states.
- **Accessibility:** axe-core 4.14.1 inside the E2E flows and per component.
- **Budgets:** Lighthouse CI 0.16.1 (runs Lighthouse 13.6) on the room SPA, plus size-limit 14.3.0 on JavaScript per route.
- **Tooling:** oxlint 1.94 with type-aware linting (tsgolint v7, stable). oxfmt 0.79, pinned exactly because it is beta. TypeScript 7.0.2 for `tsc`, with a TypeScript 6 alias where typescript-eslint still needs the old API.
- **CI:** Turborepo 2.11 `--affected` with full git history. The merge queue is not available on a personal-account repo, so the repo must move into an organization first. Marketing-page previews use `wrangler versions upload`.
- **Time targets (my estimates, to be measured):** fast local tier at most 60 s on pre-push, affected packages only. Full PR gate about 10 to 12 min critical path.

## Versions, dates and maturity (as of 18 Nov 2026)

| Tool | Current version | Release date | Maturity and note |
|---|---|---|---|
| Vitest | 5.1.1 | 5.0 on 3 Sep 2026; 5.1.1 on 17 Nov 2026 | Stable major. Needs Vite >= 6.4.0 and Node >= 22.12.0 |
| Playwright (@playwright/test) | 1.65.1 | not read | Stable |
| Bun | 1.4.4 (npm) | not read | Runtime and built-in test runner |
| Elysia | 1.4.32 (npm) | not read | Stable 1.x line |
| fast-check | 4.10.3 | not read | Stable |
| k6 | v2.4.0 | 12 Nov 2026 | Stable. `k6/websockets` is the stable import |
| Artillery | 2.0.34 | npm page dated 14 Aug 2026 | Stable. Licence MPL-2.0 |
| Lighthouse CI (@lhci/cli) | 0.16.1 | 11 Nov 2026 | Maintained. Runs Lighthouse 13.6 |
| Lighthouse | 13.6.0 | Lighthouse 13.6 upgrade merged into LHCI 16 Oct 2026 | Current npm release |
| size-limit | 14.3.0 | not read | Stable |
| axe-core | 4.14.1 | not read | Stable |
| Lost Pixel | archived | repo archived 22 Apr 2026 | Do not adopt. Project is sunsetting and joining Figma |
| TypeScript | 7.0.2 (npm `typescript`) | 7.0 GA on 8 Jul 2026 | Native Go port. No compiler API until 7.1 |
| @typescript/native-preview | 7.0.0-dev nightly | nightly channel | Use `typescript` 7.0.2 instead |
| oxlint | 1.94.0 | not read | Type-aware linting via tsgolint v7, stable since 22 Jul 2026 |
| oxfmt | 0.79.0 | beta announced 24 Feb 2026 | Pre-1.0 |
| Turborepo | 2.11.12 | not read | Stable |

Licences marked from memory (not read in this run): Vitest MIT, Playwright Apache-2.0, fast-check MIT, k6 AGPL-3.0, axe-core MPL-2.0, LHCI Apache-2.0, size-limit MIT, Turborepo MIT, Bun MIT, Elysia MIT, TypeScript Apache-2.0, oxc tools MIT. Artillery MPL-2.0 and Lost Pixel MIT were read.

## 1. Unit and component tests: bun test versus Vitest 5 Browser Mode

**bun test (Bun 1.4.4)** covers the server, the reducer, protocol codecs and fast-check properties. The docs I read cover `--concurrent` (tests run in parallel within a file unless marked `test.serial`), `--coverage`, JUnit output via `--reporter=junit --reporter-outfile`, and `mock.module`. I did not find a browser-rendering mode in those docs.

Keep server code on bun test. Vitest runs on Node, so Bun-only APIs such as `Bun.serve` or `bun:sqlite` would need shims there. That is my reasoning, not a sourced fact.

**Vitest 5.0 (3 Sep 2026)** is the React side. Browser Mode runs components in real Chromium. The 5.0 post adds:
- a built-in Trace View for Browser Mode (`browser.traceView`), with DOM snapshots per step
- `vi.when` for per-argument mock behaviour
- `clearMocks` on by default, a breaking change to check when migrating
- un-awaited `expect` assertions now fail the test
- `--repeats`, useful for hunting flakes
- a stable `fsModuleCache`

Benchmarks in the post (Apple M4, Node 24, whole-process median of 3, Vitest 4.1 to 5.0): react-spa with 92 modules in Browser Mode with Chromium went from 2.40 s to 2.01 s. The same app with vmThreads and jsdom went from 1.25 s to 1.07 s. A design-system app with 80 components went from 2.09 s to 1.72 s on vmThreads and jsdom.

**Recommendation.** Use bun test for logic and Vitest 5 Browser Mode for components that depend on layout, focus, pointer input or axe checks. Use jsdom only for pure hooks. The cost is two runners and two configs. The alternative is Vitest for everything, which forces server code to run under Node. I would not take that route.

## 2. Multi-user E2E with Playwright (rooms of 2 to 30)

**Fixtures.** Write a `users(n)` fixture that opens n browser contexts. Each context is one anonymous user, with its own localStorage client id set by an init script. Contexts share nothing, so one browser can act as a whole room. Each test creates its own room id, so no test depends on another test's room. The Playwright Python docs show the same `new_context` pattern for isolated sessions.

**Flake control.**
- Retries are set to 2 in CI and 0 locally (the Playwright docs example uses `retries: process.env.CI ? 2 : 0`).
- Traces use `trace: 'on-first-retry'`. The TestOptions docs also list `retain-on-failure` and `retain-on-failure-and-retries`.
- Use `testInfo.retry` in fixtures to reset server state on a retry.
- Expose a room-reset endpoint only when the server runs with a test-only environment flag. This is my design, not sourced.
- Assert on UI state with web-first assertions, not sleeps.

**Sharding.** The Playwright docs give a CI pattern:
1. Set `reporter: process.env.CI ? 'blob' : 'html'`.
2. Run a matrix of shards with `npx playwright test --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}`, using 4 shards in the docs example.
3. Upload each `blob-report-N` with 1-day retention.
4. Run a merge job with `if: ${{ !cancelled() }}` that executes `npx playwright merge-reports --reporter html`.

**Traces.** Playwright traces include DOM snapshots, ARIA snapshots and screenshots per action. Use them for E2E. Vitest's Trace View covers only component tests.

**Browsers.** Chromium on every PR. Firefox, WebKit and phone-viewport emulation nightly. This split is my recommendation, not sourced.

## 3. Protocol contract tests

Put the message schemas in a shared `packages/protocol` package, validated with Elysia's schema tooling (Elysia 1.4.32). Every message carries a `protocolVersion`, negotiated in a hello handshake. Contract tests cover four things:

- **Golden fixtures.** One JSON fixture per message type, decoded by both server and client under bun test.
- **N-1 compatibility.** The fixtures from the last deployed version must still decode on the new server, and new server output must decode on the previous client. Keep old fixtures in the repo permanently. Rolling deploys on a single VPS depend on this.
- **Failure modes.** Unknown fields are ignored. Unknown message types return a typed error and never crash the server.
- **Privacy contract.** The server-to-client snapshot schema for an unrevealed round has no vote field. Test it at runtime with generated states, and at type level too.

A change in `packages/protocol` should trigger the server, web and E2E jobs through the affected graph.

## 4. Property-based and model-based tests of the room reducer (fast-check 4.10.3)

fast-check's model-based API works like this (from its docs): commands are objects with `check(model)` and `run(model, real)`. `fc.commands(allCommands, { size })` generates sequences, and `fc.modelRun(setup, cmds)` runs them against a model and the real system. A failing sequence is shrunk to a minimal reproducer.

To make this work, the reducer must be pure: `(state, event, ctx) => { state, effects }`, where `ctx` holds `now` and `rng`. Nothing inside the reducer may read the clock, random numbers or sockets. This is a decision to make now (see below).

**Model.** A small reference model holds users, votes, phase, round and capacity. After every command, compare what each simulated client would see (its projection) against the model's projection.

**Properties to state:**
1. No vote value appears in any projection before reveal.
2. Reveal is idempotent.
3. Votes belong to a round and clear on a new round.
4. Capacity stays between 2 and 30.
5. Reconnecting with the same client id restores that user's vote and does not duplicate the user.
6. If events are logged, replaying the log reproduces the live state.

**Budget.** 100 runs per property locally and in PR CI. 10,000 or more runs nightly, selected by an environment variable. These are my numbers.

## 5. Deterministic simulation testing

FoundationDB's documentation describes its Simulation as a deterministic simulation of a whole cluster inside a single-threaded process. Runs are repeatable, and simulated time runs at roughly 10 to 1 against real time. The simulator models network delivery, connection failures, delays, reboots and disk behaviour. One pattern it names is swizzle-clogging: clog a random subset of connections one by one, then unclog them in random order.

Applied to this app:
- A single-threaded actor scheduler.
- An injected clock; nothing calls `Date.now` or `setTimeout` directly.
- A seeded PRNG kept in the repo.
- A simulated transport that drops, duplicates, delays and reorders messages, and disconnects clients.
- N simulated clients driven by the same command model as section 4.
- Invariants checked after every step: privacy, capacity, phase monotonicity, one vote per user per round.
- The seed is printed on failure, so any run can be replayed.

Nightly: 10,000 seeds, with an estimated 15 to 30 minutes of runtime. Antithesis is a commercial DST platform whose docs describe the approach. I did not check its pricing or terms. I did not find a mature open-source TypeScript DST framework in this run. Building the small simulator in-house is my estimate of a few hundred lines.

## 6. WebSocket load testing: k6 versus Artillery

**k6 v2.4.0 (12 Nov 2026).** WebSocket support is the stable `k6/websockets` module. The v1.6.0 release notes say the API is identical to the earlier experimental module, so only the import path changed. The API is `ws.connect(url, params, fn)` with `on('open' | 'message' | 'close' | 'error')`, `setInterval` and `setTimeout`. The docs example checks for status 101 and runs 10 VUs.

**Artillery 2.0.34 (MPL-2.0).** Scenarios are YAML. The `ensure` plugin exits non-zero when a check fails, which works as an SLO gate in CI. Artillery has a WebSocket example. A secondary source says `artillery report` was removed in 2.0.22, so results are read from JSON output or Artillery Cloud.

**Recommendation: k6.** The load generator is a single binary with no Node runtime on the load box, and thresholds are built in. This is my judgement, not a sourced comparison.

**Scenario.** Rooms of 2 to 30. Each user votes once per round, then reveal broadcasts. Measure p95 and p99 vote-to-broadcast latency, reconnect success, and error rate. Add churn, for example 1% of users reconnecting per minute.

**Derived fan-out.** Each vote broadcast to a 30-person room is 30 votes times 30 recipients, or 900 deliveries per round. A 1,000-room server at an average of 10 people is about 10,000 sockets. These are planning numbers, not measurements.

**Gate.** A smoke run of about 1 minute can run per PR. Full runs are nightly or before a release, against a clone of the VPS using the same Docker image. Never run load against production.

## 7. Visual regression, self-hosted

- **Playwright `toHaveScreenshot`** is built into `@playwright/test`, with no service to run. Other open-source, self-hostable options named in a 2026 survey are BackstopJS, reg-suit and Loki (secondary source).
- **Lost Pixel is archived** (repo archived 22 Apr 2026, with a 'sunsetting the product' notice). Do not adopt it.
- **Argos** calls itself open source with local capture. Whether its self-hosted option is practical was not verified.
- **Recommendation.** Use `toHaveScreenshot` for 10 to 20 key states: lobby, voting with hidden cards, revealed with statistics, phone viewport. Disable animations, fix the clock, mask timers and ids. Generate baselines inside the same pinned Playwright container that CI uses, so font and OS drift does not cause false diffs. Update baselines through a manual workflow. Do not screenshot every component story.

## 8. Accessibility (axe)

Use axe-core 4.14.1 (npm). Run it inside the Playwright flows at the lobby, voting and revealed states, and in the phone viewport. Run it per component in Vitest Browser Mode for fast feedback. Fail on serious and critical violations and report moderate ones. The `@axe-core/playwright` integration was not read in this run.

Axe cannot check the things that matter most here: keyboard-only voting, and whether the reveal is announced to screen readers. Those need manual checks.

## 9. Lighthouse and bundle-size budgets

- **Lighthouse CI 0.16.1** (11 Nov 2026) runs Lighthouse 13.6. The 13.6 upgrade was merged into LHCI on 16 Oct 2026. A secondary source says LHCI 0.16 needs Node 22.19 or later.
- **Pattern.** An example PR config audits three pages, three runs each, through `@lhci/cli autorun`. Three runs per URL matters because lab scores are noisy.
- **Assert on metrics, not only the score.** Assert on LCP, total blocking time and CLS under mobile emulation, plus resource-size budgets. Score-only gates flap.
- **size-limit 14.3.0** budgets JavaScript per entry (lobby, room SPA). Budget the static marketing pages separately, since they are on Workers.
- **Numbers (my proposal, not sourced).** Room route JavaScript at or below 150 kB gzip. Mobile lab LCP at or below 2.5 s.

## 10. Speed and state of oxlint, oxfmt and TypeScript 7

**TypeScript 7.0.** Released 8 Jul 2026 (Microsoft devblog). Build times from that post, TypeScript 6 to 7:
- vscode: 125.7 s to 10.6 s (11.9x)
- sentry: 139.8 s to 15.7 s (8.9x)
- bluesky: 24.3 s to 2.8 s (8.7x)
- playwright: 12.8 s to 1.47 s (8.7x)
- tldraw: 11.2 s to 1.46 s (7.7x)

Memory use is also lower in those runs, by 6% to 26%. Slack reports its CI type-check went from about 7.5 min to 1.25 min (company-reported).

Caveats from the same post:
- TypeScript 7.0 ships no compiler API. 7.1 will ship a new, different one.
- Tools that need the old API, such as typescript-eslint, should use the `@typescript/typescript6` package via an npm alias. The post gives the alias syntax.
- A devblog feed item dated 10 Nov 2026 mentions TypeScript 7.1 target support. I did not read it, so 7.1's status is unverified.

**oxlint 1.94.0.** Type-aware linting runs through tsgolint v7, which went stable on 22 Jul 2026. It tracks TypeScript 7.0.2 and covers 59 of typescript-eslint's 61 type-aware rules. I did not read an oxlint speed benchmark, so no speed figure is given here.

**oxfmt 0.79.0.** In beta since 24 Feb 2026 and pre-1.0. A third-party overview says it passes Prettier's JavaScript and TypeScript conformance tests but does not cover every Prettier option. The oxc docs claim about 30x faster than Prettier and 2x faster than Biome (vendor benchmark). VoidZero says its JSON, CSS and GraphQL formatters are about 7x faster than Prettier. Pin the exact version, and expect occasional formatting churn until 1.0.

**Estimate for this app.** Incremental `tsc --noEmit` on the affected packages: 2 to 10 s. This is my estimate from the speedups above; it needs measuring on the real repo.

## 11. GitHub Actions: caching, affected jobs, merge queue, previews

**Bun caching.** I did not read the setup-bun or cache action docs in this run. The usual pattern is to cache the Bun install cache keyed on the lockfile and install with `--frozen-lockfile`. That is from memory.

**Affected jobs (Turborepo 2.11).**
- `turbo run build lint test --affected` defaults to `--filter=...[main...HEAD]`.
- The comparison needs the full history. Set `filter: blob:none` and `fetch-depth: 0` on actions/checkout. If the checkout is shallow, every package counts as changed.
- Override the base with `TURBO_SCM_BASE`.
- Combine with `--filter`; for example `--filter=!docs` excludes a package.
- The `affectedUsingTaskInputs` future flag filters at task level instead of package level.
- Nx was not researched in this run. Plain workspace path filters are a fallback.

**Merge queue.** GitHub's docs say merge queues are available in public repositories owned by an organization, or in private repositories owned by an Enterprise Cloud organization. A personal-account repo does not get one, so this project must move into an organization before enabling it. Each workflow in the queue also needs a `merge_group` trigger; without it, required checks never report and the merge fails. Queue settings include build concurrency (1 to 100), a status check timeout, merge limits, and a 'only merge non-failing pull requests' option. Keep that option off if flakes are a risk.

**Previews on Cloudflare Workers.**
- `wrangler versions upload` uploads a version without activating it. When previews are enabled on the workers.dev subdomain, the preview URL is `https://<first 8 characters of version id><preview_url_suffix>`.
- A preview alias is generated from the git branch name when `--preview-alias` is omitted.
- workers-sdk's own `deploy-previews.yml` is triggered by a PR label, uploads the version, and posts the preview URL as a PR comment.
- For the marketing pages this is straightforward.
- For the room SPA on the VPS there is no Workers preview. My recommendation is an ephemeral Docker stack in CI for E2E, not a per-PR VPS deployment.

**Gate shape.**
- PR: path filters plus affected jobs. E2E sharded 4 ways. `cancel-in-progress` on PR runs.
- Merge queue: runs the same gate on each queued group.
- Nightly: DST, full k6, full browser matrix.

## 12. Target wall-clock times (estimates, measure before committing)

| Tier | Work | Target |
|---|---|---|
| Save | oxfmt and oxlint on changed files | under 1 s |
| Save | Incremental `tsc` on the affected package | 2 to 10 s |
| Pre-push (affected only) | lint, format, types | 15 to 25 s |
| Pre-push (affected only) | bun test: server, reducer, fast-check at 100 runs, contracts | 5 to 10 s |
| Pre-push (affected only) | Vitest Browser Mode for changed components | 5 to 15 s warm |
| Pre-push (affected only) | Total | at most 60 s; under 30 s for a single-package change |
| Local E2E | one two-user spec, one shard, dev server running | 20 to 60 s |
| PR CI | setup and cache restore | 30 to 60 s |
| PR CI | Stage A, parallel: lint, types, unit, contract, PBT, component and axe, builds | 2 to 3 min |
| PR CI | Stage B: Playwright E2E across 4 shards with axe and visual checks | 4 to 6 min |
| PR CI | Stage C, parallel: Lighthouse CI, size-limit, k6 smoke, Workers preview | 3 to 4 min |
| PR CI | Full gate, critical path | about 10 to 12 min |
| Nightly | DST over 10,000 seeds | 15 to 30 min |
| Nightly | Full k6 run and full browser matrix | about 15 min for k6; browser matrix not timed |

The Vitest benchmark above (2.01 s for a 92-module React app in Browser Mode) is the only measured anchor here. Everything else is an estimate.

## 13. Recommendation, tradeoffs and what to decide now

**Recommended stack.** bun test for server, protocol, reducer and properties. Vitest 5 Browser Mode for components. Playwright 1.65 for multi-user E2E, sharded and traced. fast-check 4.10 for properties and model tests. A small in-house DST simulator, run nightly. k6 v2.4 for load. `toHaveScreenshot` for visual checks. axe-core 4.14 for accessibility. LHCI 0.16 plus size-limit 14.3 for budgets. oxlint 1.94 with type-aware linting, oxfmt 0.79 pinned, TypeScript 7.0.2. Turborepo `--affected` on GitHub Actions, with a merge queue on an organization-owned repo.

**Main tradeoffs.**
- Two test runners versus one. Splitting costs config, but keeps Bun-only server code out of Node.
- oxfmt is pre-1.0. Pinning limits churn; formatting drift is still a risk until 1.0.
- TypeScript 7 has no compiler API until 7.1. Tools that need the old API depend on the TypeScript 6 alias.
- DST is high effort. Start with seeded property tests and grow into a simulator.
- Visual baselines are maintenance. Keep the set small and render in one pinned container.
- Merge queues multiply CI runs. A gate of about 12 minutes keeps the queue usable.
- k6 versus Artillery: k6 keeps the load generator out of Node; Artillery stays in the JavaScript ecosystem and has an SLO gate.

**Decide now, because these cannot be retrofitted:**
1. The room reducer is pure, with injected clock, RNG and transport. Without this, the property, model and DST layers do not work.
2. A message protocol with `protocolVersion` in the hello handshake, and a rule that old fixtures stay in the repo permanently.
3. Reconnect semantics for rolling deploys. Rooms are in memory, so decide whether clients re-announce their own votes on reconnect. This is also what makes reconnect tests possible.
4. Client-generated ids and how they map onto test users and contexts.
5. Package boundaries (`protocol`, `room-core`, `server`, `web`, `marketing`). The affected graph depends on them.
6. Ownership: create a GitHub organization before the repo goes public, so the merge queue is available.
7. Test-only hooks: a room-reset endpoint gated by an environment flag, and stable `data-testid` or role conventions for Playwright and axe.
8. Seed logging for every simulated run, so failures reproduce.
9. Pin exact versions of oxfmt, Playwright and the browser container.

## 14. Unverified

See the `unverified` field. Main gaps: oxlint speed benchmarks, Argos self-hosting, Antithesis terms, Bun and Nx CI specifics, the axe Playwright integration, TypeScript 7.1 status, and the release dates of several packages.

## Not verified in this run

- oxlint speed benchmarks against Biome or ESLint on a real repo: No benchmark page was read in this run. The report gives no oxlint speed figure.
- oxfmt Prettier conformance and option coverage at 0.79.0: Only a third-party overview was read. The conformance claim and the list of uncovered options were not checked against oxfmt's own docs.
- TypeScript 7.1 status and compiler API: Only a feed snippet was read. The 7.1 post was not read, so the release status and API shape are open.
- Playwright 1.65.1, Bun 1.4.4, Elysia 1.4.32, fast-check 4.10.3, size-limit 14.3.0, axe-core 4.14.1, Turborepo 2.11.12 release dates: Registry answers gave the versions but not release dates. Dates for these are not given.
- Licences of Vitest, Playwright, fast-check, k6, Bun, Elysia, Turborepo, TypeScript, axe-core, LHCI, size-limit and the oxc tools: Stated from memory and not read in this run. Only Artillery (MPL-2.0) and Lost Pixel (MIT) were read.
- Bun CI setup and dependency cache specifics (setup-bun action, cache key, --frozen-lockfile): The Bun CI docs and the setup-bun action were not read. The described pattern is from memory.
- Nx as an alternative to Turborepo for affected builds: Not researched in this run.
- @axe-core/playwright integration details: Not read. The axe-core version was confirmed from npm only.
- Argos self-hosting feasibility: Only a vendor comparison page was read. Whether the open-source part can be self-hosted at reasonable effort was not verified.
- Antithesis pricing, licence and suitability for a small team: Only a definition page was read. Pricing and terms were not checked.
- Open-source TypeScript deterministic simulation framework: No mature TypeScript DST framework was found in the searches. Building the small simulator in-house is an estimate.
- All wall-clock times in the table (save, pre-push, PR gate, nightly): Estimates from the cited speedups and the Vitest benchmark. Not measured on this repo.
- Per-PR preview of the room SPA and WebSocket server on the VPS: Workers preview URLs were verified for Workers only. A preview design for the VPS-hosted room app is a recommendation, not verified tooling.
- Playwright browser matrix (Firefox, WebKit, phone emulation) cost and reliability: Not researched. The nightly split is a recommendation.
- Load-test planning numbers (1,000 rooms, 10,000 sockets) and the proposed budgets (150 kB gzip, 2.5 s LCP): Planning assumptions and proposals, not sourced. They must be set from the real product and measured data.
- Playwright shards tests with --shard=i/n, uses a blob reporter on CI (reporter: process.env.CI ? 'blob' : 'html'), uploads blob reports per shard, and merges them with npx playwright merge-reports --reporter html in a job that runs even if shards fail.: cited, but the page was never retrieved this run
- Playwright recommends retries 2 on CI and trace 'on-first-retry', and provides trace modes including retain-on-failure and retain-on-failure-and-retries.: cited, but the page was never retrieved this run
- The TestOptions.trace modes include 'on', 'on-first-retry', 'on-all-retries', 'retain-on-failure', 'retain-on-first-failure' and 'retain-on-failure-and-retries', and traces can capture DOM, aria and screenshot snapshots.: cited, but the page was never retrieved this run
- Multiple isolated user sessions are created by injecting the new_context fixture and calling context.new_page() in each context.: cited, but the page was never retrieved this run
- fast-check model-based testing uses fc.commands with Command objects that implement check and run, and fc.modelRun(setup, cmds) runs the commands against a model and the real system; a failing command sequence is shrunk.: cited, but the page was never retrieved this run
- k6 WebSocket tests use ws.connect(url, params, fn) with on('open'|'message'|'close'|'error') handlers and setInterval/setTimeout timers; the docs example checks the status is 101 and runs 10 VUs.: cited, but the page was never retrieved this run
- k6 moved WebSockets from k6/experimental/websockets to the stable k6/websockets module in v1.6.0, with an identical API.: cited, but the page was never retrieved this run
- Artillery's ensure plugin makes a run exit with a non-zero code when a check fails, so SLO checks can gate CI.: cited, but the page was never retrieved this run
- Artillery has a WebSocket example run with npx artillery run test.yml.: cited, but the page was never retrieved this run
- Turborepo --affected defaults to --filter=...[main...HEAD], can be combined with --filter, and needs full history (filter: blob:none and fetch-depth 0 on actions/checkout) or every package counts as changed.: cited, but the page was never retrieved this run
- Turborepo filters can match packages changed since a git ref, e.g. --filter=...[origin/my-feature]; TURBO_SCM_BASE overrides the comparison base.: cited, but the page was never retrieved this run
- Workers version preview URLs are https://<first 8 chars of version id><preview_url_suffix> when previews are enabled, and wrangler versions upload can auto-generate a preview alias from the git branch name.: cited, but the page was never retrieved this run
- workers-sdk's deploy-previews workflow runs on a PR label, uploads a version with wrangler versions upload without activating production, and posts the preview URL on the PR.: cited, but the page was never retrieved this run
- Bun test supports --concurrent, --coverage, JUnit output via --reporter=junit --reporter-outfile, and mock.module.: cited, but the page was never retrieved this run
- Bun test JUnit output is written with --reporter=junit --reporter-outfile.: cited, but the page was never retrieved this run
- GitHub Actions for Playwright sharding uses a matrix of shardIndex and shardTotal and uploads blob-report-N artifacts with 1-day retention.: cited, but the page was never retrieved this run

## Sources

- https://vitest.dev/blog/vitest-5
- https://github.com/vitest-dev/vitest/releases
- https://www.npmjs.com/package/vitest
- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- https://devblogs.microsoft.com/typescript/feed/
- https://www.infoq.com/news/2026/08/typescript-7-released/
- https://www.npmjs.com/package/typescript
- https://www.npmjs.com/package/@typescript/native-preview
- https://oxc.rs/blog/2026-07-22-type-aware-linting-stable
- https://www.infoq.com/news/2026/09/tsgolint-oxlint-typescript/
- https://oxc.rs/docs/guide/usage/linter/type-aware
- https://www.npmjs.com/package/oxlint
- https://github.com/oxc-project/website/blob/main/src/blog/2026-02-24-oxfmt-beta.md
- https://cloudparts.dev/technologies/oxc/
- https://oxc.rs/docs/guide/usage/formatter.html
- https://blog.cloudflare.com/voidzero-update
- https://www.npmjs.com/package/oxfmt
- https://www.npmjs.com/package/@playwright/test
- https://www.npmjs.com/package/fast-check
- https://apple.github.io/foundationdb/testing.html
- https://antithesis.com/docs/resources/deterministic_simulation_testing/
- https://github.com/grafana/k6/releases/tag/v2.4.0
- https://www.npmjs.com/package/artillery
- https://loadfocus.com/blog/artillery-load-testing/
- https://www.npmjs.com/package/turbo
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue
- https://www.npmjs.com/package/bun
- https://www.npmjs.com/package/elysia
- https://github.com/GoogleChrome/lighthouse-ci/releases?after=v0.3.10
- https://github.com/GoogleChrome/lighthouse-ci/issues/1152
- https://www.trevorlasn.com/blog/lighthouse-ci
- https://github.com/assistant-ui/assistant-ui/pull/10240
- https://www.npmjs.com/package/@lhci/cli
- https://www.npmjs.com/package/size-limit
- https://www.npmjs.com/package/axe-core
- https://github.com/lost-pixel/lost-pixel
- https://uiverify.ai/blog/open-source-visual-regression-testing-tools
- https://argos-ci.com/blog/best-visual-regression-testing-tools
- https://unlighthouse.dev/learn-lighthouse/lighthouse-cli
- https://context7.com/microsoft/playwright
- https://context7.com/grafana/k6-docs
- https://context7.com/dubzzz/fast-check
- https://context7.com/vercel/turborepo
- https://context7.com/cloudflare/workers-sdk
- https://context7.com/oven-sh/bun
- https://context7.com/artilleryio/artillery
