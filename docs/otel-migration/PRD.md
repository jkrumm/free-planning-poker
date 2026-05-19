# PRD: Replace Sentry with OpenTelemetry → ClickStack/HyperDX

**Status:** Draft. Pre-implementation. Awaiting review before Phase 0.
**Owner:** Johannes
**Target completion:** ~3 weeks elapsed, ~12-15 active engineer-days
**Last updated:** 2026-05-19

---

## 1. Why

Sentry is wired into three fpp services for error capture, breadcrumbs, and partial performance tracing — see [01-sentry-audit](01-sentry-audit.md). The VPS already runs ClickStack/HyperDX with traefik, rollhook, and argo producing into it. Argo's Elysia+Bun+Drizzle stack mirrors fpp-server's — see [03-argo-reference](03-argo-reference.md).

Migrating fpp to OTEL → ClickStack:

1. **Single observability backend** across the SourceRoot universe. One UI, one query language, one retention policy.
2. **Full distributed tracing** browser → tRPC → Bun WS server → analytics, currently fragmented across Sentry transactions per service.
3. **Self-hosted** — no per-event quota anxiety, no vendor pricing risk.
4. **Vendor-agnostic** — pure OTEL means future backend swaps are exporter-only changes.
5. **Trace-to-log correlation** via shared `trace_id` is dramatically better than Sentry breadcrumbs for debugging real incidents.

Sentry is paid for via free tier today. The migration is not driven by cost — it's driven by capability and stack consolidation.

---

## 2. Goals & Non-goals

### Goals (in scope)

- Replace `Sentry.captureException`/`captureMessage`/`addBreadcrumb` in all three services with OTEL primitives, preserving call-site API.
- Distributed traces end-to-end: browser → Next.js tRPC handler → fpp-server WS → mysql → Vercel → Bun → cross-service `fetch`.
- Structured Pino/python-json logs flow to HyperDX with `trace_id` correlation.
- Source-map symbolication for browser errors (parity with Sentry).
- Session replay for browser sessions (parity with Sentry's disabled-but-available replay).
- 2-week dual-run validation window before Sentry SDK removal.
- Local-dev parity: pointing at `localhost:4319` works end-to-end.

### Non-goals (explicitly out)

- **Umami web analytics integration.** Separate project. Self-hosted Umami will be added later for product analytics (button clicks, page views). It is *not* an observability tool and does not factor into this PRD.
- **Custom dashboards or alert rules.** Phase 9 should produce a basic "errors per service" dashboard and one alert; comprehensive dashboards are a separate effort after the migration settles.
- **Metrics export.** Argo doesn't export metrics; fpp won't either initially. Traces + logs cover ~95% of observability needs at this scale. Revisit if a real metrics need emerges.
- **`Sentry.captureFeedback` replacement implementation.** Decision required in Phase 4 — but the implementation of the replacement (e.g. webhook to Discord) is its own task.
- **Replacement of `sentry.router.ts` analytics page.** Drop the page, or build a HyperDX-backed equivalent later. Not blocking the migration.

---

## 3. Success criteria

Migration is "done" when ALL of:

- [ ] All three services emit OTEL traces and logs to ClickStack.
- [ ] End-to-end trace from browser click → backend response visible in HyperDX UI for at least the room flip flow (highest-value path).
- [ ] All ~131 `captureError` call sites work without code changes — wrapper internally calls OTEL, not Sentry.
- [ ] All ~121 `addBreadcrumb` call sites work without code changes — wrapper emits OTEL log records.
- [ ] Browser stack traces in HyperDX are source-mapped to original `.tsx` files.
- [ ] Parity validation (§9) passes for 3+ days during dual-run.
- [ ] All `@sentry/*` packages removed from `package.json` / `pyproject.toml`.
- [ ] All `SENTRY_*` env vars removed from `.env.tpl` and Vercel project settings.
- [ ] CLAUDE.md sections on Sentry replaced with OTEL guidance.

---

## 4. Architecture

### 4.1 Producers

| Service | SDK | Endpoint (prod) | Endpoint (local) | service.name |
|-|-|-|-|-|
| `apps/web` | `@vercel/otel` 2.1.2 + `@hyperdx/browser` 0.23.1 | `https://otel.jkrumm.com` (HTTPS + bearer) | `http://localhost:4318` (with local key) | `free-planning-poker` |
| `apps/server` | `@elysiajs/opentelemetry` 1.4.12 + pure OTEL 2.x | `http://clickstack:4319` (docker bridge, no auth) | `http://localhost:4319` | `fpp-server` |
| `fpp-analytics` | `opentelemetry-sdk` 1.42 + FastAPI instrumentor | `http://clickstack:4319` | `http://localhost:4319` | `fpp-analytics` |

Browser-side: cross-origin POST to `https://otel.jkrumm.com/v1/traces` with public bearer (same threat model as the current Sentry DSN). Vercel-rewrite proxy is an option deferred to v2.

### 4.2 Trace propagation

W3C TraceContext (`traceparent`, `tracestate`, `baggage`) headers:

- Browser → Next.js tRPC: injected by `@hyperdx/browser` via `tracePropagationTargets`.
- Next.js → fpp-server (via the Bun server-initiated `fetch` to `/api/trpc/room.trackFlip`): injected manually in `tracedFetch` ([Argo §7](03-argo-reference.md#7-traced-fetch-helper)).
- WS messages → no HTTP headers, but each WS message can carry a `traceparent` in its JSON payload if cross-message tracing is needed later. Out of scope for v1.

CORS `allowedHeaders` on fpp-server: `['Content-Type', 'traceparent', 'tracestate', 'baggage']`.

### 4.3 Wrapper-preserving refactor (the key lever)

The existing `captureError` / `captureMessage` / `addBreadcrumb` wrappers in each service have well-shaped APIs already. **The migration is largely internal to those three wrapper files.**

```ts
// apps/web/src/utils/app-error.ts  (after migration, simplified)
import { trace, SpanStatusCode } from '@opentelemetry/api'
import { logs, SeverityNumber } from '@opentelemetry/api-logs'

const logger = logs.getLogger('fpp-web')
const SEVERITY = { critical: 21, high: 17, medium: 13, low: 9 }

export function captureError(error, ctx = {}, severity = 'medium') {
  const err = normalizeError(error)            // unchanged
  pinoLog(err, ctx, severity)                   // unchanged

  const span = trace.getActiveSpan()
  if (span) {
    span.recordException(err)
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message })
    Object.entries(ctx.extra ?? {}).forEach(([k, v]) =>
      span.setAttribute(`fpp.${k}`, String(v)))
  }

  logger.emit({
    severityNumber: SEVERITY[severity],
    severityText: severity.toUpperCase(),
    body: err.message,
    attributes: {
      'exception.type': err.name,
      'exception.message': err.message,
      'exception.stacktrace': err.stack ?? '',
      'fpp.component': ctx.component,
      'fpp.action': ctx.action,
      ...flatten(ctx.extra),
    },
  })
}
```

The ~131 call sites continue calling `captureError(err, { component, action }, 'high')` unchanged. Same for `captureMessage` and `addBreadcrumb` (which becomes a `logger.emit` with `SeverityNumber.INFO`).

### 4.4 Instrumentation surface (new code)

Per service:

```text
apps/web/
├── instrumentation.ts                  # @vercel/otel registration
├── instrumentation-client.ts           # @hyperdx/browser init (replaces Sentry client init)
├── src/server/api/otel-middleware.ts   # tRPC OTEL middleware (new)
└── src/utils/app-error.ts              # rewritten internals, same API

apps/server/
├── src/telemetry.ts                    # resource, tracer, logger, log helper (Argo pattern)
├── src/utils/traced-fetch.ts           # W3C-injecting fetch wrapper
└── src/utils/app-error.ts              # rewritten internals, same API
# Plus: telemetry import + .use(opentelemetry(...)) added to src/index.ts

fpp-analytics/
├── util/telemetry.py                   # provider + exporter + LoggingHandler setup
└── util/error_capture.py               # OTEL-backed wrapper (renamed from sentry_wrapper.py)
# Plus: FastAPIInstrumentor.instrument_app(app) in main.py lifespan
```

---

## 5. Phased execution

### Phase 0 — Local stack verification (0.5 day)

- [ ] Confirm `~/SourceRoot/vps` local compose is up: `cd ~/SourceRoot/vps && ENV=dev make up`.
- [ ] Visit `http://localhost:7707` (or `https://hyperdx.test`), sign up admin account.
- [ ] Test OTLP endpoint from host:
  ```bash
  curl -X POST http://localhost:4319/v1/traces \
    -H "Content-Type: application/json" -d '{"resourceSpans":[]}'
  # Expect: 200 (empty payload accepted)
  ```
- [ ] Generate fpp-dedicated ingestion key in HyperDX UI → save to `op://vps/fpp/HYPERDX_INGESTION_KEY`.
- [ ] Generate fpp source-map key → `op://vps/fpp/HYPERDX_SERVICE_KEY`.

### Phase 1 — Next.js instrumentation (3-5 days)

- [ ] Add packages: `@vercel/otel`, `@opentelemetry/api`, `@opentelemetry/api-logs`, `@opentelemetry/sdk-logs`, `@opentelemetry/exporter-{trace,logs}-otlp-http`, `@opentelemetry/semantic-conventions`, `@hyperdx/browser`, `@hyperdx/cli` (dev).
- [ ] Create `instrumentation.ts` invoking `@vercel/otel`'s `registerOTel({ serviceName, ... })`.
- [ ] Create `instrumentation-client.ts` replacement initializing `@hyperdx/browser` with `tracePropagationTargets: [/api\/trpc/, fpp-server URL]`.
- [ ] Write tRPC OTEL middleware (span per `trpc.{type}.{path}`), mount on the appRouter.
- [ ] Add propagation to the tRPC client `fetch` link.
- [ ] Refactor `app-error.ts` internals — preserve API, swap Sentry calls for OTEL primitives.
- [ ] Update `next.config.js` — remove `withSentryConfig` wrapper, drop `sentryWebpackPluginOptions`.
- [ ] Add `.env.tpl` vars: `NEXT_PUBLIC_HYPERDX_API_KEY`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `HYPERDX_SERVICE_KEY` (build-time).
- [ ] Keep Sentry SDK installed and running in parallel (dual-emit). Set `tracePropagation: false` and `spans: false` on Sentry's `httpIntegration()` to avoid double-spans.
- [ ] Validate locally: hit `https://fpp.test`, see trace in `https://hyperdx.test` under `free-planning-poker` service.

### Phase 2 — fpp-server (Bun) instrumentation (2-3 days)

- [ ] Add packages: `@elysiajs/opentelemetry`, `@opentelemetry/api`, `@opentelemetry/api-logs`, `@opentelemetry/sdk-trace-base`, `@opentelemetry/sdk-logs`, `@opentelemetry/exporter-trace-otlp-proto`, `@opentelemetry/exporter-logs-otlp-proto`, `@opentelemetry/resources`. Maybe `@kubiks/otel-drizzle` if mysql2 spike succeeds.
- [ ] Create `apps/server/src/telemetry.ts` per Argo pattern.
- [ ] Create `apps/server/src/lib/traced-fetch.ts` (copy from Argo).
- [ ] In `src/index.ts`: import telemetry FIRST, then mount `.use(opentelemetry(telemetryConfig))` as first plugin.
- [ ] Wrap cron `cleanupInactiveState` in `tracedTick`.
- [ ] Replace direct `fetch` to Next.js with `tracedFetch`.
- [ ] **Spike `@kubiks/otel-drizzle` with mysql2.** If it works → commit. If broken → manual Proxy wrap of mysql2 connection.
- [ ] Refactor `app-error.ts` internals — same as Phase 1.
- [ ] Keep `@sentry/bun` running. Sentry v8+ shares OTEL pipeline; minimal collision risk.
- [ ] Validate: connect to a room locally, see WS span + db spans in HyperDX.

### Phase 3 — fpp-analytics (FastAPI) instrumentation (1-2 days)

- [ ] Add to `pyproject.toml`: `opentelemetry-api>=1.42`, `opentelemetry-sdk>=1.42`, `opentelemetry-exporter-otlp-proto-grpc>=1.42`, `opentelemetry-instrumentation-fastapi>=0.63b0`, `opentelemetry-instrumentation-logging>=0.63b0`.
- [ ] **Do not** run `opentelemetry-bootstrap` (broken with uv).
- [ ] Create `util/telemetry.py` — TracerProvider + LoggerProvider + OTLP exporters.
- [ ] In `main.py` lifespan: call telemetry init, then `FastAPIInstrumentor.instrument_app(app, excluded_urls="health,metrics")`.
- [ ] Set `instrumenter='otel'` in `sentry_sdk.init()` to prevent double-patching crash.
- [ ] Wire OTEL `LoggingHandler` alongside the existing PinoJsonFormatter handler.
- [ ] Refactor `util/error_capture.py` internals (renamed from `sentry_wrapper.py`).
- [ ] Validate locally: hit `/daily-analytics`, see span in HyperDX.

### Phase 4 — Browser-side polish (1 day)

- [ ] Enable session replay in `@hyperdx/browser` config: `recordCanvas: false, advancedNetworkCapture: true`.
- [ ] Verify masking — pass `maskAllInputs: true` only if PII concerns exist; fpp doesn't collect PII so probably leave open.
- [ ] **Decide on `Sentry.captureFeedback`:**
  - Option A: Keep Sentry installed only for `sidebar-feedback.tsx` feedback widget. Lightweight (~50KB bundle), preserves UX.
  - Option B: Replace with a tRPC mutation that sends to Discord webhook / email.
  - Option C: Drop feedback widget entirely.
  - PRD recommends Option A — minimal disruption, isolated.
- [ ] **Decide on `sentry.router.ts` analytics page:**
  - Option A: Build HyperDX query (`SELECT exception_type, count() FROM otel_logs GROUP BY exception_type ORDER BY count() DESC LIMIT 50`) via tRPC.
  - Option B: Drop the page; rely on HyperDX UI directly.
  - PRD recommends Option B — that page is dev-facing; HyperDX has better UI than a reimplementation.

### Phase 5 — Source maps + release tracking (0.5 day)

- [ ] Add Vercel build step: `npx @hyperdx/cli upload-sourcemaps --serviceKey $HYPERDX_SERVICE_KEY --path .next` post-`next build`.
- [ ] Set `service.version` resource attribute from `$VERCEL_GIT_COMMIT_SHA` (web) and `package.json#version` (server, analytics).
- [ ] Trigger a known error in production deploy preview → verify stack frames map to `.tsx` source in HyperDX.

### Phase 6 — VPS compose updates (0.5 day)

- [ ] Edit `~/SourceRoot/vps/apps/fpp/compose.yml`:
  ```yaml
  fpp-server:
    networks:
      - proxy
      - valkey-net
      - monitoring-net   # NEW
    environment:
      OTEL_EXPORTER_OTLP_ENDPOINT: http://clickstack:4319
      OTEL_SERVICE_NAME: fpp-server
      OTEL_RESOURCE_ATTRIBUTES: service.version=${VERSION},deployment.environment=production

  fpp-analytics:
    networks:
      - proxy
      - monitoring-net   # NEW
    environment:
      OTEL_EXPORTER_OTLP_ENDPOINT: http://clickstack:4319
      OTEL_SERVICE_NAME: fpp-analytics
  ```
- [ ] Set 30-day TTL on `otel_traces` and `otel_logs` in ClickHouse (bound disk growth).
- [ ] Commit to vps repo, deploy.

### Phase 7 — Dual-run window opens (3 days minimum, 14 days target)

Both Sentry and HyperDX receive identical telemetry. Validate parity per §9.

### Phase 8 — Sentry removal (0.5 day)

After parity validation passes:

- [ ] Remove `@sentry/nextjs`, `@sentry/bun` from package.json; `sentry-sdk` from pyproject.toml.
- [ ] Delete `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` (if not already gone).
- [ ] Delete `SentrySpanProcessor` wiring (Node) and `instrumenter='otel'` (Python).
- [ ] Delete `instrumentation.ts` Sentry-conditional imports.
- [ ] Delete `apps/web/src/components/room/sentry-context-provider.tsx`.
- [ ] Delete `apps/web/src/server/api/routers/sentry.router.ts` and the Sentry issues page (if Option B from Phase 4).
- [ ] Replace `setUser` calls in `local-storage.store.ts` with no-ops or remove.
- [ ] Remove `SENTRY_*` env vars from `.env.tpl` files, Vercel project settings, GitHub Actions secrets.
- [ ] Decide on feedback widget (Phase 4 Option A keeps `@sentry/react` for feedback only; pick now).
- [ ] Update CLAUDE.md and `apps/web/.eslintrc` — remove the rule banning direct `@sentry/*` imports (file no longer relevant) or rename to ban `@opentelemetry/api-logs` direct imports outside the wrapper.

### Phase 9 — Documentation + dashboards (0.5 day)

- [ ] Update `CLAUDE.md` (root) — replace the "Sentry Error Handling Standards" section with OTEL equivalent.
- [ ] Update `apps/server/CLAUDE.md` and `fpp-analytics/CLAUDE.md` error-handling sections.
- [ ] Create one HyperDX dashboard: errors per service over 24h.
- [ ] Create one HyperDX alert: `count(WHERE severity_number >= 17) > 10` in 5m → webhook.
- [ ] Final commit closing the migration: `chore: remove sentry, migration complete`.

---

## 6. Effort summary

| Phase | Days |
|-|-|
| 0. Local verification | 0.5 |
| 1. Next.js | 3-5 |
| 2. fpp-server | 2-3 |
| 3. fpp-analytics | 1-2 |
| 4. Browser polish | 1 |
| 5. Source maps | 0.5 |
| 6. VPS compose | 0.5 |
| 7. Dual-run (elapsed, not active) | 14 elapsed |
| 8. Sentry removal | 0.5 |
| 9. Docs + dashboards | 0.5 |

**Active work: 9-13 engineer-days.** **Elapsed: ~3 weeks** including dual-run.

---

## 7. Risks

| Risk | Severity | Mitigation |
|-|-|-|
| `@kubiks/otel-drizzle` doesn't work with mysql2 under Bun | Medium | Phase 2 spike before committing. Fallback: manual Proxy wrap. |
| Vercel Edge runtime breaks with OTEL exporter | High | `@vercel/otel` handles this. Validate in preview deploy before merging Phase 1. Never import `@opentelemetry/exporter-trace-otlp-grpc`. |
| Cold-start span loss on Vercel | High | `@vercel/otel` uses `SimpleSpanProcessor`. Validated. |
| Disk growth on ClickHouse outpaces VPS capacity | Medium | 30-day TTL configured Phase 6. Monitor via Beszel. Add tail sampling if needed. |
| Browser bundle bloat from `@hyperdx/browser` | Low | ~80KB gzipped. Acceptable; comparable to current Sentry browser SDK. |
| Sentry feedback widget breaks during dual-run | Low | Keep `@sentry/react` installed for that one component (Phase 4 Option A). |
| HyperDX session replay PII | Low | fpp doesn't collect PII (anonymous nanoid users). Enable freely. |
| Fingerprinting workflow regression | Medium | Documented gap. Build saved dashboard query as the "issues" view. Solo-dev workflow accommodates it. |
| Cross-service trace gaps (browser → tRPC → WS → mysql) | High | Validate end-to-end in Phase 1 with a known scenario (room flip). Document the trace flow. |
| Python double-patching crash | High | Set `instrumenter='otel'` in `sentry_sdk.init()`. Documented; only matters during dual-run. |

---

## 8. Rollback strategy

Each phase is independently revertable because Sentry stays running through Phase 7. Specifically:

- **Phase 1-3 failures:** revert the `app-error.ts` internals to call `Sentry.captureException` again. Telemetry continues to Sentry uninterrupted.
- **Phase 6 (compose deploy):** if fpp-server can't reach `clickstack:4319` (e.g. monitoring-net not attached), the OTEL exporter logs warnings but doesn't crash the service. Sentry still works. Revert the compose change.
- **Phase 8 (Sentry removal):** the only one-way phase. If a critical Sentry feature is missed in dual-run, reinstall the package and revert wrapper internals. Acceptable cost: 1-2 hours.

---

## 9. Parity validation (Phase 7 acceptance criteria)

Run dual-emit. Compare daily:

| Metric | Source A | Source B | Acceptance |
|-|-|-|-|
| Error count per service per hour | Sentry Issues | HyperDX `count(severity_number>=17) GROUP BY service.name` | ±5% over 3 days |
| Root span count per route per hour | Sentry transactions | HyperDX `count() WHERE SpanKind='SERVER' GROUP BY http.route` | ±5% |
| p50 / p95 / p99 latency per route | Sentry | HyperDX `quantile()` | ±5% |
| Cross-service trace completeness | (manual) 20 known trace_ids — verify all expected service spans present | n/a | 100% |
| Source-map symbolication | Sentry | HyperDX | Same file:line resolution |
| WebSocket connection visibility | Sentry breadcrumbs | HyperDX spans | All connection open/close events present |

Sign-off when all 3-day windows pass.

---

## 10. Open questions

These need resolution during or before the relevant phase:

1. **Browser cross-origin vs. Vercel rewrite for OTLP ingest.** v1 picks cross-origin bearer (simpler). v2 could move to Vercel rewrite if same-origin / auth-injection at edge is preferred.
2. **Keep `Sentry.captureFeedback`?** Phase 4 decision. PRD leans toward keeping just for feedback widget.
3. **Drop `sentry.router.ts` page or rebuild on HyperDX?** Phase 4 decision. PRD leans toward dropping.
4. **Dedicated fpp ingestion key or share argo's `op://vps/argo/HYPERDX_API_KEY_PROD`?** Phase 0 decision. PRD recommends dedicated (`op://vps/fpp/HYPERDX_INGESTION_KEY`) for surgical rotation.
5. **mysql2 Drizzle instrumentation strategy.** Phase 2 spike: try `@kubiks/otel-drizzle` first, fall back to manual Proxy. Decision based on spike outcome.
6. **Sampling.** PRD assumes 100% sampling at fpp scale. If disk growth exceeds 1 GB/week sustained, add Collector with tail-sampling in a later phase.

---

## 11. Future work (post-migration)

Not blocking this PRD, but logical follow-ups:

- **Add OpenTelemetry Collector on VPS** for tail-sampling and resource enrichment (when disk growth demands).
- **Metrics export** (RED/USE) — currently traces + logs only.
- **Per-service ingestion keys** rotation playbook (extend the `make github-config` flow).
- **HyperDX dashboards:** room health, user join/leave funnel, vote completion rates derived from spans.
- **Span-link cron jobs to their triggers** for the analytics readmodel update.
- **Umami web analytics** (separate effort) — product analytics, not observability. Different tool, different mental model.

---

## Related

- [README](README.md)
- [01 — Sentry Audit](01-sentry-audit.md)
- [02 — Target Stack](02-target-stack.md)
- [03 — Argo Reference](03-argo-reference.md)
- [04 — Research](04-research.md)
