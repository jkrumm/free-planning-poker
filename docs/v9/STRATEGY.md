# v9 strategy

The plan for rewriting Free Planning Poker as release 9.0.0: what gets built, on what, in which order, and what was decided against. Detail lives in `ARCHITECTURE.md` (the technical contract and the data model), `ENGINEERING.md` (patterns, CI and the development loop), `UX.md` (the product, with wireframes), `PLAN.md` (stages and rows) and `research/` (seventeen cited reports from 2026-11-18 and 2026-11-19).

## Verdict

Rewrite, in place, on `master`, in new directories, with v1 untouched in production until one reversible cutover.

The current code is small: about 18,000 lines of TypeScript and Python across three services, with two test files. A rewrite changes five things at once: framework, database, UI kit, hosting and protocol. Rewrites that change that much usually fail on scope (`research/r12`). This one is still the right call, for two reasons. What you describe is a different product, not a port. And the risky part, the room logic, becomes one pure module with property tests before any screen exists.

The stack is mostly what you asked for. Two of your premises do not survive the research: the multiplayer engine and the long-lived worktree. Two open picks are made: Astro and React. One dependency sets the order of work.

## Your rulings of 2026-11-19

Your comments on the first version of this report changed it as follows.

| You ruled | What changed |
|-|-|
| Umami runs without a consent banner; the data is anonymous | The server-fed design is gone. Umami's own cookieless script runs on every page, served from our origin. That is simpler, keeps screen sizes, and needs no Worker code. The stricter reading regulators publish stays on file in `research/r08` |
| Build on Elysia 2 now | Pinned at `2.0.0-rc.3`. The release candidate is contained behind the transport port, and a contract suite decides whether its WebSocket path or Bun's native one carries the rooms |
| An anonymous id is no concern | v1's device id stays, to count returning estimators across the cutover. It is kept as a keyed hash, apart from rooms and votes |
| Bookmarked room links must keep working | Settled as one origin: `/room/<slug>` is unchanged and the split happens at the Cloudflare edge. No longer an open choice |
| The cutover happens on a quiet weekend | One rehearsal instead of two, a short maintenance window, no live room to carry over |
| Embedding in Jira or Linear, webhooks, the final vote will come | The final value, the room password and the embedded room with its messages ship with 9.0.0. Webhooks and the shells for Jira and others come after, on a model fixed now; see "Built to grow" |
| Keep the analytics data and walk forward from it | See "Numbers and history" |

## One choice left for you

| Choice | Default | Alternative | Cost of changing later |
|-|-|-|-|
| Who runs a round | Everyone, as in v1, with an optional facilitator lock | The creator is always the host | Low: roles are in the protocol either way; only the default moves |

## Where the research disagrees with the brief

| The brief | What I recommend | Why |
|-|-|-|
| TanStack DB, SpacetimeDB or another multiplayer engine | A hand-written, server-authoritative room server on Bun and Elysia | Planning poker is a hidden-information game. Engines that replicate rows, documents or event logs to clients either leak votes or need a per-client filter that is the whole problem. At 30 seats and a few hundred rooms the engines' strengths (offline, large data, multi-region) buy nothing. SpacetimeDB has the best model of the rest and brings its own database and a BSL licence. |
| TanStack Start, or maybe Astro, for the landing pages | Astro 7, static | Content collections, MDX, sitemap, image pipeline and a first-party Cloudflare adapter exist there; on Start each is a plugin to choose. jkrumm.com already runs Astro, and basalt-ui documents Astro for its `tokens` profile. The room app gains nothing from Start's server features. |
| Vite or Preact | Vite 8 with React 19.3 and the React Compiler | Preact saves about 49 kB gzip once. Base UI states support for React only, and Motion on Preact needed a compat fix in June 2026. Not worth it under a design system built on Base UI. |
| Develop in a worktree, merge at the end | Develop on `master` in new directories | The factory files rows only from the default branch and gives every Issue its own worktree and pull request. A long-lived rewrite branch can't be driven by the plan, and it drifts from production fixes. In place, every commit is yours in this repo's history, v1's paths are simply not touched, and CI lanes keep the two apart. |

**Nothing is paused meanwhile.** v1 keeps deploying when a v1 path changes, v9 deploys to the beta host only, and production sees v9 at the cutover. Your question uncovered one fault: today every push to `master` redeploys v1's server, whatever changed, and that interrupts rooms in progress. With dozens of merges ahead, the first row gives v1's deploys a path filter.

**The dependency:** basalt-ui 3.0.0 is not on npm (the registry serves 2.29.0; `master` is 1,521 commits ahead), and its own plan forbids consumers on unpublished builds. So the plan first builds what does not depend on the design system: core, server, client, tests, deploy.

## Decisions

**The room and its data**

| Area | Decision | Changing it later costs |
|-|-|-|
| Room logic | One pure reducer and one per-seat projection in `packages/room-core`, shared by server, client, tests and the landing demo | nothing; this is the part designed to last |
| Vote secrecy | Values leave the server only after the reveal; a property test checks it over generated command sequences | a protocol break |
| Unit of work | The topic. A round is one attempt at it; the final value belongs to it | high: it shapes history, exports and every integration |
| Results | One JSON contract for history, exports, embed messages and webhooks | high once others consume it |
| Identity | A server-minted seat secret per room is the only credential. v1's anonymous device id stays, for counting only | low: dropping it deletes one table |
| Access | Open by default. An optional password, checked when a seat is minted. A room key for what outlives a meeting | medium |

**Server**

| Area | Decision | Changing it later costs |
|-|-|-|
| Transport | JSON over one WebSocket, the version in the first frame, a sequence number per room, snapshot on resume | additive changes are free; a new encoding fits behind the version |
| Server | Elysia 2, the release candidate pinned exactly, behind a transport port with Bun's native WebSocket as the fallback | low |
| Persistence | Postgres only. Live snapshots in an unlogged table with an epoch for ownership; topics and results written through; rounds kept 12 months | low |
| Deploys | Drain, snapshot, clients resume against the new container. Tested by killing a server mid-round in CI | none |
| Analytics service | Dropped. Rollup tables in Postgres, continuous with v1's history | low |

**Apps and measurement**

| Area | Decision | Changing it later costs |
|-|-|-|
| Room app | Vite SPA, served by the API container: one image, one version | low |
| Table rendering | DOM and CSS, not canvas. Seats are real elements; the reveal turns the cards into the histogram | high for canvas: accessibility would need a parallel DOM |
| Design system | basalt-ui 3 for the chrome and charts; the table is a bespoke package on basalt's tokens | medium |
| Marketing | Astro static on Cloudflare, with no Worker code in front; the hero is the real table played by bots | low |
| Measurement | OpenTelemetry for health, Umami's cookieless script for behaviour, Postgres for product numbers; browser telemetry is errors only | removing the script is one line |

**How it is built**

| Area | Decision | Changing it later costs |
|-|-|-|
| Tests | Properties on the core, a deterministic simulator nightly, real sockets and Postgres for the server, Playwright with one context per seat against the shipped image, k6 nightly | none |
| Tooling | basalt-ui's oxlint, oxfmt and tsconfig presets; no Turborepo; fast tier under 60 s | low |
| CI | One workflow, lanes chosen by changed paths, one required gate job; 8 minutes median on free hosted runners | low |
| Code rules | Module boundaries and purity enforced by a script, not by review (`ENGINEERING.md`) | low |
| Repo | Eight modules, v1 frozen beside them, deleted 14 days after cutover | none |

The rejected options and the evidence are in `research/`:

- `r01` sync engines, `r02` protocol
- `r03` site framework, `r04` SPA, PWA and embed
- `r05` and `r15` Bun, Elysia and Drizzle, `r06` rendering
- `r08` and `r16` Umami, `r10` topology and handoff, `r13` statistics engine
- `r17` embedding, webhooks and tracker integrations

## Built to grow

You named what comes after launch: embedding in Jira or Linear, webhooks with the results, the final vote, tickets loaded from a tracker, password-protected rooms. Your old list carries two of them as V9 items, and both ship with 9.0.0: the final value and the password. For the others the costly mistake would be a model that must be migrated when they arrive. Four things are therefore fixed now.

| Fixed now | Because |
|-|-|
| The topic is the unit, and it carries its tracker reference: provider, stable id, display key, site | An imported ticket, a pasted line and a typed title are the same row. A result always knows where it came from |
| One result contract | History, the embed message and a webhook carry the same JSON, and the CSV export is its flat form. A consumer written for one reads the others |
| A room key for its creator | Passwords, webhooks and connectors need someone entitled to set them, in a product without accounts |
| A versioned message protocol for the embedded room | A host page hands in topics and receives results. The host writes the estimate into its own ticket, so we hold no tracker credential |

What the research says about the integrations themselves (`research/r17`):

- **Jira.** A Forge app can frame an outside page and write story points with Forge's own token. Atlassian Connect ends support on 2027-01-31. That makes Jira a small shell around the embedded room, after launch.
- **Linear.** It has no embed surface, and its directory does not list hobby projects. Linear is reached by webhook and by a route that fills a room's queue.
- **Slack and Teams** each need their own message format; a generic webhook does not post into them. Teams' old connectors were retired in May 2026.
- **Embedded storage.** Chrome, Edge, Firefox, Safari and Brave keep a frame's storage apart from the site's own, and Safari empties it between launches. An embedded person can therefore lose the seat secret. Giving the same name gets the place at the table back, never the hidden vote or a role, so the secret stays the only proof of who someone is.

The order after launch: webhooks, then the queue route, then the Jira shell. OAuth connectors come last and only on demand, because they are the first step at which we would store somebody's token. The data model and the full table are in `ARCHITECTURE.md`, sections "Data model" and "Built for what comes next".

## Numbers and history

- **Product numbers walk forward.** The importer moves v1's history into Postgres: rooms, rounds, daily traffic and event counts, and the days each anonymous device voted. From the cutover the API counts on in the same tables. The statistics page shows one line, and the Python service is retired with nothing in its place but those tables.
- **Umami cannot take the old data.** Self-hosted Umami has no import, and sessions invented from v1's tables would not match live ones (`research/r16`). So Umami starts on v1 now: one script tag, in the row `v9-umami-on-v1`. At the cutover it holds all traffic since that row shipped and continues under the same website id. The overlap also shows how v1's own counts differ from Umami's.
- **The raw data is kept.** The final MariaDB dump and its Parquet export are archived before v1's database is deleted.

## The product, in short

- A room is a link. You are seated in under ten seconds with no account.
- The table shows at a glance who is here and who has voted.
- The reveal turns the cards into the distribution and names the lowest and the highest voter, who should talk first. A unanimous vote settles the topic by itself; otherwise one click on the distribution sets the final value.
- It works for six people around a table and for thirty in a grid, on a laptop first and completely on a phone.
- It is installable, and it runs inside another page: that page can hand in the topics and receives each result.
- A room can have a password. It never needs one.
- No ads, no banner, no cap on rounds or rooms, and a vote that not even the network tab shows early.

`UX.md` has the flows, the layout rules, the reveal choreography and the list of what changes for a v1 user.

## How the work runs

| Stage | Builds | You can test | Exit |
|-|-|-|-|
| 0 Gate | nothing | the reports in the factory console | your verdict on this concept |
| 1 Spine | **Core:** rules with topics, final value and access, the simulator. **Server:** Elysia 2, Postgres, handoff, telemetry. **Client:** headless client, a plain HTML room. **Proof:** image, beta deploy, E2E, load test. **Beside it:** Umami on v1 | a real round between two browsers on `next.free-planning-poker.com`, ugly on purpose | E2E green on the shipped image, including a server killed mid-round |
| 2 Table | basalt-ui 3, the table prototype, then the whole room UI | the playground with every table state, then the real room on the beta host | two verdicts of yours: the table's look, later the finished room |
| 3 Site and numbers | Astro site, landing demo, Umami on the new pages, edge routing on the beta host, HTTP API, rollups, v1 importer | the full site and the funnel in Umami on the beta host | every v1 URL answers on the beta host |
| 4 Launch | budgets, polish, one rehearsal, the weekend cutover, v1 removal | the rehearsed cutover on the beta host | your go for the switch; later your yes to deleting MariaDB |

![v9 in four stages with the five owner stops](diagrams/stages.svg)

A row is one factory Issue: one change that ships alone, sized for one lead session of at most a day. Stage 1 is filed as 18 rows now, plus the first two rows of stage 2.

Stages 2 to 4 are each opened by a planning row, as in WeatherOrb's plan. It writes the stage's rows from what was measured before it. The draft rows are in `PLAN.md`, so the scope is visible today. Stages 2 and 3 run side by side. Stage 3 is planned once the spine is on the beta host, stage 2 once the table prototype has your verdict.

Every merged row deploys to the beta host, so "what does it look like now" always has an address. Leads run a fast tier under 60 seconds locally and leave the full gate to CI on hosted runners. v1 keeps its own CI lane and takes fixes only.

## What can go wrong

| Risk | Guard |
|-|-|
| The rewrite grows: game feel has no natural end | The cutover bar is the v1 parity table in `UX.md` plus decks, the final value, the password, the new result view and reactions. Your verdict on the table prototype comes before any other UI row is planned. |
| basalt-ui 3.0.0 slips | Stage 1 does not need it. Stage 2 waits on npm. |
| Elysia 2 is a release candidate with open WebSocket reports, and its tags have moved | One exact pin. Every Elysia import sits in two folders. A contract suite of frames, close codes and the drain runs on every bump; if Elysia's WebSocket path fails it, Bun's native handler takes the same port. |
| The handoff between two server versions loses a vote | One process owns a room, enforced by an epoch in Postgres. A CI test kills a server mid-round; the load test repeats it under 5,000 sockets. |
| The edge cannot split one hostname by path as planned | Tested on the beta host in stage 3 before anything depends on it. Fallback: the Worker proxies the app paths, WebSocket included. |
| The no-banner ruling is challenged one day | No product number depends on Umami. Removing the script is one line, and the stricter reading with its sources is on file. |
| Your review time is the bottleneck | Five verdicts in the whole program: concept, table look, finished room, cutover, data deletion. Beyond them only the tasks under "Only you can". Everything else a lead decides. |

## What it costs

No new paid service is planned. One billing question is open.

- **Site:** the Workers free tier. The pages are static assets with no Worker code; whether the free plan bills asset requests is checked in stage 3.
- **Servers:** the API, Postgres, Umami and ClickStack are on the VPS already. The rewrite removes four containers (MariaDB, v1's server, the analytics service and its updater) and Vercel, and adds one.
- **Work:** 20 build rows now and about 30 drafted for stages 2 to 4.

## Only you can

- Give the five verdicts: concept, table look, finished room, cutover, deletion of v1's database.
- Publish basalt-ui 3.0.0.
- Sign off the privacy page: it states your ruling on measurement.
- From your old list, what needs a person or an account: the UX review with a colleague (best timed at the table prototype), the directory listings and launch posts, a Buy Me a Coffee account, Search Console access for the statistics page.
- After the cutover: check Search Console, remove the Vercel project.
