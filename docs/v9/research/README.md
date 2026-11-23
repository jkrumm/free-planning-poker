# Research behind the v9 decisions

Twenty-seven cited research runs: r01 to r14 from 2026-11-18, r15 to r17 from 2026-11-19, r18 to r24 from 2026-11-20, r25 and r26 from 2026-11-21 and r27 from 2026-11-23, each batch after the owner's comments on the strategy report. Each file is one run's report, its unverified items and its sources. The decisions drawn from them are in `../STRATEGY.md` and `../ARCHITECTURE.md`; where a report and those files disagree, those files win, because they weigh the reports against each other and against this repo.

| Run | Topic | Status | Grounded citations |
|-|-|-|-|
| [r01](r01-sync-engines.md) | Sync engines and multiplayer backends | ok | 44/44 |
| [r02](r02-netcode-patterns.md) | Game-networking patterns for low-tick rooms | ok | 34/34 |
| [r03](r03-marketing-framework.md) | Astro versus TanStack Start for the marketing site | ok | 33/33 |
| [r04](r04-spa-stack.md) | Room SPA stack, PWA and embedding | ok | 41/42 |
| [r05](r05-elysia-bun-backend.md) | Bun and Elysia as the backend | partial | 39/49 |
| [r06](r06-rendering-motion.md) | Rendering and motion for the poker table | ok | 36/36 |
| [r07](r07-ux-competitive.md) | Competitive landscape and UX | ok | 39/39 |
| [r08](r08-umami-privacy.md) | Umami and consent law | ok | 30/31 |
| [r09](r09-testing-ci.md) | Testing strategy and CI | partial | 38/54 |
| [r10](r10-deploy-topology.md) | Hosting topology and deploys | partial | 30/34 |
| [r11](r11-observability.md) | OpenTelemetry in the browser and on Bun | ok | 15/15 |
| [r12](r12-rewrite-cutover.md) | Rewrite strategy and cutover | ok | 13/13 |
| [r13](r13-analytics-engine.md) | Engine for the statistics pages | partial | 8/9 |
| [r14](r14-ci-hosted-runners.md) | CI on GitHub-hosted runners for a Bun monorepo | ok | 36/36 |
| [r15](r15-elysia-2.md) | Elysia 2 pre-release as the server framework | ok | 46/46 |
| [r16](r16-umami-tracker-import.md) | Umami browser tracker and importing history | ok | 39/39 |
| [r17](r17-integrations-embed-webhooks.md) | Embedding, webhooks and tracker integrations | ok | 54/55 |
| [r18](r18-effect.md) | Effect for a Bun room server | ok | 49/49 |
| [r19](r19-integration-landscape.md) | The integration landscape: 22 work tools | ok | 59/59 |
| [r20](r20-ai-search-visibility.md) | Being found by search engines and assistants | ok | 44/44 |
| [r21](r21-freeze-v1-branch.md) | Freezing v1 on a maintenance branch | ok | 14/14 |
| [r22](r22-invite-links-room-names.md) | Access codes in invite links, and reusing room names | partial | 16/19 |
| [r23](r23-team-activities.md) | Team activities beyond planning poker | ok | 13/13 |
| [r24](r24-i18n.md) | Languages from day one: catalogue, routing, workflow | ok | 20/20 |
| [r25](r25-astro7-i18n.md) | Astro 7: language routing for a partly translated static site | partial | 8/12 |
| [r26](r26-tracker-browser.md) | Tracker access from a browser, without a stored credential | ok | 18/18 |
| [r27](r27-effect-by-layer.md) | Effect 4 by layer, revisited | ok | 27/28 |

Version numbers are as read on the day of the run. Check a version with `agw web package <name>` before pinning it.
