# v9 strategy

The plan for rewriting Free Planning Poker as release 9.0.0: what gets built, on what, in which order, and what was decided against.

## Verdict

Rewrite on `master`. v1 gets one last change, an analytics script tag, is then frozen on its own branch, and keeps running in production until one reversible cutover.

The current code is small: about 18,000 lines of TypeScript and Python across three services, with two test files. A rewrite changes five things at once: framework, database, UI kit, hosting and protocol. Rewrites that change that much usually fail on scope (`research/r12`). This one is still the right call, for two reasons. What you describe is a different product, not a port. And the risky part, the room logic, becomes one pure module with property tests before any screen exists.

The stack is mostly what you asked for. Two of your premises do not survive the research: the multiplayer engine and the long-lived worktree. Two things you left open are picked: Astro and React. One dependency sets the order of work.

The detail is in four documents and the research behind them:

- `ARCHITECTURE.md`: the technical contract and the data model
- `ENGINEERING.md`: patterns, CI and the development loop
- `UX.md`: the product, with wireframes
- `PLAN.md`: stages and rows
- `research/`: twenty-three cited reports from 2026-11-18 to 2026-11-20

## Your comments of 2026-11-20

Eighteen comments on the second version. What each one changed:

| You said | What changed |
|-|-|
| v1 needs no fixes meanwhile. How do shared root files play out? | They are not shared. v1 moves to the branch `v1` and deploys from there; `master` is v9 only. The reasoning and the steps are in `ENGINEERING.md`, "Where v1 lives" |
| Domain-driven design? What runs where? Latency, races, errors? | The room is one aggregate with one synchronous writer: commands in, events out. `ARCHITECTURE.md` has a new section, "How a change happens", with the vocabulary, a diagram, a table of races and the three kinds of failure |
| Think about Effect, and decide the WebSocket technology | Effect 4 is adopted where I/O fails and kept out of the core. The WebSocket path is decided by a bake-off. Both under "Effect, and which WebSocket" below |
| More team decision tools later, such as a wheel | Commands and events carry their activity's name; seats and topics belong to the room. A confidence vote, dot voting and a wheel fit as modules (`UX.md`, "More than poker") |
| The password need not be secure. It must sit in the URL and be easy to pass on | A lock with a generated code of three words. The invite link carries it, everyone at the table can read it out, nothing is hashed |
| Why drop rounds after 12 months? | No reason that holds. Rounds are kept: they carry no names, they are small, and the insights are made of them |
| How do rooms open up again, and how does the server know what is free? | A name is released six months after the last visit, or 30 days for a room that never revealed a card. One table keyed by the name answers free, held or released in one lookup; the generator asks once for eight candidates |
| The table is the key challenge: let models compete | The table arena: one harness, one brief, several entries, a scorecard, your pick (`UX.md`, "The table arena") |
| Great joining, inviting and coming back | Three ways in on the landing page, one Invite button with QR code and share sheet, recent rooms with a live head count and a pin |
| Efficient tests, a first-class factory citizen, CI on the Linux box | `ENGINEERING.md`, "Built for the factory". CI stays on GitHub's runners because the repository is public; the Linux capacity is used through the factory's step host |
| Did we research how other planning tools would integrate? | Now yes: 22 tools surveyed. The table and the order are in `ARCHITECTURE.md`, "Built for what comes next" |
| We keep estimation data and insights? | All of it. See "Numbers and history" |
| PWA, iframe, embedding | Specified: the install flow, the snippet, the messages between host and room, the hosts it is built for |
| An optimal queue: parallel, few Specs | Six lanes, five gates, no Spec. The site's planning starts beside the spine. See "How the work runs" |
| Best models from several labs on the table | The arena takes any entry: a brief, a harness, one directory, one pull request. You start the entries of other labs |
| SEO, FAQ, README, bento grid, guides, findable by assistants | `UX.md`, "The marketing site" and "Being found", ranked by evidence. The part that counts most is yours: being mentioned elsewhere |
| Work with basalt-ui 3, send findings upstream | A rule and a list of six things v9 needs from basalt-ui 3, in `ENGINEERING.md`, "Working with basalt-ui" |
| Existing users keep their rooms and history? | Yes: every room with its name and its rounds, and from the browser the name, the settings and the last room. One limit: v1 stored a round's average, lowest, highest and count, so old rounds show a summary, not who played what |

## Your rulings of 2026-11-19

| You ruled | What changed |
|-|-|
| Umami runs without a consent banner; the data is anonymous | Umami's own cookieless script runs on every page, served from our origin. The stricter reading regulators publish stays on file in `research/r08` |
| Build on Elysia 2 now | Pinned at the release candidate, exactly. It carries the HTTP routes; whether it also carries the sockets is measured |
| An anonymous id is no concern | v1's device id stays, to count returning estimators across the cutover. It is kept as a keyed hash, apart from rooms and votes |
| Bookmarked room links must keep working | One origin: `/room/<name>` is unchanged and the split happens at the Cloudflare edge |
| The cutover happens on a quiet weekend | One rehearsal, a short maintenance window, no live room to carry over |
| Embedding, webhooks, the final vote will come | The final value, the lock and the embedded room ship with 9.0.0. Webhooks and the shells for Jira and others come after, on a model fixed now; see "Built to grow" |
| Keep the analytics data and walk forward from it | See "Numbers and history" |

## Choices left for you

They belong to the first verdict: answer them with it, or leave the defaults.

| Choice | Default | Alternative | Cost of changing later |
|-|-|-|-|
| Who runs a round | Everyone, as in v1, with an optional facilitator lock. Small teams trust each other, and v1's users expect it | The creator is always the host | Low: roles are in the protocol either way |
| What a new room is called | Two words, `brave-otter`: easy to remember in a list of recent rooms | Six digits, as in v1: easy to type on a phone and to say in any language | Low: only the generator changes; old names keep working |
| How far Effect goes | The API's adapters and jobs only | Also the protocol schemas and the client's connection | Widening it later is cheap. Pulling it back out of the protocol and the browser is not, which is why it starts narrow |

## Where the research disagrees with the brief

| The brief | What I recommend | Why |
|-|-|-|
| TanStack DB, SpacetimeDB or another multiplayer engine | A hand-written, server-authoritative room server on Bun | Planning poker is a hidden-information game. Engines that replicate rows, documents or event logs to clients either leak votes or need a per-client filter that is the whole problem. At 30 seats and a few hundred rooms the engines' strengths (offline, large data, multi-region) buy nothing. SpacetimeDB has the best model of the rest and brings its own database and a BSL licence. |
| TanStack Start, or maybe Astro, for the landing pages | Astro 7, static | Content collections, MDX, sitemap, image pipeline and a first-party Cloudflare adapter exist there; on Start each is a plugin to choose. jkrumm.com already runs Astro, and basalt-ui documents Astro for its `tokens` profile. The room app gains nothing from Start's server features. |
| Vite or Preact | Vite 8 with React 19.3 and the React Compiler | Preact saves about 49 kB gzip once. Base UI states support for React only, and Motion on Preact needed a compat fix in June 2026. Not worth it under a design system built on Base UI. |
| Develop in a worktree, merge at the end | Develop on `master`; v1 lives on its own branch | The factory files rows only from the default branch and gives every Issue its own worktree and pull request. A long-lived rewrite branch can't be driven by the plan. So the rewrite takes the default branch and v1 takes the side branch, which costs nothing because v1 is frozen. |

**The dependency:** basalt-ui 3.0.0 is not on npm (the registry serves 2.29.0), and its own plan forbids consumers on unpublished builds. So the plan first builds what does not depend on the design system: core, server, client, tests, deploy, and the arena's harness.

## Effect, and which WebSocket

Effect 4.0 has been stable since 2026-09-30. It earns its place where code waits on things that fail, and nowhere else (`research/r18`).

| Part | Effect? | Why |
|-|-|-|
| The core: `decide`, `evolve`, `project` | no | Pure functions give a runtime nothing to manage. Property tests and the simulator need no runtime either |
| Protocol schemas | no | Zod 4 is about 5 kB in the browser. Effect's Schema pays off only together with its RPC |
| The room loop and the socket | no | The loop is synchronous on purpose. Effect's Bun server exposes neither Bun's publish nor its backpressure codes, has an open report of unbounded buffering, and its RPC is still marked unstable |
| The browser client | no | Its state machine is tested by the simulator, and it would carry the runtime |
| Postgres store, jobs, startup and drain | yes | Retries, schedules and ordered release become declarations |
| Webhook relay and connectors, after launch | yes, the strongest case | A retry rule per status code, bounded concurrency, timeouts, typed failures |

That is narrower than you proposed. What you want from it, stability and testability, comes here from a pure core and a simulator that replays any failure from a seed. Effect adds to it where the system touches the outside.

**The WebSocket path** is decided in the row that builds the transport. Elysia 2's `.ws` and Bun's native handler each implement the same port in about 150 lines. Both run the frame fixtures, the close codes, the drain, a slow consumer and a burst of 2,000 sockets. The numbers go into the pull request, the winner stays, the other is deleted. Elysia keeps the HTTP routes either way.

## Decisions

**The room and its data**

| Area | Decision | Changing it later costs |
|-|-|-|
| Room logic | Commands become events in a pure `decide`; a pure `evolve` applies them; one function builds each seat's view. All in `packages/room-core`, shared by server, client, tests and the landing demo | nothing; this is the part designed to last |
| Vote secrecy | Values leave the server only after the reveal; a property test checks it over generated command sequences | a protocol break |
| Unit of work | The topic. A round is one attempt at it; the final value belongs to it | high: it shapes history, exports and every integration |
| Results | One JSON contract for history, exports, embed messages and webhooks | high once others consume it |
| Activities | Estimating is the activity `poker`; commands and events carry that name, and seats and topics belong to the room | a protocol break, so it is done now |
| Identity | A server-minted seat secret per room is the only credential a participant has. v1's anonymous device id stays, for counting only | low: dropping it deletes one table |
| Access | Open by default. A lock with a generated code that travels in the link. A room key for what outlives a meeting | low |
| Names | Held while a room is used; released six months after the last visit, or 30 days for a room that never revealed a card. One table is the namespace | low: the periods are constants |
| History | Rounds and votes are never deleted by age | none |

**Server**

| Area | Decision | Changing it later costs |
|-|-|-|
| Transport | JSON over one WebSocket, the version in the first frame, a sequence number per room, snapshot on resume | additive changes are free; a new encoding fits behind the version |
| Server | Elysia 2 for HTTP, pinned exactly. The WebSocket path by bake-off between Elysia and Bun's native handler | low: both sit behind one port |
| I/O in the API | Effect 4 in adapters, jobs, startup and drain | low to remove: it sits in three folders behind plain ports |
| Persistence | Postgres only. Live snapshots in an unlogged table with an epoch for ownership; topics and results written through | low |
| Deploys | Drain, snapshot, clients resume against the new container. Tested by killing a server mid-round in CI | none |
| Analytics service | Dropped. Rollup tables in Postgres, continuous with v1's history | low |

**Apps and measurement**

| Area | Decision | Changing it later costs |
|-|-|-|
| Room app | Vite SPA, served by the API container: one image, one version. A PWA, and embeddable in a frame | low |
| The table | Decided in the arena. The floor for every entry: seats and cards are real elements, every action has a key | high below that floor: accessibility would need a parallel structure |
| Design system | basalt-ui 3 for the chrome and charts; the table is a bespoke package on basalt's tokens. Gaps are fixed in basalt-ui | medium |
| Marketing | Astro static on Cloudflare, with no Worker code in front; the hero and the feature tiles run the real components | low |
| Measurement | OpenTelemetry for health, Umami's cookieless script for behaviour, Postgres for product numbers; browser telemetry is errors only | removing the script is one line |

**How it is built**

| Area | Decision | Changing it later costs |
|-|-|-|
| Tests | Properties on the core, a deterministic simulator nightly, real sockets and Postgres for the server, fault tests with Postgres stopped, Playwright with one context per seat against the shipped image, k6 nightly | none |
| Tooling | basalt-ui's oxlint, oxfmt and tsconfig presets; no Turborepo; fast tier under 60 s | low |
| CI | One workflow, lanes chosen by changed paths, one required gate job. Target: 8 minutes median on free hosted runners | low |
| Code rules | Module boundaries and purity enforced by a script, not by review (`ENGINEERING.md`) | low |
| Repo | Nine modules on `master`; v1 on its branch until 14 days after the cutover | none |

The rejected options and the evidence are in `research/`:

- `r01` sync engines, `r02` protocol
- `r03` site framework, `r04` SPA, PWA and embed
- `r05` and `r15` Bun, Elysia and Drizzle, `r06` rendering, `r18` Effect
- `r08` and `r16` Umami, `r10` topology and handoff, `r13` statistics engine
- `r17` and `r19` embedding, webhooks and the integration landscape
- `r20` search and assistants, `r21` freezing v1, `r22` invite links and names, `r23` other activities

## Built to grow

You named what comes after launch: embedding, webhooks with the results, tickets loaded from a tracker, further activities. The costly mistake would be a model that must be migrated when they arrive. Five things are therefore fixed now.

| Fixed now | Because |
|-|-|
| The topic is the unit, and it carries its tracker reference: provider, stable id, display key, site | An imported ticket, a pasted line and a typed title are the same row. A result always knows where it came from |
| One result contract | History, the embed message and a webhook carry the same JSON, and the CSV export is its flat form. A consumer written for one reads the others |
| A room key for its creator | The lock, webhooks and connectors need someone entitled to set them, in a product without accounts |
| A versioned message protocol for the embedded room | A host page hands in topics and receives results. The host writes the estimate into its own ticket, so we hold no tracker credential |
| Commands and events named by activity | A second activity adds a module. It renames nothing and migrates nothing |

Jira leads with about 62 % of agile teams. Of seven planning poker tools compared, six integrate with Jira and four each with Azure DevOps, GitHub and Linear (`research/r17`, `r19`). How each tool is reached:

- **Every tracker, from day one:** paste keys or links, drop a CSV export, take the results out as CSV.
- **Every tracker with automation:** a webhook, and Zapier, Make or n8n write the estimate with the user's own account.
- **Jira:** a Forge app whose page frames the room and writes story points with Forge's own token. Atlassian's older Connect framework takes no new apps and loses support on 2027-01-31.
- **Teams, Zoom, Meet, Trello, Azure DevOps:** each frames the same embedded route. Teams, Zoom and Meet bring a place to meet and no tickets.
- **Linear, GitHub and the rest** frame nothing. They need an OAuth connector, which is the first step at which we would store somebody's token. Last, and only on demand.

The order after launch: webhooks, the route that fills a queue, the Jira shell, a Teams tab, an Azure DevOps extension, then connectors. The data model and the full table are in `ARCHITECTURE.md`, sections "Data model" and "Built for what comes next".

## Numbers and history

**Everything about estimating is kept.** Only Umami's own view of visits starts fresh.

- **Product numbers walk forward.** The importer moves v1's history into Postgres: every room with its name, every round, the daily traffic and event counts, and the days each anonymous device voted. From the cutover the API counts on in the same tables. The statistics page shows one line, and the Python service is retired with nothing in its place but those tables.
- **Umami cannot take the old data.** Self-hosted Umami has no import, and sessions invented from v1's tables would not match live ones (`research/r16`). So Umami starts on v1 now: one script tag, in the row `v9-umami-on-v1`. At the cutover it holds all traffic since that row shipped and continues under the same website id.
- **The raw data is kept.** The final MariaDB dump and its Parquet export are archived before v1's database is deleted.

## The product, in short

- A room is a link. You are seated in under ten seconds with no account.
- The table shows at a glance who is here and who has voted.
- The reveal turns the cards into the distribution and names the lowest and the highest voter, who should talk first. A unanimous vote settles the topic by itself; otherwise one click on the distribution sets the final value.
- It works for six people around a table and for thirty in a grid, on a laptop first and completely on a phone.
- It installs as an app (a PWA), and it runs inside another page as a frame: that page can hand in the topics and receives each result.
- A room can be locked. The code travels in the invite link, so a colleague with the link never types it.
- A new room gets a readable name, two words unless you choose otherwise above. A name nobody uses for six months becomes free again, after 30 days if its room never revealed a card.
- No ads, no banner, no cap on rounds or rooms, and a vote that not even the network tab shows early.

`UX.md` has the flows, the layout rules, the arena and the list of what changes for a v1 user.

## How the work runs

| Stage | Builds | You can test | Exit |
|-|-|-|-|
| 0 Gate | nothing | the reports in the factory console | your verdict on this concept |
| 1 Spine | ground, core, server, client and proof, as the lanes below show them; beside them the arena's harness and the site's planning | a real round between two browsers on `next.free-planning-poker.com`, ugly on purpose | E2E green on the shipped image, including a server killed mid-round |
| 2 Table | basalt-ui 3, the table entries, your pick, then the whole room UI | the arena with every entry side by side, then the real room on the beta host | two verdicts of yours: the table, later the finished room |
| 3 Site and numbers | Astro site with the landing page and its live tiles, guides and search plumbing, Umami on the new pages, edge routing on the beta host, HTTP API, rollups, v1 importer | the full site and the funnel in Umami on the beta host | every v1 URL answers on the beta host |
| 4 Launch | budgets, polish, one rehearsal, the weekend cutover, v1 removal | the rehearsed cutover on the beta host | your go for the switch; later your yes to deleting MariaDB |

![The first stages as parallel lanes with the two owner stops](diagrams/lanes.svg)

A row is one factory Issue: one change that ships alone, sized for one lead session of at most a day. Filed now: 20 rows of stage 1, four that open stage 2, and three planning rows.

- **Up to six rows run at once.** After the core, the server, the client, the arena's harness and the site's planning need nothing from each other.
- **No Spec on the way.** A lead decides and records its decision in the pull request. You are asked five times in the whole program; the five are under "Only you can".
- **Stages 2 to 4 are each opened by a planning row**, which writes the stage's rows from what was measured before it. The draft rows are in `PLAN.md`, so the scope is visible today. The site's planning no longer waits for the spine: content and search work start after the foundation.

![v9 in four stages with the five owner stops](diagrams/stages.svg)

Every merged row deploys to the beta host, so "what does it look like now" always has an address. Leads run a fast tier under 60 seconds locally and leave the full gate to CI on hosted runners.

## What can go wrong

| Risk | Guard |
|-|-|
| The rewrite grows: game feel has no natural end | The cutover bar is the table "What changes for a v1 user" in `UX.md` plus decks, the final value, the lock, the new result view and reactions. Your pick in the arena comes before any other UI row is planned. |
| The arena yields five tables and no decision | Every entry is measured on the same scenarios. The pick is a gate that arrives with a scorecard and a recommendation, and it may combine pieces. |
| basalt-ui 3.0.0 slips | Stage 1 and the arena's harness do not need it. The entries wait on npm. |
| Elysia 2 is a release candidate with open WebSocket reports | One exact pin, every Elysia import in two folders, and the bake-off: if Elysia's socket path loses, Bun's native handler carries the rooms. |
| Effect 4 is seven weeks old as a stable release, and models know 3.x better | Three folders behind plain ports, the unstable modules refused by lint, and the library's own version 4 guidance loaded by every lead that writes it. |
| The handoff between two server versions loses a vote | One process owns a room, enforced by an epoch in Postgres. A CI test kills a server mid-round; the load test repeats it under 5,000 sockets. |
| A released name sends an old bookmark to strangers | A room keeps its name until somebody creates a new room under it, so a bookmark changes meaning only after a takeover. A device that was in the old room then shows a notice before it seats anyone. From another device the person arrives as a visible newcomer, as with any guessed link today, and a locked room lets nobody in. |
| The edge cannot split one hostname by path as planned | Tested on the beta host in stage 3 before anything depends on it. Fallback: the Worker proxies the app paths, WebSocket included. |
| The no-banner ruling is challenged one day | No product number depends on Umami. Removing the script is one line, and the stricter reading with its sources is on file. |
| Your review time is the bottleneck | Five verdicts and no Spec between them; everything else you are needed for is under "Only you can". |

## What it costs

No new paid service is planned. One billing question is open.

- **Site:** the Workers free tier. The pages are static assets with no Worker code; whether the free plan bills asset requests is checked in stage 3.
- **Servers:** the API, Postgres, Umami and ClickStack are on the VPS already. The rewrite removes four containers (MariaDB, v1's server, the analytics service and its updater) and Vercel, and adds one.
- **Work:** 24 build rows now and about 30 drafted for stages 2 to 4. The arena costs two entries from the factory, plus whatever you start elsewhere.

## Only you can

- Give the five verdicts: concept, table, finished room, cutover, deletion of v1's database.
- Set the Vercel project's Production Branch to `v1` when the freeze row asks: one field.
- Publish basalt-ui 3.0.0, ideally with the six items of `ENGINEERING.md`, "Working with basalt-ui".
- Start the arena entries of other labs' models. The brief and the harness are the same for all.
- Get the product mentioned: a demo video, tool directories, launch posts, answers where teams ask. On the evidence so far, this matters more for being recommended by an assistant than anything the site itself can do.
- Sign off the privacy page: it states your ruling on measurement.
- From your old list, what needs a person or an account: the UX review with a colleague (best timed at the arena), a Buy Me a Coffee account, Search Console and Bing Webmaster access.
- After the cutover: check Search Console, remove the Vercel project.
