# 01 — Sentry Surface Audit

**Purpose:** parity checklist. Everything Sentry does for fpp today must have an OTEL → HyperDX equivalent or a documented "intentionally dropped" reason.

**Scope:** `apps/web` (Next.js 16 Pages Router on Vercel), `apps/server` (Bun/Elysia WebSocket), `fpp-analytics` (FastAPI). `@fpp/shared` and `@fpp/db` carry no Sentry — out of scope.

**Audited:** 2026-05-19. Numbers below are point-in-time; rerun the audit before cutover (Phase 9 of [PRD](PRD.md)).

---

## Aggregate counts

| Metric | apps/web | apps/server | fpp-analytics | Total |
|-|-|-|-|-|
| `@sentry/*` import statements | 6 files | 2 files | 1 wrapper | 9 |
| `captureError()` call sites | ~95 | 13 | 5 | ~131 |
| `captureMessage()` call sites | ~12 | 10 | 2 | ~19 |
| `addBreadcrumb()` call sites | ~70 | 2 | 11 | ~121 |
| Sentry-specific code (lines) | ~500 | ~180 | ~170 | ~840 |

---

## SDK versions

| Service | Package | Version |
|-|-|-|
| apps/web | `@sentry/nextjs` | 10.52.0 |
| apps/server | `@sentry/bun` | 10.52.0 |
| fpp-analytics | `sentry-sdk[fastapi]` | >=2.59.0 |

Node SDK v8+ is OTEL-based internally — relevant for [dual-run](04-research.md#6-dual-run-strategy).

---

## apps/web — Next.js 16 Pages Router

### Config files

| Path | Purpose |
|-|-|
| `instrumentation.ts` | Root instrumentation hook. Conditional runtime imports. Exports `Sentry.captureRequestError`. |
| `instrumentation-client.ts` | Browser init. DSN, `browserTracingIntegration()`, `tracePropagationTargets`, `beforeSend` PII scrub, `beforeBreadcrumb` enrichment, global `window.unhandledrejection` + `error` listeners. Exports `captureRouterTransitionStart`. |
| `sentry.server.config.ts` | Node runtime init. tracesSampleRate 0.1 prod / 1.0 dev. beforeSend PII scrub. |
| `sentry.edge.config.ts` | Vercel Edge runtime — same config as server. |
| `next.config.js` | `withSentryConfig()` wrap. sentryWebpackPluginOptions: source-map upload, `tunnelRoute: '/monitoring'`, `hideSourceMaps`, `transpileClientSDK`, `widenClientFileUpload`. |

**Replay:** disabled (commented out).
**Release tracking:** not configured.

### Error wrapper API (`apps/web/src/utils/app-error.ts`, ~208 lines)

```ts
captureError(error: Error | string | TRPCClientErrorLike, ctx?: ErrorContext, severity?: Severity): void
captureMessage(message: string, ctx?: ErrorContext, level?: 'debug'|'info'|'warning'|'error'): void
addBreadcrumb(message: string, category?: string, data?: Record<string, primitive>): void

type ErrorContext = { component?: string; action?: string; extra?: Record<string, primitive> }
type Severity = 'critical' | 'high' | 'medium' | 'low'
```

Severity mapping: `critical→fatal`, `high→error`, `medium→warning`, `low→info`.

`captureError` flow:
1. Normalize error (string → Error, TRPCClientError extracts code/httpStatus/path/zodError).
2. Log via Pino at appropriate level.
3. `Sentry.withScope()` → set severity, tags (component, action, severity), extra fields, attach breadcrumb.

### CustomTRPCError + central handler

`apps/web/src/server/api/custom-error.ts`:

```ts
class CustomTRPCError extends TRPCError {
  metadata: { component: string; action: string; extra?; severity?: Severity }
}
toCustomTRPCError(error, message, metadata)  // helper
isBusinessLogicError(error: TRPCError): boolean  // skips capture for BAD_REQUEST, NOT_FOUND, etc.
```

`apps/web/src/pages/api/trpc/[trpc].ts` central `onError` handler:
1. Branch on `CustomTRPCError` (use embedded metadata) vs generic (synthesize from `path`/`type`/`input`).
2. Call `captureError(error, ctx, 'high')`.
3. Currently captures **all** errors — business-logic filter is commented out (strict monitoring mode).

### Sentry-specific components

| File | Purpose |
|-|-|
| `components/room/sentry-context-provider.tsx` | On mount/update sets `Sentry.setUser({ id: userId })` + scope tags `roomId`, `username`. |
| `components/sidebar/sidebar-feedback.tsx` | `Sentry.captureFeedback()` for user feedback submission. Rate-limited 1/30s. |
| `store/local-storage.store.ts` | Calls `Sentry.setUser` on userId init/change. |

### Server-side router

`apps/web/src/server/api/routers/sentry.router.ts` — tRPC endpoint `sentry.getIssues` that queries Sentry's REST API (`/api/0/projects/jkrumm/{project}/issues/?statsPeriod=14d`) for three projects (`free-planning-poker`, `fpp-server`, `fpp-analytics`) and feeds the analytics page's Sentry issues table. **This component disappears at migration** — replace with a HyperDX-backed equivalent or drop entirely.

### Tag and context surface

Custom tags set: `component`, `action`, `severity`, `userId`, `roomId`, `trpcCode`, `httpStatus`, `trpcPath`.

Custom extras: `username`, `roomState`, `zodError`, `trpcInput`, `trpcOutput`.

Breadcrumb categories: `websocket`, `analytics`, `room`, `audio` (11 sites), `feedback`, `navigation`, `user` (default).

### beforeSend hooks (PII)

Both client + server strip `user.email`, `user.ip_address`, `user.geo`, `request.headers`. Client additionally filters noise (`ChunkLoadError`, WebSocket 1006, `Network request failed`, `ResizeObserver loop`) and adds `roomId`/`userId`/`username` tags from localStorage. Server additionally samples connection errors at 10%.

### Env vars

| Var | Source | Used by |
|-|-|-|
| `NEXT_PUBLIC_SENTRY_DSN` | `.env.tpl`, dev dummy | client init |
| `SENTRY_AUTH_TOKEN` | GitHub Actions only | source-map upload |
| `SENTRY_API_KEY` | `op://vps/sentry/...` | `sentry.router.ts` |

---

## apps/server — Bun + Elysia

### Init

`apps/server/src/index.ts` lines 26-56:

```ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  enabled: process.env.NODE_ENV !== 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,
  beforeSend(event) { /* PII strip + connection error sampling 10% */ },
})
// SIGTERM:
await Sentry.flush(2000)
```

### Wrapper API (`apps/server/src/utils/app-error.ts`, ~157 lines)

API-compatible with the web wrapper (same three functions, same `ErrorContext`, same severity mapping).

### Call site breakdown

| File | captureError | captureMessage | addBreadcrumb |
|-|-|-|-|
| `index.ts` (WS + HTTP + cron) | 3 | 4 | 2 |
| `message.handler.ts` | 3 | 1 | 0 |
| `room.entity.ts` | 2 | 0 | 0 |
| `room.state.ts` | 2 | 2 | 0 |
| `room.snapshot.ts` | 3 | 3 | 0 |

WebSocket lifecycle: connection-open emits one breadcrumb + captures setup exceptions; message handler emits `websocket.action` breadcrumb per message + captures handler exceptions; close handler captures abnormal close codes outside `[1000, 1001, 1005, 1006]`.

HTTP endpoints with capture: `/analytics`, `/leave`. Cron `roomState.cleanupInactiveState` every 30 min wrapped with capture on failure.

Redis snapshot persistence (room.snapshot.ts) captures connect/flush/hydrate failures.

### Env vars

| Var | Source |
|-|-|
| `SENTRY_DSN` | docker-compose-injected from `op://vps/...` |

---

## fpp-analytics — FastAPI + Python 3.14

### Init

`fpp-analytics/main.py` lifespan context manager:

```python
sentry_sdk.init(
    dsn=SENTRY_DSN,
    environment=SENTRY_ENVIRONMENT,
    traces_sample_rate=0.1,
    profiles_sample_rate=0.1,  # profiling enabled
    integrations=[FastApiIntegration(...), StarletteIntegration()],
    before_send_transaction=lambda e, h: None if e.get("transaction") == "/health" else e,
)
# Shutdown:
sentry_sdk.flush(timeout=2.0)
```

Gated by `SENTRY_ENVIRONMENT == 'production'` — dev does not init.

### Wrapper (`fpp-analytics/util/sentry_wrapper.py`, ~169 lines)

```python
def capture_error(error, context: ErrorContext, severity: SeverityLevel = "high") -> None
def add_error_breadcrumb(message, category, data=None, level="info") -> None
```

Always logs via Python `logging`. Sends to Sentry only in production. Severity mapping same as web/server wrappers.

### Coverage

| Site | captureError | breadcrumb |
|-|-|-|
| `routers/analytics.py` GET `/` | 1 | 1 |
| `routers/analytics.py` GET `/daily-analytics` | 1 | 2 |
| `routers/room.py` GET `/room/{id}/stats` | 1 | 1 |
| `main.py` global_exception_handler | 1 (severity `critical`) | 0 |
| `update_readmodel.py` | 1 | 1 |

Global handler returns `JSONResponse(status_code=500, content={"detail": "Internal server error"})`. HTTPException (business-logic) bypasses Sentry capture.

### Env vars

| Var | Source |
|-|-|
| `FPP_ANALYTICS_SENTRY_DSN` | docker-compose env / op |
| `SENTRY_ENVIRONMENT` | `'production'` or `'development'` |

---

## Migration parity checklist (must preserve)

### Functional

- [ ] All ~131 `captureError` sites — preserve component/action/extra context.
- [ ] All ~19 `captureMessage` sites — preserve severity.
- [ ] All ~121 `addBreadcrumb` sites — see [research §5.4](04-research.md#54-breadcrumb-mapping) for recommended mapping (LogRecord per breadcrumb keyed by trace_id).
- [ ] PII scrub (`email`, `ip_address`, `geo`, `headers`) at processor level.
- [ ] User context (`userId`, `roomId`, `username`) on every span/log.
- [ ] tRPC error path: `CustomTRPCError` metadata → OTEL span attributes.
- [ ] Source-map symbolication for client errors (HyperDX CLI upload, see [research §1.5](04-research.md#15-source-maps-without-sentry)).
- [ ] Graceful shutdown flush (`Sentry.flush(2000)` → `tracerProvider.forceFlush()` + `loggerProvider.forceFlush()`).
- [ ] WebSocket lifecycle visibility (open / message / abnormal close).
- [ ] Cron job error capture.
- [ ] Redis snapshot persistence visibility.

### Intentionally dropping

- [ ] Sentry tunnel route `/monitoring` — not needed, OTLP HTTP is native.
- [ ] `sentry.router.ts` REST integration — replace with HyperDX query or drop.
- [ ] `Sentry.captureFeedback()` user feedback flow — needs separate decision (keep Sentry just for feedback? Or replace with a webhook?). See [PRD open questions](PRD.md#10-open-questions).
- [ ] Auto-issue grouping / fingerprinting — no native HyperDX equivalent ([research §5.5](04-research.md#55-fingerprinting-gap)). Workflow change required.

### Env-var renames

| Old | New |
|-|-|
| `NEXT_PUBLIC_SENTRY_DSN` | (none — Next.js uses `OTEL_EXPORTER_OTLP_*` server-side, plus `NEXT_PUBLIC_HYPERDX_API_KEY` for browser SDK) |
| `SENTRY_AUTH_TOKEN` | `HYPERDX_SERVICE_KEY` (source-map upload) |
| `SENTRY_DSN` (server) | `OTEL_EXPORTER_OTLP_ENDPOINT` |
| `FPP_ANALYTICS_SENTRY_DSN` | `OTEL_EXPORTER_OTLP_ENDPOINT` |
| `SENTRY_ENVIRONMENT` | `OTEL_RESOURCE_ATTRIBUTES=deployment.environment=...` |

---

## High-risk areas

| Area | Risk | Mitigation |
|-|-|-|
| WebSocket error tracking | Message-handler exceptions lost if Elysia plugin doesn't auto-record them | Verify Elysia `.onError()` hook + manual `recordException()` per [Argo reference §5](03-argo-reference.md#5-elysia-specific-instrumentation). |
| Vercel cold starts | `BatchSpanProcessor` drops spans on lambda exit | Use `SimpleSpanProcessor` via `@vercel/otel`. |
| Python double-patching | `opentelemetry-instrument` + Sentry SDK crashes with `AttributeError` | Set `instrumenter='otel'` in `sentry_sdk.init()` during dual-run, see [research §6.2](04-research.md#62-python--double-patching-crashes). |
| Sampler misconfig | Errors lost under 5% sample rate | Tail-sample at Collector: always pass `status_code=ERROR`, see [research §5.6](04-research.md#56-sampling-parity). |
| Feedback widget | `Sentry.captureFeedback` has no obvious OTEL replacement | Triage during Phase 4 — likely keep Sentry just for this, or build a webhook → Discord/email. |

---

## Related

- [02 — Target Stack](02-target-stack.md): where this all ships to.
- [03 — Argo Reference](03-argo-reference.md): the template for fpp-server.
- [04 — Research](04-research.md): latest OTEL/HyperDX state and Sentry-replacement semantics.
- [PRD](PRD.md): execution plan.
