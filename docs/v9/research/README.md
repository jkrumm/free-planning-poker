# Research behind the v9 decisions

Thirteen cited research runs from 2026-11-18. Each file is one run's report, its unverified items and its sources. The decisions drawn from them are in `../STRATEGY.md` and `../ARCHITECTURE.md`; where a report and those files disagree, those files win, because they weigh the reports against each other and against this repo.

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

Version numbers are as read on 2026-11-18. Check a version with `agw web package <name>` before pinning it.
