# 03 — Argo Reference Implementation

**Purpose:** Argo's stack (Elysia + Bun + Postgres + Drizzle) is structurally identical to fpp-server. Its OTEL integration is the template — copy the pattern, not the code.

**Source:** `~/SourceRoot/argo/apps/api/`.

**Stance:** Argo uses **pure OTEL SDK**, not `@hyperdx/node-opentelemetry`. Keeps the stack vendor-agnostic. ClickStack speaks plain OTLP — no SDK wrapper needed.

---

## File layout

```text
apps/api/
├── src/
│   ├── telemetry.ts          # resource, tracer, logger, telemetryConfig, log helper
│   ├── index.ts              # Elysia app — plugin mount, CORS, onError hook
│   ├── env.ts                # OTEL_* env vars
│   ├── lib/traced-fetch.ts   # fetch wrapper with CLIENT spans + W3C injection
│   ├── db/index.ts           # Drizzle instrumentation
│   └── cron/                 # tracedTick helper, ROOT_CONTEXT wrapping
├── .env.local.tpl            # OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4319
├── Dockerfile                # nothing OTEL-specific
└── package.json
```

---

## 1. Package versions

```jsonc
{
  "@opentelemetry/api": "^1.9.1",
  "@opentelemetry/api-logs": "^0.217.0",
  "@opentelemetry/sdk-trace-base": "^2.7.1",
  "@opentelemetry/sdk-logs": "^0.217.0",
  "@opentelemetry/exporter-trace-otlp-proto": "^0.217.0",
  "@opentelemetry/exporter-logs-otlp-proto": "^0.217.0",
  "@opentelemetry/resources": "^2.0.0",
  "@elysiajs/opentelemetry": "^1.4.11",
  "@kubiks/otel-drizzle": "^2.1.0"
}
```

**No** `@opentelemetry/auto-instrumentations-node`. Argo enables exactly one auto-instrumentation: Drizzle. Everything else is handled by the Elysia plugin or manual spans. This is deliberate — see [research §2.3](04-research.md#23-auto-instrumentation-packages-that-break-under-bun) on Bun's broken Node auto-instrumentations.

---

## 2. Resource attributes

`src/telemetry.ts`:

```ts
export const resource = resourceFromAttributes({
  'service.name': env.OTEL_SERVICE_NAME,                 // 'argo-api'
  'service.version': env.OTEL_SERVICE_VERSION || pkg.version,
  'deployment.environment': env.NODE_ENV,                // development|test|production
})
```

Minimal by design. Per-span attributes (`user.id`, `room.id`, etc.) layered on top via `span.setAttribute()`.

---

## 3. Exporter

OTLP **protobuf over HTTP** (not gRPC):

```ts
const base = env.OTEL_EXPORTER_OTLP_ENDPOINT

new BatchSpanProcessor(new OTLPTraceExporter({ url: `${base}/v1/traces` }))
new BatchLogRecordProcessor(new OTLPLogExporter({ url: `${base}/v1/logs` }))
```

SDK appends `/v1/traces` and `/v1/logs` to the base URL. No auth header (`:4319` is unauthed). Default batch settings (512 records or timeout).

---

## 4. Elysia plugin

`src/index.ts`:

```ts
import { opentelemetry } from '@elysiajs/opentelemetry'

new Elysia()
  .use(opentelemetry({
    ...telemetryConfig,
    checkIfShouldTrace: (req) => {
      const u = new URL(req.url)
      return u.pathname !== '/'
          && u.pathname !== '/health'
          && !u.pathname.startsWith('/openapi')
    },
  }))
  .use(cors({
    origin: [...],
    allowedHeaders: [
      'Authorization', 'Content-Type',
      'traceparent', 'tracestate', 'baggage',   // ← critical
    ],
  }))
  .onError(({ error }) => {
    const span = trace.getActiveSpan()
    if (span) {
      span.recordException(error as Error)
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) })
    }
  })
```

The plugin **must mount first** so trace context exists in subsequent middleware.

`traceparent` / `tracestate` / `baggage` in CORS `allowedHeaders` is mandatory — without them, browser preflight strips W3C context and frontend/backend traces diverge.

---

## 5. Drizzle instrumentation

`src/db/index.ts`:

```ts
import { instrumentDrizzleClient } from '@kubiks/otel-drizzle'

export const db = instrumentDrizzleClient(
  drizzle(client, { schema }),
  { dbSystem: 'postgresql' }   // for fpp use 'mysql'
)
```

Captures `db.statement`, `db.operation`, `db.system`. **Do not** manually wrap Drizzle calls in `tracer.startActiveSpan()` — causes double-instrumentation. To add context, set attributes on the *active* span:

```ts
trace.getActiveSpan()?.setAttribute('argo.user_id', userId)
await db.select().from(workouts).where(eq(workouts.user_id, userId))
```

**fpp risk:** `@kubiks/otel-drizzle` Bun compatibility not documented. Worked for Argo (Bun); validate during Phase 2 with a spike before committing.

---

## 6. Structured logger with trace correlation

`src/telemetry.ts`:

```ts
export const log = {
  debug(message, attributes?) { console.debug(...); emit('debug', message, attributes) },
  info(message, attributes?)  { console.info(...);  emit('info',  message, attributes) },
  warn(message, attributes?)  { console.warn(...);  emit('warn',  message, attributes) },
  error(message, err?, attributes?) {
    const errAttrs = err instanceof Error
      ? {
          'exception.type': err.name,
          'exception.message': err.message,
          'exception.stacktrace': err.stack ?? '',
        }
      : err !== undefined ? { 'exception.message': String(err) } : {}
    console.error(...)
    emit('error', message, { ...errAttrs, ...attributes })
  },
}
```

`emit()` calls `LoggerProvider.emit()`. The SDK automatically attaches `trace_id` + `span_id` from the active context — no manual injection needed. Log records appear in HyperDX correlated with their trace.

Severity mapping: `debug→DEBUG`, `info→INFO`, `warn→WARN`, `error→ERROR`. See [research §5.3](04-research.md#53-severitynumber-mapping-for-current-sentry-severities) for FPP's `critical/high/medium/low` → SeverityNumber mapping.

---

## 7. Traced fetch helper

`src/lib/traced-fetch.ts`:

```ts
export async function tracedFetch(input, init?): Promise<Response> {
  return tracer.startActiveSpan(`${method} ${hostname}${pathname}`, {
    kind: SpanKind.CLIENT,
    attributes: {
      'http.request.method': method,
      'url.full': url,
      'server.address': hostname,
      'url.scheme': scheme,
    },
  }, async (span) => {
    const headers = { ...init?.headers }
    propagation.inject(context.active(), headers)        // ← W3C injection
    try {
      const res = await fetch(input, { ...init, headers })
      if (res.status >= 400) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${res.status}` })
      }
      return res
    } catch (err) {
      span.recordException(err as Error)
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) })
      throw err
    } finally {
      span.end()
    }
  })
}
```

**Mandatory** for outbound HTTP in Bun. Bun uses native `fetch`, not undici, so `@opentelemetry/instrumentation-undici` doesn't fire. Without `tracedFetch`, the cross-service call from `fpp-server` → Next.js `/api/trpc/room.trackFlip` won't propagate trace context.

---

## 8. Traced cron tick

`cron/garmin-sync.ts`:

```ts
async function tracedTick(name, attributes, fn) {
  await context.with(ROOT_CONTEXT, () =>
    tracer.startActiveSpan(name, { kind: SpanKind.INTERNAL, attributes }, async (span) => {
      try {
        await fn()
        span.setStatus({ code: SpanStatusCode.OK })
      } catch (err) {
        span.recordException(err as Error)
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) })
        throw err
      } finally {
        span.end()
      }
    }),
  )
}
```

`context.with(ROOT_CONTEXT, ...)` creates a fresh trace per tick — otherwise the cron span chains under whatever trace happened to be active. Naming convention: `cron.<job>.<flavor>` (e.g. `cron.room-cleanup.scheduled`).

fpp's `roomState.cleanupInactiveState` (every 30 min) maps directly to this pattern.

---

## 9. Env vars

`.env.local.tpl`:

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4319
OTEL_SERVICE_NAME=argo-api
NODE_ENV=development
```

Production: same vars, `OTEL_EXPORTER_OTLP_ENDPOINT=http://clickstack:4319` (set via compose).

**Notably absent:**
- `OTEL_EXPORTER_OTLP_HEADERS` (no auth on `:4319`)
- `OTEL_TRACES_SAMPLER` (uses default AlwaysOn)
- `OTEL_EXPORTER_OTLP_PROTOCOL` (defaults to HTTP, which is correct)

---

## 10. Sampler

Default: AlwaysOn. 100% of traces sampled. Appropriate for low-traffic personal apps. At fpp scale (~10-100 spans/sec, mostly WS heartbeats), consider sampling — see [research §5.6](04-research.md#56-sampling-parity).

---

## 11. Things Argo deliberately doesn't do

- ❌ `@opentelemetry/instrumentation-fs` — hangs the Bun runtime (documented in Argo's observability.md).
- ❌ HyperDX-specific SDKs.
- ❌ Auto-instrumentation bundle.
- ❌ Metrics export. Traces + logs only.
- ❌ NODE_OPTIONS preload or bunfig.toml — `telemetry.ts` is just imported synchronously before the Elysia app.

---

## 12. Apply-to-fpp checklist

For fpp-server, copy this structure:

- [ ] Create `apps/server/src/telemetry.ts` — resource (service.name=`fpp-server`, service.version from package.json, deployment.environment from `NODE_ENV`), `BatchSpanProcessor` + OTLP exporter, `BatchLogRecordProcessor` + OTLP log exporter, exported `tracer`, `log` helper.
- [ ] Create `apps/server/src/lib/traced-fetch.ts` — copy verbatim, adjust attribute names if needed.
- [ ] In `apps/server/src/index.ts`:
  - Import `./telemetry` first (before Sentry init if dual-running).
  - `.use(opentelemetry({ ...telemetryConfig, checkIfShouldTrace: req => !['/', '/health'].includes(new URL(req.url).pathname) }))` — mount first.
  - Existing `.onError` already captures via Sentry wrapper; add OTEL span exception recording inside `captureError`.
  - Add CORS `allowedHeaders: [..., 'traceparent', 'tracestate', 'baggage']` if/when CORS is configured.
- [ ] Wrap mysql2-via-Drizzle with `instrumentDrizzleClient(db, { dbSystem: 'mysql' })`. **Spike this first** — kubiks/otel-drizzle Bun compat unverified for MySQL.
- [ ] Replace direct `fetch(...)` to Next.js `room.trackFlip` with `tracedFetch(...)`.
- [ ] Wrap `roomState.cleanupInactiveState` cron in `tracedTick('cron.room-cleanup.scheduled', { ... }, fn)`.
- [ ] Add to `.env.tpl`: `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4319` (dev) / `http://clickstack:4319` (prod), `OTEL_SERVICE_NAME=fpp-server`.
- [ ] In `apps/server/Dockerfile`: no changes needed.

For fpp-analytics, see [research §3](04-research.md#3-python-fastapi) — Python pattern is similar (resource + exporter + `FastAPIInstrumentor.instrument_app()`).

For apps/web, see [research §1](04-research.md#1-nextjs-16-pages-router-on-vercel) — different stack (Vercel + `@vercel/otel`), not Argo-shaped.

---

## Related

- [01 — Sentry Audit](01-sentry-audit.md)
- [02 — Target Stack](02-target-stack.md)
- [04 — Research](04-research.md)
- [PRD](PRD.md)
