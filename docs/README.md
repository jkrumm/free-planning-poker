# Documents

One line per file under `docs/`. v9 is the contract for `master`; the files marked v1 describe the app on the branch `v1` and are read for reference only, never followed for v9 work. What every task needs is in the root `AGENTS.md`; rules by concern are under `.claude/rules/`.

## v9

| File | Holds |
|-|-|
| `plan.yaml` | the rows factory leads build v9 from; wins over `v9/PLAN.md` |
| `development.md` | toolchain and versions, check tiers, the test kit, boundaries, ports, CI and why it keeps no cache |
| `site-content.md` | the rules for the site's comparisons, glossary and guides, read on reach from `apps/site/AGENTS.md` |
| `shipping.md` | the two branches, fixing and redeploying v1, Vercel, branch protection, releases, verify and monitor |
| `v9/ARCHITECTURE.md` | what the system is: invariants, topology, repo map, stack, room model, protocol, server, data model, HTTP API, client, measurement, testing, cutover |
| `v9/protocol.md` | the exact room protocol: frames, commands, events, rejection reasons, close codes, the view, the result contract |
| `v9/ENGINEERING.md` | how work goes: where v1 lives, targets, code patterns, what a script enforces, local checks, CI, the factory, basalt-ui |
| `v9/TABLE-BRIEF.md` | the brief every table arena entry gets, complete on its own: the contract, the floor, the tokens, how to run the gallery and the scorecard, how to submit |
| `v9/ARENA.md` | the owner's runbook for the arena: starting an entry, the directions, scoring, the gallery, closing the arena |
| `v9/UX.md` | what the product does: principles, the room, flows, the reveal, motion and sound, the table arena, accessibility, copy, languages, the site, what changes for a v1 user |
| `v9/STRATEGY.md` | why each choice was made and what was rejected, with the owner's rulings and comments by date |
| `v9/PLAN.md` | the rules, seats and four stages of the plan in prose |
| `v9/GATE-1.md` | the owner's gate on the concept, closed with "Looks good" |
| `v9/diagrams/` | the SVG figures `ARCHITECTURE.md` embeds: command flow, connection, data model, entry, handoff, lanes, stages, topology |
| `v9/img/` | the SVG figures `UX.md` embeds: layouts, reveal, table sizes |
| `v9/evidence/edge-routing.md` | the beta host split by path at Cloudflare's edge: who serves each path, asset requests on the free plan, the zone's AI crawler settings and what the cutover needs |
| `v9/evidence/transport.md` | the transport bake-off: three WebSocket adapters measured, `Bun.serve`'s native handler kept |
| `v9/evidence/load.md` | 500 rooms and 5,000 sockets under k6, a handoff under load, the nightly guard: the numbers and how to read them |
| `v9/evidence/import-rehearsal.md` | the v1 import: how names, rounds and daily counts come over, and its timed run on a production dump against v1's own counts |
| `v9/research/README.md` | the index of the 27 research runs with their status; `STRATEGY.md` and `ARCHITECTURE.md` win where a report disagrees |
| `v9/research/r01-sync-engines.md` | sync engines and multiplayer backends |
| `v9/research/r02-netcode-patterns.md` | game-networking patterns for low-tick rooms |
| `v9/research/r03-marketing-framework.md` | Astro against TanStack Start for the marketing site |
| `v9/research/r04-spa-stack.md` | the room SPA stack, PWA and embedding |
| `v9/research/r05-elysia-bun-backend.md` | Bun and Elysia as the backend |
| `v9/research/r06-rendering-motion.md` | rendering and motion for the poker table |
| `v9/research/r07-ux-competitive.md` | competitive landscape and UX |
| `v9/research/r08-umami-privacy.md` | Umami and consent law |
| `v9/research/r09-testing-ci.md` | testing strategy and CI |
| `v9/research/r10-deploy-topology.md` | hosting topology and deploys |
| `v9/research/r11-observability.md` | OpenTelemetry in the browser and on Bun |
| `v9/research/r12-rewrite-cutover.md` | rewrite strategy and cutover |
| `v9/research/r13-analytics-engine.md` | the engine for the statistics pages |
| `v9/research/r14-ci-hosted-runners.md` | CI on GitHub-hosted runners for a Bun monorepo |
| `v9/research/r15-elysia-2.md` | the Elysia 2 pre-release as the server framework |
| `v9/research/r16-umami-tracker-import.md` | Umami's browser tracker and importing history |
| `v9/research/r17-integrations-embed-webhooks.md` | embedding, webhooks and tracker integrations |
| `v9/research/r18-effect.md` | Effect for a Bun room server; read before writing Effect |
| `v9/research/r19-integration-landscape.md` | the integration landscape: 22 work tools |
| `v9/research/r20-ai-search-visibility.md` | being found by search engines and assistants |
| `v9/research/r21-freeze-v1-branch.md` | freezing v1 on a maintenance branch |
| `v9/research/r22-invite-links-room-names.md` | access codes in invite links, and reusing room names |
| `v9/research/r23-team-activities.md` | team activities beyond planning poker |
| `v9/research/r24-i18n.md` | languages from day one: catalogue, routing, workflow |
| `v9/research/r25-astro7-i18n.md` | Astro 7 language routing for a partly translated static site |
| `v9/research/r26-tracker-browser.md` | tracker access from a browser without a stored credential |
| `v9/research/r27-effect-by-layer.md` | Effect 4 layer by layer, revisited: why the split holds and what reopens it |

## v1, for reference

| File | Holds |
|-|-|
| `observability.md` | v1's OpenTelemetry setup, service names, `recordError` and its severity tree; what v9 carries over is in `v9/ENGINEERING.md`, Code patterns |
| `error-handling-patterns.md` | v1's `recordError` examples |
| `server-reference.md` | v1's WebSocket server in `apps/server` |
| `analytics-reference.md` | v1's Python analytics service, which v9 replaces with Postgres rollups |
| `otel-migration/README.md` | v1's move from Sentry to OpenTelemetry and ClickStack: the index of the files below |
| `otel-migration/PRD.md` | the requirements of that move |
| `otel-migration/01-sentry-audit.md` | what v1 sent to Sentry |
| `otel-migration/02-target-stack.md` | the ClickStack and HyperDX target on the VPS |
| `otel-migration/03-argo-reference.md` | the reference implementation it followed |
| `otel-migration/04-research.md` | the research behind the move |
| `otel-migration/05-observability-v2.md` | v1's telemetry taxonomy: metrics, events, names |
