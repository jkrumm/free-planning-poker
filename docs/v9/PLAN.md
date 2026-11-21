# v9 plan

How the rewrite is staged and what each row builds. The rows the factory runs are in `docs/plan.yaml`; that file wins over this page. All four stages are written out: 78 rows.

![The first stages as parallel lanes with the two owner stops](diagrams/lanes.svg)

## Rules

- A row is one change that ships alone and fits one lead session. Its facts carry what the lead needs; the contract is `ARCHITECTURE.md`, the behaviour `UX.md`.
- **Five gates, no Spec.** The owner is asked for the concept (`v9-gate-1`), the table (`v9-table-pick`), the finished room (`v9-room-verdict`), the cutover (`v9-cutover-runbook`) and the deletion of v1's database (`v9-v1-remove`). No other row waits for him: a lead decides and records it in its pull request.
- **Priority 1.** Every row is filed at queue priority 1, above the default 0 of the owner's other projects (his ruling of 2026-11-21: the rewrite ranks above WeatherOrb and below basalt-ui, whose Issues are raised by hand).
- **Planned ahead, corrected later.** Stages 2 to 4 were written as rows on 2026-11-21, before any code of the rewrite existed. Each has one correction row (`v9-plan-table`, `v9-plan-site`, `v9-plan-launch`): it reads what was measured, fixes the facts of the rows not yet started, notes the ones already running, and changes nothing that still holds.
- **Width before depth.** A row waits only for what it reads. After `v9-room-runtime` the server, the client and the arena's harness run side by side; the site starts after the setup for agents; after the room's shell the rows of the interface each own one directory.
- **The setup for agents comes before features.** `v9-agent-setup` follows the foundation, and every row that builds v9's features follows it. Each later row keeps the setup current in its own pull request.
- **The arena's entries are not rows.** The owner runs them in sessions of his own, with several directions and several labs' models (`ARENA.md`, written by `v9-table-arena`).
- **Text the owner must read is a draft.** Cluster guides, the glossary, comparison pages, `/data`, blog posts and the translated landing pages are merged with `draft: true`: the beta host shows them, production does not until he removes the flag.
- v1 lives on the branch `v1` from the row `v9-freeze-v1` on. One row touches v1 before that: `v9-umami-on-v1` adds a script tag.

## Seats

Every row names the seat its lead starts on.

| Seat | Rows | For |
|-|-|-|
| `opus`, effort high | 16 | new hard logic, or a design other rows build on. The reason is in the row's `why` |
| `lead` | 54 | everything else that is built |
| `light` | 8 | small mechanical rows that a check proves: the development host, the crawl files, the blog and roadmap pages, the session summary, the personal record, the feedback form, the end of v1's hosting. Filed, so the factory does not move them up: a lead that gets stuck there asks |

Two lanes cap what runs at once on the development host: `browser` (2) for rows that run Playwright suites, `ui` (4, a first guess that `v9-plan-table` replaces with a measured number) for rows that run the room's component tests and screenshots.

## Stage 1: spine

Exit: Playwright passes against the shipped image on a pull request, including a server killed mid-round, and two browsers complete a round on the beta host.

| Row | Builds | Seat | After |
|-|-|-|-|
| `v9-umami-on-v1` | Umami's script on v1's pages, so its history starts now | lead | `v9-gate-1` |
| `v9-freeze-v1` | v1 on its own branch with its own deploys; `master` cleared | opus | umami-on-v1 |
| `v9-foundation` | tooling, check tiers, CI, decks, the API's health route on Elysia 2, a short AGENTS.md | opus | freeze-v1 |
| `v9-agent-setup` | the complete setup for agents: AGENTS.md, path-scoped rules, the pull request template, the README, proven by a cold read | opus | foundation |
| `v9-dev-host` (dotfiles) | `fpp-next.test` with production's path split, database `fpp` on the mini | light | gate |
| `v9-vps-postgres` (vps) | schema and role `fpp`, secret | lead | gate |
| `v9-room-core` | protocol with named activities, `decide`, `evolve` and `project` with topics, final value and roles, the result contract, property tests, `protocol.md` | opus | agent-setup |
| `v9-room-runtime` | handshake, seat tokens, the lock, reclaim by name, resume, presence, limits; the deterministic simulator, bots, nightly seeds | opus | room-core |
| `v9-db-schema` | Postgres schema with the address table, topics and estimating days, migrations, repositories, a private cluster per test run | lead | agent-setup, dev-host |
| `v9-api-ws` | the transport bake-off between Elysia 2, Bun's native handler and Effect's socket server, then the room server on the winner | opus | room-runtime |
| `v9-api-persistence` | the store on Effect: snapshots with epoch fencing, topics and results written through, the fault tests; the routes for rooms, numbers, names and the lock | opus | api-ws, db-schema |
| `v9-api-drain` | drain and handoff, two-process kill test | opus | api-persistence |
| `v9-api-telemetry` | OpenTelemetry on Bun, the names package with Umami's event registry, metrics, the content policy test | lead | api-ws |
| `v9-room-client` | headless client against the simulator's transport: connection machine, resume, storage | lead | room-runtime |
| `v9-room-plain` | Vite SPA with a plain HTML room in English and German, five languages registered, served by the API | lead | room-client, api-persistence |
| `v9-api-image` | image with API and SPA, compose file, CI build | lead | room-plain |
| `v9-e2e` | Playwright harness, multi-seat flows, restart test, CI lane | lead | api-image, api-drain |
| `v9-vps-next` (vps) | beta service, route, registry entries | lead | api-image, vps-postgres |
| `v9-next-deploy` | rollout on push, beta target, verify | lead | vps-next |
| `v9-load` | k6 scenario, recorded run, nightly guard | lead | api-image, api-drain |
| `v9-table-arena` | the arena: the table's contract, the scenario matrix, the gallery, the scorecard, the brief, the owner's runbook | opus | room-runtime |

## Stage 2: table

Exit: the owner's verdict on the finished room on the beta host.

| Row | Builds | Seat | After |
|-|-|-|-|
| `v9-ui-foundation` | basalt-ui 3.x in the room app and the arena; waits until npm serves it | lead | room-plain |
| `v9-table-pick` (gate) | waits until the owner closes the arena; then the scorecard of every entry, his pick, and `packages/table` built from the picked pieces | opus | table-arena, ui-foundation |
| `v9-plan-table` | corrects the rows of this stage from what the spine measured; sets the `ui` lane's cap | lead | ui-foundation, table-arena, api-ws |
| `v9-room-ui-tests` | component tests with screenshots in a pinned container, axe, the pseudo-locale, `make ui-shots` | lead | ui-foundation |
| `v9-room-shell` | the room on basalt-ui: frame, header, people rail, connection states, themes, the registry every feature plugs into; mounts the table through the arena's contract | opus | room-ui-tests, plan-table |
| `v9-room-round` | the round bar and the keys: topic in place, the voted meter, who is missing, reveal, auto reveal, timer, shortcuts | lead | room-shell |
| `v9-room-settings` | profile and avatar, decks, auto reveal, timer, sound and calm mode, view, theme, the language switch | lead | room-shell |
| `v9-room-access` | the Invite panel (link and share sheet), the lock with a typed or generated password, the screen for a locked room | lead | room-shell |
| `v9-room-address` | booking and changing a name, the notice before a hold ends, the notice for an address that changed hands | lead | room-shell |
| `v9-room-home` | `/room` with the recent rooms, head counts, pin and remove; the switcher in the header | lead | room-shell |
| `v9-room-topics` | the topic queue: type, paste, CSV, tracker references, reorder, the final value per topic | lead | room-shell |
| `v9-room-summary` | the session summary with Markdown and CSV, and the round badges | light | room-topics, api-read |
| `v9-room-insights` | the Insights panel with basalt-ui's charts | lead | room-shell, api-read |
| `v9-room-record` | the personal record, computed and kept on the device only | light | room-shell |
| `v9-room-feedback` | the feedback form in the room, as v1 has it | light | room-shell, api-contact |
| `v9-table-feel` | what the picked table still lacks: sounds, haptics, reactions, the streak, calm mode | lead | table-pick |
| `v9-room-pwa` | manifest, service worker scoped to `/room`, the update between rounds, the install hint, offline shell | lead | room-home |
| `v9-room-embed` | `?embed=1` that any https page may frame, the message protocol with its host, the snippet, a test host page | lead | room-shell |
| `v9-room-errors` | browser errors and connection states as OTLP logs, with the content policy | lead | room-shell, api-telemetry |
| `v9-room-translations` | the glossary, then Spanish, French and Simplified Chinese complete, checked by back-translation; the "beta" mark | lead | every feature row above |
| `v9-room-polish` | the measured pass on a phone and with thirty seats, in five languages | lead | room-translations, room-errors |
| `v9-room-verdict` (gate) | the finished room on the beta host, with its numbers and the list of what only the owner can try | lead | room-polish, e2e, next-deploy, load |

The entries of the arena are made outside the factory. When `v9-ui-foundation` has shipped, the owner starts sessions with `docs/v9/TABLE-BRIEF.md` as `docs/v9/ARENA.md` describes. Only the table's look waits for his pick: the shell mounts the reference entry until `packages/table` holds the picked one.

## Stage 3: site and numbers

Starts after the setup for agents and runs beside stages 1 and 2. Exit: every v1 URL answers on the beta host with the new site, and the activation funnel is visible in Umami.

| Row | Builds | Seat | After |
|-|-|-|-|
| `v9-site-scaffold` | `apps/site` on Astro, content collections, the draft rule, a page for every v1 URL, routing ready for languages, no look | lead | agent-setup |
| `v9-site-crawl` | `robots.txt` with the bot policy, sitemap, `llms.txt` and Markdown twins, IndexNow | light | site-scaffold |
| `v9-site-schema` | structured data as components, FAQPage from the visible questions, social images, complete head tags | lead | site-scaffold |
| `v9-site-legal` | `/privacy` in plain words, `/imprint` as it stands, `/contact` | lead | site-scaffold |
| `v9-site-guide` | the pillar guide ported from v1; three cluster pages as drafts | lead | site-scaffold |
| `v9-site-glossary` | up to fifteen term pages as drafts | lead | site-scaffold |
| `v9-site-vs` | up to five comparison pages as drafts, every fact dated and sourced on the day | lead | site-scaffold |
| `v9-site-blog` | the blog collection, its feed, a first post as a draft | light | site-scaffold |
| `v9-site-roadmap` | `/roadmap` from the changelog and a list of what is next | light | site-scaffold |
| `v9-site-look` | basalt-ui's site profile: tokens, header, footer with the donation link, theme switch, prose; waits until npm serves it | lead | site-scaffold, ui-foundation |
| `v9-site-landing` | the landing page: live table, three ways in, the claims, the bento grid of live tiles, the questions | opus | site-look, site-schema, table-pick |
| `v9-site-landing-i18n` | the landing page in German, Spanish, French and Chinese as drafts, with hreflang among the published ones | lead | site-landing |
| `v9-site-docs` | `/docs`: every feature explained from the built product, with a static search | lead | site-look, room-polish |
| `v9-selfhost` | the compose file for self-hosting, `/self-hosting`, and a nightly run that follows the page on a clean machine | lead | e2e, site-scaffold |
| `v9-plan-site` | corrects the rows below from the schema, the routes and the collections as built | lead | api-persistence, site-scaffold |
| `v9-api-read` | topics and summary as JSON, CSV and Markdown | lead | plan-site |
| `v9-api-contact` | the contact and feedback routes | lead | plan-site |
| `v9-stats-rollups` | the rollup job, estimating days, `GET /api/stats` with week over week by working days | lead | plan-site |
| `v9-importer` | the one-time import of v1's data, with a dry run, rehearsed on a production dump | opus | stats-rollups |
| `v9-site-stats` | `/analytics`: public statistics, live, with the last known figures when the API is silent | lead | site-look, stats-rollups |
| `v9-site-data` | `/data` as a draft: what a year of rounds shows, every figure with its query | lead | site-stats, importer |
| `v9-edge-routing` | the site on a Worker with static assets, one hostname split by path on the beta host, three measured answers | opus | next-deploy, site-scaffold |
| `v9-umami-proxy` (vps) | Umami under `/api/u` on the beta host, the visitor's address passed through | lead | edge-routing |
| `v9-umami-events` | the script on site and room, the path rewrite, the remaining events, the funnel on the beta host | lead | umami-proxy, room-plain |
| `v9-vps-observability` (vps) | dashboards and alerts for the new services | lead | api-telemetry, vps-next |
| `v9-readme` | the README as the repository's landing page | lead | site-landing, selfhost |
| `v9-site-parity` | `make parity`: every v1 URL answers on the beta host, the indexes are right, the funnel shows | lead | the site's rows, edge-routing, umami-events, api-contact |

## Stage 4: launch

Exit: v1 is gone.

| Row | Builds | Seat | After |
|-|-|-|-|
| `v9-budgets` | size and Lighthouse budgets as CI gates | lead | site-landing, room-polish |
| `v9-plan-launch` | corrects the rows of this stage from the verdict, the parity run and the importer's rehearsal | lead | room-verdict, site-parity |
| `v9-cutover-runbook` (gate) | `CUTOVER.md` with a rollback for every step, one timed rehearsal, the owner's go | opus | plan-launch, importer, budgets, selfhost, readme, site-data, site-landing-i18n, vps-observability |
| `v9-cutover` (vps) | executes the runbook on the weekend the owner starts it; rolls back at the first failed check | opus | cutover-runbook |
| `v9-release-9` | production targets, canonical URLs, the noindex header gone, release 9.0.0 | lead | cutover |
| `v9-v1-hosting-end` | 14 days later: the branch's deploy workflows off, the branch tagged | light | release-9 |
| `v9-v1-archive` (vps) | 14 days later: the final dump archived and its restore proven | lead | cutover |
| `v9-v1-remove` (vps, gate) | v1's containers and MariaDB removed after the owner's yes | lead | v1-archive, v1-hosting-end |

## After launch

Not planned as rows yet, in the order they are likely to come. None changes an existing table or the protocol (`ARCHITECTURE.md`, "Built for what comes next").

1. Webhooks with results: generic, Slack and Teams, with recipes for Zapier, Make and n8n.
2. A route that fills a room's queue with a token any player mints.
3. A Jira Forge app around the embedded room, with write-back of story points.
4. A Teams tab; Zoom and Meet when asked for.
5. A confidence vote, then dot voting, then the wheel, each with its page on the site.
6. A scheduled two-seat smoke round against production, replacing the old idea of an external monitor.
7. An Azure DevOps extension.
8. Search Console and Bing figures on the statistics page.
9. Asynchronous rounds; further languages, chosen by what visitors speak; translated guides; the silent observer seat; an AI seat.
10. Tracker connections held in the browser, for Linear, GitHub, GitLab and others, only on demand.
11. Elysia 2 stable and Drizzle 1.0 when they ship.

## The old backlog, mapped

The Todoist list from before the rewrite, item by item.

| Old item | Where it is now |
|-|-|
| V9: final decision | 9.0.0. Core in `v9-room-core`, result view in stage 2 |
| V9: room password | 9.0.0, as a lock with a typed or generated password that travels in the link. Access in `v9-room-runtime` and `v9-api-persistence`, screens in stage 2 |
| Different estimation scales; abstain with `?` | 9.0.0. Decks with a number behind every card, as the old note wanted |
| Change room and recent rooms; better restoring of name and rooms | Stage 2: recent rooms, the room switcher, versioned storage that adopts v1's keys |
| Room history, last vote summary, low, average and high per round | Stage 2: the insights panel and the topic list |
| Improve the mobile and board view, grouped by estimate | Stage 2: the arena's phone scenarios and the result grouped by value |
| Adjust the room title | Stage 2: the room's name in the tab |
| Light and dark mode | Stage 2 and 3: basalt-ui's themes, system default with a switch |
| New landing page, SEO, FAQ | Stage 3: `v9-site-landing`, `v9-site-schema`, `v9-site-crawl` |
| Blog, SEO guides, a FAQ per article | Stage 3 builds the collections and the first pages as drafts; questions are on the page as text and repeated as FAQPage markup. Further articles are ongoing work, not rows |
| Update the README, user documentation with search | Stage 3: `/docs` with a static search, and the README |
| Switch to next-sitemap | Replaced by Astro's sitemap |
| New lightweight analytics stack | This rewrite: rollup tables in Postgres, the Python service retired |
| Analytics improvements | Week-over-week by working days in stage 3; server activity is on the OpenTelemetry dashboards; notifications go through the existing alerts, not email |
| Search Console stats in analytics | After launch, item 8 |
| Jest and SonarCloud coverage | `bun test` with properties and a simulator; SonarCloud stays outside the gate |
| Checkly with Playwright | After launch, item 6, on the suite that already exists |
| Spinner wheel | After launch, item 5 |
| Change donation to Buy Me a Coffee | Stage 3: the link; the account is the owner's |
| AI dev setup and OpenSpec | Done differently: `AGENTS.md` and the factory |
| AI writing setup | Not part of the rewrite |
| UX review with a colleague; directory listings and launch posts | The owner's, listed in `STRATEGY.md` under "Only you can" |
