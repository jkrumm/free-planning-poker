# v9 strategy

The plan for rewriting Free Planning Poker as release 9.0.0: what gets built, on what, in which order, and what was decided against. Detail lives in `ARCHITECTURE.md` (the technical contract), `UX.md` (the product), `PLAN.md` (stages and rows) and `research/` (thirteen cited reports from 2026-11-18).

## Verdict

Rewrite, in place, on `master`, in new directories, with v1 untouched in production until one reversible cutover.

The current code is small: about 18,000 lines of TypeScript and Python across three services, with two test files. A rewrite changes five things at once: framework, database, UI kit, hosting and protocol. Rewrites that change that much usually fail on scope. This one is still the right call, for two reasons. What you describe is a different product, not a port. And the risky part, the room logic, becomes one pure module with property tests before any screen exists.

The stack is mostly what you asked for. Four of your premises do not survive the research, and one dependency sets the order of work.

## Where the research disagrees with the brief

| The brief | What I recommend | Why |
|-|-|-|
| TanStack DB, SpacetimeDB or another multiplayer engine | A hand-written, server-authoritative room server on Bun and Elysia | Planning poker is a hidden-information game. Engines that replicate rows, documents or event logs to clients either leak votes or need a per-client filter that is the whole problem. At 30 seats and a few hundred rooms the engines' strengths (offline, large data, multi-region) buy nothing. SpacetimeDB has the best model of the rest and brings its own database and a BSL licence. |
| Umami with flows and events, no consent | Umami fed by our servers, with no Umami script in any browser | Germany's data protection commissioner holds that Matomo needs consent even when cookieless, and says the reasoning carries to similar tools: a script that reads screen, language or referrer accesses the device. The same page says the device rule is not engaged when only data that arrives with a request anyway is analysed, though using it to measure reach needs its own basis under GDPR. So the Worker and the API forward page views and events with the request's IP and user agent. Kept: sessions, funnels, journeys, UTM, countries. Lost: screen size. Gained: ad blockers stop mattering and the marketing pages ship no JavaScript. This is a legal reading, the conservative one, and not legal advice (`research/r08`). |
| TanStack Start, or maybe Astro, for the landing pages | Astro 7, static | Content collections, MDX, sitemap, image pipeline and a first-party Cloudflare adapter exist there; on Start each is a plugin to choose. jkrumm.com already runs Astro, and basalt-ui documents Astro for its `tokens` profile. The room app gains nothing from Start's server features. Your north-star note already says "TanStack Start is not used". |
| Vite or Preact | Vite 8 with React 19.3 and the React Compiler | Preact saves about 49 kB gzip once. Base UI states support for React only, and Motion on Preact needed a compat fix in June 2026. Not worth it under a design system built on Base UI. |
| Develop in a worktree, merge at the end | Develop on `master` in new directories | The factory files rows only from the default branch and gives every Issue its own worktree and pull request. A long-lived rewrite branch can't be driven by the plan, and it drifts from production fixes. In place, every commit is yours in this repo's history, v1's paths are simply not touched, and CI lanes keep the two apart. |
| Marketing on Cloudflare, app on the VPS | Yes, on **one origin**, split by path at the edge | Storage is per origin. Moving the room app to a subdomain would drop every returning user's name and settings, break the installed app's scope and force redirects for every shared room link. |

**The dependency:** basalt-ui 3.0.0 is not on npm (the registry serves 2.29.0; `master` is 1,521 commits ahead), and its own plan forbids consumers on unpublished builds. So the plan builds everything that has no look first: core, server, client, tests, deploy.

## Decisions

| Area | Decision | Changing it later costs |
|-|-|-|
| Room logic | One pure reducer and one per-seat projection in `packages/room-core`, shared by server, client, tests and the landing demo | nothing; this is the part designed to last |
| Vote secrecy | Values leave the server only after the reveal; a property test checks it over generated command sequences | a protocol break |
| Identity | A server-minted seat secret per room. No user id at all | a protocol break; and "we cannot recognise you across rooms" stops being true |
| Transport | JSON over one WebSocket, a version in the subprotocol, a sequence number per room, snapshot on resume | additive changes are free; a new encoding fits behind the version |
| Server | Elysia 1.4 pinned exactly, room layer behind a transport port | low: Elysia 2 is a codemod once it is stable |
| Persistence | Postgres only. Live snapshots in an unlogged table with an epoch for ownership; rounds kept 12 months | low |
| Deploys | Drain, snapshot, clients resume against the new container. Tested by killing a server mid-round in CI | none |
| Analytics service | Dropped. Rollup tables in Postgres, seeded once from v1's history | low |
| Room app | Vite SPA, served by the API container: one image, one version | low |
| Table rendering | DOM and CSS, not canvas. Seats are real elements; the reveal turns the cards into the histogram | high for canvas: accessibility would need a parallel DOM |
| Design system | basalt-ui 3 for the chrome and charts; the table is a bespoke package on basalt's tokens | medium |
| Marketing | Astro static on a Cloudflare Worker; the hero is the real table played by bots | low |
| Measurement | OpenTelemetry for health, server-fed Umami for behaviour, Postgres for product numbers; browser telemetry is errors only | adding a consented script later is additive |
| Tests | Properties on the core, a deterministic simulator nightly, real sockets and Postgres for the server, Playwright with one context per seat against the shipped image, k6 nightly | none |
| Tooling | basalt-ui's oxlint, oxfmt and tsconfig presets; no Turborepo; fast tier under 60 s | low |
| Repo | Eight modules, v1 frozen beside them, deleted 14 days after cutover | none |

The rejected options and the evidence are in `research/`:

- `r01` sync engines, `r02` protocol
- `r03` site framework, `r04` SPA, PWA and embed
- `r05` Bun, Elysia and Drizzle, `r06` rendering
- `r08` Umami and consent, `r10` topology and handoff, `r13` statistics engine

## The product, in short

- A room is a link. You are seated in under ten seconds with no account.
- The table shows at a glance who is here and who has voted.
- The reveal turns the cards into the distribution and says who should talk. Consensus is the one moment that celebrates.
- It works for six people around a table and for thirty in a grid, on a laptop first and completely on a phone.
- It is installable, embeddable, and calm when you want it calm.
- No ads, no banner, no cap on rounds or rooms, and a vote that not even the network tab shows early.

`UX.md` has the flows, the layout rules, the reveal choreography and the list of what changes for a v1 user.

## How the work runs

| Stage | Builds | You can test | Exit |
|-|-|-|-|
| 0 Gate | nothing | the three reports in the factory console | your verdict on this concept |
| 1 Spine | core, simulator, server, Postgres, handoff, headless client, a plain HTML room, image, beta deploy, E2E, load test, telemetry | a real round between two browsers on `next.free-planning-poker.com`, ugly on purpose | E2E green on the shipped image, including a server killed mid-round |
| 2 Table | basalt-ui 3, the table prototype, then the whole room UI | the playground with every table state, then the real room on the beta host | two verdicts of yours: the table's look, later the finished room |
| 3 Site and numbers | Astro site, landing demo, server-fed Umami, edge routing on the beta host, HTTP API, rollups, v1 importer | the full site and the funnel in Umami on the beta host | every v1 URL answers on the beta host |
| 4 Launch | budgets, polish, rehearsal, cutover, v1 removal | the rehearsed cutover on the beta host | your go for the switch; later your yes to deleting MariaDB |

A row is one factory Issue: one change that ships alone, sized for one lead session of at most a day. Stage 1 is filed as 17 rows now, plus the first two rows of stage 2.

Stages 2 to 4 are each opened by a planning row, as in WeatherOrb's plan. It writes the stage's rows from what was measured before it. The draft rows are in `PLAN.md`, so the scope is visible today. Stages 2 and 3 run side by side: stage 3 is planned once the spine is on the beta host, stage 2 once the table prototype has your verdict, and neither waits for the other.

Every merged row deploys to the beta host, so "what does it look like now" always has an address. Leads run a fast tier under 60 seconds locally and leave the full gate to CI on hosted runners. v1 keeps its own CI lane and takes fixes only.

## What can go wrong

| Risk | Guard |
|-|-|
| The rewrite grows: game feel has no natural end | The cutover bar is the v1 parity table in `UX.md` plus decks, the new result view and reactions. Your verdict on the table prototype comes before any other UI row is planned. |
| basalt-ui 3.0.0 slips | Stage 1 does not need it. Stage 2 waits on npm, or you allow a release candidate (choice 2 at the gate). |
| The handoff between two server versions loses a vote | One process owns a room, enforced by an epoch in Postgres. A CI test kills a server mid-round; the load test repeats it under 5,000 sockets. |
| The edge cannot split one hostname by path as planned | Tested on the beta host in stage 3 before anything depends on it. Fallback: the Worker proxies the app paths, WebSocket included. |
| The legal reading is wrong in either direction | Measurement sits behind one module. A consented script later is an addition; dropping server-side events is a deletion. |
| Bun and Elysia move fast: Bun 1.4 rewrote its runtime, Elysia 2 is a release candidate, `server.stop` had a hang | Exact pins; the drain test runs on every bump; stops are raced against a timeout. |
| Your review time is the bottleneck | Five owner stops in the whole program: concept, table look, finished room, cutover, data deletion. Everything else a lead decides. |

## What it costs

No new paid service.

- **Site:** the Workers free tier. Its 100,000 Worker invocations a day cover the HTML documents. Whether static-asset requests are free on that plan is checked in stage 3.
- **Servers:** the API, Postgres, Umami and ClickStack are on the VPS already. The rewrite removes four containers (MariaDB, v1's server, the analytics service and its updater) and Vercel, and adds one.
- **Work:** 19 build rows now and about 30 drafted for stages 2 to 4.

## Three choices for you

| Choice | Default | Alternative | Cost of changing later |
|-|-|-|-|
| 1. Origin | One origin, split by path at the edge | Room app on `app.<domain>`: simpler routing, at the price named in the first table | High after launch: storage, installed apps and links are tied to it |
| 2. basalt-ui timing | UI rows wait for 3.0.0 on npm | Publish a 3.0.0 release candidate for this repo and start stage 2 on it | None; schedule only |
| 3. Who runs a round | Everyone, as in v1, with an optional facilitator lock | The creator is always the host | Low: roles are in the protocol either way; only the default moves |

## Only you can

- Give the five verdicts: concept, table look, finished room, cutover, deletion of v1's database.
- Publish basalt-ui 3.0.0, or allow the release candidate.
- Sign off the privacy page: it states a legal position.
- After the cutover: check Search Console, remove the Vercel project.
