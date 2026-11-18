# v9 plan

How the rewrite is staged and what each stage contains. The rows the factory runs are in `docs/plan.yaml`; that file wins over this page. This page exists so the whole scope is visible before the later stages are written as rows.

## Rules

- A row is one change that ships alone and fits one lead session. Its facts carry what the lead needs; the contract is `ARCHITECTURE.md`, the behaviour `UX.md`.
- Rows of stages 2 to 4 are drafts until that stage's planning row rewrites them from what the stage before measured. A planning row writes its stage's rows into `docs/plan.yaml`, and in the same commit moves the next planning row's `after` onto its stage's exit row.
- v1 directories take fixes only. No row of this plan edits them before `v9-retire-v1`.
- The owner stops are five: the concept (`v9-gate-1`), the look of the table (`v9-table-prototype`), the finished room (stage 2's exit row), the cutover (stage 4) and the deletion of v1's database (stage 4). The three planning rows also hand him a Spec, which takes its defaults after 24 hours. Everything else a lead decides and records in its pull request.

## Stage 1: spine

Filed now. Exit: Playwright passes against the shipped image on a pull request, including a server killed mid-round, and two browsers complete a round on the beta host.

| Row | Builds | After |
|-|-|-|
| `v9-foundation` | tooling, check tiers, CI lanes, decks, the API's health route, AGENTS.md | `v9-gate-1` |
| `v9-dev-host` (dotfiles) | `fpp-next.test` with production's path split, database `fpp` on the mini | gate |
| `v9-vps-postgres` (vps) | schema and role `fpp`, secret | gate |
| `v9-room-core` | protocol, reducer, projection, property tests, `protocol.md` | foundation |
| `v9-room-runtime` | handshake, seat tokens, resume, presence, limits; the deterministic simulator, bots, nightly seeds | room-core |
| `v9-db-schema` | Postgres schema, migrations, repositories, CI database | foundation, dev-host |
| `v9-api-ws` | room server on Elysia: upgrade, frames, limits, close codes | room-runtime |
| `v9-api-persistence` | snapshots with epoch fencing, rounds, expiry, room routes | api-ws, db-schema |
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

Draft rows: seat layout and presence states for 2 to 30 seats; hand, decks and keys; reveal choreography and result view; reactions, sound, haptics, calm mode; room shell with invite, settings, people panel and connection states; room home with recent rooms and v1 settings adoption; topics queue, agreed value, session summary and export; insights panel; PWA; embed mode; browser error telemetry; component tests, axe and screenshots; a polish pass on phone and large rooms.

## Stage 3: site and numbers

Opened by `v9-plan-site`. Runs beside stage 2. Exit: every v1 URL answers on the beta host with the new site, and the activation funnel is visible in Umami.

Draft rows: HTTP API (rooms, rounds, summary, stats, contact, feedback, event beacon); rollup tables and the statistics endpoint; v1 importer, rehearsed on a production dump; Astro scaffold with tokens, SEO plumbing and legal pages; landing page with the demo island; guides, comparison pages and changelog; public statistics page; `v9-edge-routing`: one hostname split by path on the beta host, with the measured answer on Worker billing; server-fed Umami from the Worker and the API, website and proxy settings in the vps repo; dashboards and alerts in the vps repo; the privacy page.

## Stage 4: launch

Opened by `v9-plan-launch`. Exit: v1 is gone.

Draft rows: size and Lighthouse budgets in CI; the cutover runbook and two rehearsals on the beta host, ending in the owner's go; the cutover in the vps repo (apex routes, tunnel, final import) and in this repo (targets, URLs, release 9.0.0); after 14 days the removal of v1's directories, workflows and Vercel wiring; the removal of v1's containers and MariaDB in the vps repo behind an owner gate, after the final dump is archived.

## After launch

Not planned as rows: asynchronous rounds; import from and sync to Jira, Linear and GitHub; a second language; Teams and Miro adapters; the silent observer seat; an AI seat; Elysia 2 and Drizzle 1.0 once stable.
