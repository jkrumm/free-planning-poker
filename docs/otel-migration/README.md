# OTEL Migration — Sentry → ClickStack/HyperDX

Migration plan + supporting research for replacing Sentry with self-hosted OpenTelemetry (ClickStack/HyperDX on the VPS).

**Status:** PRD draft, pre-implementation. Awaiting review before Phase 0 of [PRD](PRD.md#5-phased-execution).

**Audited / researched:** 2026-05-19.

---

## Files

| File | Role |
|-|-|
| [PRD.md](PRD.md) | The plan. Phases, scope, success criteria, risks, rollback. **Read first.** |
| [01-sentry-audit.md](01-sentry-audit.md) | Inventory of every Sentry touchpoint across web/server/analytics. Parity checklist. |
| [02-target-stack.md](02-target-stack.md) | VPS ClickStack/HyperDX specifics: endpoints, ports, auth, 1Password paths. |
| [03-argo-reference.md](03-argo-reference.md) | Argo's pure-OTEL implementation. Template for fpp-server (same stack). |
| [04-research.md](04-research.md) | Latest OTEL/HyperDX state. Sentry→OTEL semantic mappings. Dual-run strategy. Versions pinned. |
| [05-observability-v2.md](05-observability-v2.md) | **Next phase.** Metrics + log-based events + typed taxonomy. Makes the multiplayer room measurable. Supersedes the "metrics out of scope" note below. |

---

## Reading order

**To approve the plan:** PRD only.

**To implement:** PRD → 01 (parity checklist) → 03 (fpp-server template) → 04 (gotchas, mappings) → 02 (deployment knobs).

**To extend later:** 04 first (state of the ecosystem), then PRD §11 (future work).

---

## Out of scope (intentional)

- **Umami web analytics** is a separate effort. Different tool (product analytics, not observability). Will be self-hosted on the VPS later. Not in this migration.
- **Custom dashboards** beyond one "errors per service" view — see PRD §2.
- **Metrics export.** Out of scope for the *migration* (v1). Now specced as the next phase — see [05-observability-v2.md](05-observability-v2.md).

---

## Owner

Johannes. Solo project, no review chain. fpp is on the PR-required denylist in the global SourceRoot config, so all non-trivial changes ship through a PR (CodeRabbit + CI + squash-merge via admin bypass).
