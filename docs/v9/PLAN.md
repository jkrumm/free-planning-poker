# v9 plan

How the rewrite is staged and what each stage contains. The rows the factory runs are in `docs/plan.yaml`; that file wins over this page. This page exists so the whole scope is visible before the later stages are written as rows.

![The first stages as parallel lanes with the two owner stops](diagrams/lanes.svg)

## Rules

- A row is one change that ships alone and fits one lead session. Its facts carry what the lead needs; the contract is `ARCHITECTURE.md`, the behaviour `UX.md`.
- Rows of stages 2 to 4 are drafts until that stage's planning row rewrites them from what the stage before measured. A planning row writes its stage's rows into `docs/plan.yaml`, and in the same commit moves the next planning row's `after` onto its stage's exit row.
- v1 lives on the branch `v1` from the row `v9-freeze-v1` on. One row touches v1 before that: `v9-umami-on-v1` adds a script tag.
- **Five gates, no Spec.** The owner is asked for the concept (`v9-gate-1`), the table (`v9-table-pick`), the finished room (stage 2's exit row), the cutover and the deletion of v1's database (both stage 4). No other row waits for him: a lead decides and records it in its pull request.
- **Width before depth.** A row waits only for what it reads. After `v9-room-runtime` the server, the client and the arena's harness run side by side; the site's planning starts after the foundation.

## Stage 1: spine

Filed now. Exit: Playwright passes against the shipped image on a pull request, including a server killed mid-round, and two browsers complete a round on the beta host.

| Row | Builds | After |
|-|-|-|
| `v9-umami-on-v1` | Umami's script on v1's pages, so its history starts now | `v9-gate-1` |
| `v9-freeze-v1` | v1 on its own branch with its own deploys; `master` cleared | umami-on-v1 |
| `v9-foundation` | tooling, check tiers, CI, decks, the API's health route on Elysia 2, a new AGENTS.md and README | freeze-v1 |
| `v9-dev-host` (dotfiles) | `fpp-next.test` with production's path split, database `fpp` on the mini | gate |
| `v9-vps-postgres` (vps) | schema and role `fpp`, secret | gate |
| `v9-room-core` | protocol with named activities, `decide`, `evolve` and `project` with topics, final value and roles, the result contract, property tests, `protocol.md` | foundation |
| `v9-room-runtime` | handshake, seat tokens, the lock and the room key, reclaim by name, resume, presence, limits; the deterministic simulator, bots, nightly seeds | room-core |
| `v9-db-schema` | Postgres schema with the name table, topics and estimating days, migrations, repositories, a private cluster per test run | foundation, dev-host |
| `v9-api-ws` | the transport bake-off between Elysia 2 and Bun's native handler, then the room server on the winner: upgrade, frames, limits, close codes | room-runtime |
| `v9-api-persistence` | the store on Effect: snapshots with epoch fencing, topics and results written through, the fault tests; rooms, names, lock and key routes | api-ws, db-schema |
| `v9-api-drain` | drain and handoff, two-process kill test | api-persistence |
| `v9-api-telemetry` | OpenTelemetry on Bun, the names package, metrics, the content policy test | api-ws |
| `v9-room-client` | headless client against the simulator's transport: connection machine, resume, storage | room-runtime |
| `v9-room-plain` | Vite SPA with a plain HTML room, served by the API | room-client, api-persistence |
| `v9-api-image` | image with API and SPA, compose file, CI build | room-plain |
| `v9-e2e` | Playwright harness, multi-seat flows, restart test, CI lane | api-image, api-drain |
| `v9-vps-next` (vps) | beta service, route, registry entries | api-image, vps-postgres |
| `v9-next-deploy` | rollout on push, beta target, verify | vps-next |
| `v9-load` | k6 scenario, recorded run, nightly guard | api-image, api-drain |
| `v9-table-arena` | the arena: the table's contract, the scenario matrix, the gallery, the scorecard, the brief | room-runtime |

## Stage 2: table

Opened by four rows filed now. Exit: the owner's verdict on the finished room on the beta host.

| Row | Builds | After |
|-|-|-|
| `v9-ui-foundation` | basalt-ui 3.x in the room app and the arena; waits until npm serves it | room-plain |
| `v9-table-entry-a`, `v9-table-entry-b` | two table entries with different directions | ui-foundation, table-arena |
| `v9-table-pick` (gate) | the scorecard of every entry, the owner's pick, then `packages/table` built from the picked pieces | both entries |

Entries from other labs' models are pull requests the owner starts; the pick counts whatever is merged into the arena when he gives it. `v9-plan-table` then writes the rest of the stage from the pick and from what the spine measured.

Draft rows: hand, decks and keys; the reveal and the result view with the final value on the distribution; reactions, sound, haptics, calm mode; room shell with the Invite panel (link, QR code, share sheet), settings, people panel, connection states, light and dark, the room's name in the tab; the lock and the admin's access settings with the room key; room home with recent rooms (live head count, pin), the room switcher, the notice for a name that changed hands, and v1 settings adoption; renaming a room; topics queue with the paste parser and CSV import, session summary and export; insights panel; the PWA with its install hint and update prompt; embed mode with its message protocol and the snippet to copy; browser error telemetry; component tests, axe and screenshots; a polish pass on phone and large rooms.

## Stage 3: site and numbers

Opened by `v9-plan-site`, which starts after the foundation and runs beside stages 1 and 2. Exit: every v1 URL answers on the beta host with the new site, and the activation funnel is visible in Umami.

Draft rows, the ones without a dependency on the spine first:

- Astro scaffold with content collections, the search plumbing of `UX.md`, "Being found" (`robots.txt` with the bot policy, sitemap, structured data, `llms.txt` and Markdown twins, IndexNow), and legal pages.
- The pillar guide with its cluster pages and the glossary; comparison pages; blog and changelog; user documentation with a static search.
- The README, rewritten as a landing page for the repository.
- After basalt-ui 3: the look, the landing page with the hero, the three ways in and the bento grid of live tiles.
- After the spine: HTTP API (topics, summary, stats, contact, feedback); rollup tables, estimating days and the statistics endpoint, with the week-over-week comparison by working days; the v1 importer, run once on a production dump; the public statistics page and the yearly data page; the donation link.
- `v9-edge-routing`: one hostname split by path on the beta host, with the measured answer on Worker billing and the zone's bot settings.
- Umami's script on the site and the room app under `/api/u`, with the path rewrite, the event registry and the proxy settings in the vps repo; dashboards and alerts in the vps repo; the privacy page.

## Stage 4: launch

Opened by `v9-plan-launch`. Exit: v1 is gone.

Draft rows: size and Lighthouse budgets in CI; the cutover runbook and one rehearsal on the beta host, ending in the owner's go; the weekend cutover in the vps repo (apex routes, tunnel, final import) and in this repo (targets, URLs, release 9.0.0); after 14 days the end of v1's hosting: the Vercel project, the branch's workflows, the branch kept as a tag; the removal of v1's containers and MariaDB in the vps repo behind an owner gate, after the final dump is archived.

## After launch

Not planned as rows yet, in the order they are likely to come. None changes an existing table or the protocol (`ARCHITECTURE.md`, "Built for what comes next").

1. Webhooks with results: generic, Slack and Teams, with recipes for Zapier, Make and n8n.
2. A route that fills a room's queue with the room key.
3. A Jira Forge app around the embedded room, with write-back of story points.
4. A Teams tab; Zoom and Meet when asked for.
5. A confidence vote, then dot voting, then the wheel, each with its page on the site.
6. A scheduled two-seat smoke round against production, replacing the old idea of an external monitor.
7. An Azure DevOps extension.
8. Search Console and Bing figures on the statistics page.
9. Asynchronous rounds; a second language; the silent observer seat; an AI seat.
10. OAuth connectors for Linear, GitHub and others, only on demand.
11. Elysia 2 stable and Drizzle 1.0 when they ship.

## The old backlog, mapped

The Todoist list from before the rewrite, item by item.

| Old item | Where it is now |
|-|-|
| V9: final decision | 9.0.0. Core in `v9-room-core`, result view in stage 2 |
| V9: room password | 9.0.0, as a lock with a code in the link. Access in `v9-room-runtime` and `v9-api-persistence`, screens in stage 2 |
| Different estimation scales; abstain with `?` | 9.0.0. Decks with a number behind every card, as the old note wanted |
| Change room and recent rooms; better restoring of name and rooms | Stage 2: recent rooms, the room switcher, versioned storage that adopts v1's keys |
| Room history, last vote summary, low, average and high per round | Stage 2: the insights panel and the topic list |
| Improve the mobile and board view, grouped by estimate | Stage 2: the arena's phone scenarios and the result grouped by value |
| Adjust the room title | Stage 2: the room's name in the tab |
| Light and dark mode | Stage 2 and 3: basalt-ui's themes, system default with a switch |
| New landing page, SEO, FAQ | Stage 3. The inspirations from the old note go into `v9-plan-site` |
| Blog, SEO guides, a FAQ per article | Stage 3 builds the collections; questions stay on the page as text, since their markup no longer produces anything in Google. Writing articles is ongoing work, not a row |
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
