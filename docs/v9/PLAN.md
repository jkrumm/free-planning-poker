# v9 plan

How the rewrite is staged and what each stage contains. The rows the factory runs are in `docs/plan.yaml`; that file wins over this page. This page exists so the whole scope is visible before the later stages are written as rows.

![v9 in four stages with the five owner stops](diagrams/stages.svg)

## Rules

- A row is one change that ships alone and fits one lead session. Its facts carry what the lead needs; the contract is `ARCHITECTURE.md`, the behaviour `UX.md`.
- Rows of stages 2 to 4 are drafts until that stage's planning row rewrites them from what the stage before measured. A planning row writes its stage's rows into `docs/plan.yaml`, and in the same commit moves the next planning row's `after` onto its stage's exit row.
- v1 directories take fixes only. No row of this plan edits them before `v9-retire-v1`, with two exceptions: `v9-foundation` gives v1's deploy workflow and Vercel build a path filter, and `v9-umami-on-v1` adds one script tag.
- The owner stops are five: the concept (`v9-gate-1`), the look of the table (`v9-table-prototype`), the finished room (stage 2's exit row), the cutover (stage 4) and the deletion of v1's database (stage 4). The three planning rows also hand him a Spec, which takes its defaults after 24 hours. Everything else a lead decides and records in its pull request.

## Stage 1: spine

Filed now. Exit: Playwright passes against the shipped image on a pull request, including a server killed mid-round, and two browsers complete a round on the beta host.

| Row | Builds | After |
|-|-|-|
| `v9-foundation` | tooling, check tiers, CI lanes, path filters on v1's deploys, decks, the API's health route on Elysia 2, AGENTS.md | `v9-gate-1` |
| `v9-umami-on-v1` | Umami's script on v1's pages, so its history starts now | gate |
| `v9-dev-host` (dotfiles) | `fpp-next.test` with production's path split, database `fpp` on the mini | gate |
| `v9-vps-postgres` (vps) | schema and role `fpp`, secret | gate |
| `v9-room-core` | protocol, reducer with topics, final value and roles, projection, the result contract, property tests, `protocol.md` | foundation |
| `v9-room-runtime` | handshake, seat tokens, password and room key, reclaim by name, resume, presence, limits; the deterministic simulator, bots, nightly seeds | room-core |
| `v9-db-schema` | Postgres schema with topics and estimating days, migrations, repositories, CI database | foundation, dev-host |
| `v9-api-ws` | room server on Elysia 2: upgrade, frames, limits, close codes, and the contract suite that decides between Elysia's WebSocket path and Bun's | room-runtime |
| `v9-api-persistence` | snapshots with epoch fencing, topics and results written through, expiry, room, access and key routes | api-ws, db-schema |
| `v9-api-drain` | drain and handoff, two-process kill test | api-persistence |
| `v9-api-telemetry` | OpenTelemetry on Bun, the names package, metrics, the content policy test | api-ws |
| `v9-room-client` | headless client: connection machine, resume, storage | api-ws |
| `v9-room-plain` | Vite SPA with a plain HTML room, served by the API | room-client, api-persistence |
| `v9-api-image` | image with API and SPA, compose file, CI build | room-plain |
| `v9-e2e` | Playwright harness, multi-seat flows, restart test, CI lane | api-image, api-drain |
| `v9-vps-next` (vps) | beta service, route, registry entries | api-image, vps-postgres |
| `v9-next-deploy` | rollout on push, beta target, verify | vps-next |
| `v9-load` | k6 scenario, recorded run, nightly guard | api-image, api-drain |

## Stage 2: table

Opened by two rows filed now: `v9-ui-foundation` (installs basalt-ui 3.x; waits until npm serves it) and `v9-table-prototype` (the table in a playground, driven by the simulator, with the owner's verdict on its look). `v9-plan-table` then writes the rest from that verdict and from what the spine measured. Exit: the owner's verdict on the finished room on the beta host.

Draft rows: seat layout and presence states for 2 to 30 seats; hand, decks and keys; reveal choreography and the result view with the final value on the distribution; reactions, sound, haptics, calm mode; room shell with invite, settings, people panel, connection states, light and dark, the room's name in the tab; the password prompt and the admin's access settings with the room key; room home with recent rooms, the room switcher and v1 settings adoption; topics queue with the paste parser, session summary and export; insights panel; PWA; embed mode with its message protocol and the snippet to copy; browser error telemetry; component tests, axe and screenshots; a polish pass on phone and large rooms.

## Stage 3: site and numbers

Opened by `v9-plan-site`. Runs beside stage 2. Exit: every v1 URL answers on the beta host with the new site, and the activation funnel is visible in Umami.

Draft rows: HTTP API (topics, summary, stats, contact, feedback); rollup tables, estimating days and the statistics endpoint, with the week-over-week comparison by working days; v1 importer, run once on a production dump; Astro scaffold with tokens, SEO plumbing and legal pages; landing page with the demo island; guides, comparison pages, blog and changelog, each article closing with its questions as structured data; user documentation with a static search; public statistics page; the donation link; `v9-edge-routing`: one hostname split by path on the beta host, with the measured answer on Worker billing; Umami's script on the site and the room app under `/api/u`, with the path rewrite, the event registry and the proxy settings in the vps repo; dashboards and alerts in the vps repo; the privacy page.

## Stage 4: launch

Opened by `v9-plan-launch`. Exit: v1 is gone.

Draft rows: size and Lighthouse budgets in CI; the cutover runbook and one rehearsal on the beta host, ending in the owner's go; the weekend cutover in the vps repo (apex routes, tunnel, final import) and in this repo (targets, URLs, release 9.0.0); after 14 days the removal of v1's directories, workflows and Vercel wiring; the removal of v1's containers and MariaDB in the vps repo behind an owner gate, after the final dump is archived.

## After launch

Not planned as rows yet, in the order they are likely to come. None changes an existing table or the protocol (`ARCHITECTURE.md`, "Built for what comes next").

1. Webhooks with results: generic, Slack and Teams.
2. A route that fills a room's queue with the room key.
3. A Jira Forge app around the embedded room, with write-back of story points.
4. A scheduled two-seat smoke round against production, replacing the old idea of an external monitor.
5. A wheel that picks who speaks first.
6. Search Console figures on the statistics page.
7. Asynchronous rounds; a second language; Teams and Miro shells; the silent observer seat; an AI seat.
8. OAuth connectors for Linear, GitHub and Azure DevOps, only on demand.
9. Elysia 2 stable and Drizzle 1.0 when they ship.

## The old backlog, mapped

The Todoist list from before the rewrite, item by item.

| Old item | Where it is now |
|-|-|
| V9: final decision | 9.0.0. Core in `v9-room-core`, result view in stage 2 |
| V9: room password | 9.0.0. Access in `v9-room-runtime` and `v9-api-persistence`, screens in stage 2 |
| Different estimation scales; abstain with `?` | 9.0.0. Decks with a number behind every card, as the old note wanted |
| Change room and recent rooms; better restoring of name and rooms | Stage 2: recent rooms, the room switcher, versioned storage that adopts v1's keys |
| Room history, last vote summary, low, average and high per round | Stage 2: the insights panel and the topic list |
| Improve the mobile and board view, grouped by estimate | Stage 2: the phone layout and the result grouped by value |
| Adjust the room title | Stage 2: the room's name in the tab |
| Light and dark mode | Stage 2 and 3: basalt-ui's themes, system default with a switch |
| New landing page, SEO, FAQ | Stage 3. The inspirations from the old note go into `v9-plan-site` |
| Blog, SEO guides, a FAQ per article | Stage 3 builds the collections and the structured data. Writing articles is ongoing work, not a row |
| Update the README, user documentation with search | Stage 3: `/docs` with a static search; the README and contributor overview in stage 4 |
| Switch to next-sitemap | Replaced by Astro's sitemap |
| New lightweight analytics stack | This rewrite: rollup tables in Postgres, the Python service retired |
| Analytics improvements | Week-over-week by working days in stage 3; server activity is on the OpenTelemetry dashboards; notifications go through the existing alerts, not email |
| Search Console stats in analytics | After launch, item 6 |
| Jest and SonarCloud coverage | `bun test` with properties and a simulator; SonarCloud stays outside the gate with v9's sources added |
| Checkly with Playwright | After launch, item 4, on the suite that already exists |
| Spinner wheel | After launch, item 5 |
| Change donation to Buy Me a Coffee | Stage 3: the link; the account is the owner's |
| AI dev setup and OpenSpec | Done differently: `AGENTS.md` and the factory |
| AI writing setup | Not part of the rewrite |
| UX review with a colleague; directory listings and launch posts | The owner's, listed in `STRATEGY.md` under "Only you can" |
