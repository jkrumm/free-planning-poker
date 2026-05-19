# 04 — Latest OTEL / HyperDX / Sentry-Replacement Research

**Research dates:** 2026-05-19. Knowledge cutoff is mid-2025; every version pin and API signature below was verified via Context7, WebFetch, and WebSearch against authoritative docs.

**Confidence legend:** **HIGH** = primary source confirmed; **MEDIUM** = multiple-source cross-reference; **EXTRAPOLATED** = inferred, marked inline.

---

## 0. Executive snapshot

| Service | SDK choice | Auto-instrumentation viability | Exporter |
|-|-|-|-|
| Next.js 16 (Vercel) | `@vercel/otel` 2.1.2 + OTel JS SDK 2.x | Strong — Pages Router root spans auto-emit | OTLP HTTP only (`:4318`) |
| Bun + Elysia 1.4 | `@elysiajs/opentelemetry` 1.4.12 + OTel JS SDK 2.x | Partial — Elysia plugin OK, Node auto-instrumentations unreliable on Bun | OTLP HTTP or gRPC |
| FastAPI (Python 3.14) | `opentelemetry-sdk` 1.42.0 + `opentelemetry-instrumentation-fastapi` 0.63b0 | Strong (manual `instrument_app()`) — `opentelemetry-bootstrap` broken with `uv` | OTLP gRPC preferred |

**Backend:** ClickStack (HyperDX v2, acquired by ClickHouse Inc. mid-2025). Self-hosted local Docker compose, prod via VPS — see [02-target-stack](02-target-stack.md).

**Replacing Sentry feasible** with one gap: **no automatic error fingerprinting / issue inbox**. Engineering process change.

**Dual-run:** clean for Node/Bun (Sentry v8+ uses OTEL internally). Python needs `instrumenter='otel'` in `sentry_sdk.init()` to avoid hard crash.

---

## 1. Next.js 16 Pages Router on Vercel

### 1.1 SDK choice — `@vercel/otel` vs vanilla `@opentelemetry/sdk-node`

**Recommendation:** `@vercel/otel` 2.1.2. Wraps OTel JS SDK 2.x. Initializes both Node and Edge runtimes via `instrumentation.ts`. Respects standard OTEL env vars so backend switching is zero-code.

| | `@vercel/otel` | `@opentelemetry/sdk-node` |
|-|-|-|
| Edge runtime | Works | Node-only — needs `if (process.env.NEXT_RUNTIME === 'nodejs')` guard |
| Cold-start flush | Auto `SimpleSpanProcessor` on Vercel | Manual; `BatchSpanProcessor` loses spans on lambda exit |
| Exporter setup | Pre-wired | DIY (exporter + processor + provider + propagator + contextManager) |

`experimental.instrumentationHook` was removed in Next.js 15+. Delete from `next.config.js`. Next.js 16 auto-detects `instrumentation.ts`.

**Vercel cold start:** **never** `BatchSpanProcessor` in serverless. `@vercel/otel` does the right thing. **Never** `@opentelemetry/exporter-trace-otlp-grpc` — pulls in Node stream APIs that break Edge builds. Use `@opentelemetry/exporter-trace-otlp-http`, port 4318.

### 1.2 Auto-emitted Pages Router spans

Out of the box:

- `[http.method] [route]` root spans
- `next.getServerSideProps`
- `next.getStaticProps`
- `next.render.[pages]`
- `next.runMiddleware`

Set `NEXT_OTEL_VERBOSE=1` for additional internal spans.

### 1.3 tRPC v11 instrumentation

No official package. The community `@baselime/trpc-opentelemetry-middleware` (v0.1.2, Dec 2023) predates tRPC v11 and is abandoned. **Write it manually:**

```typescript
import { trace, SpanStatusCode } from '@opentelemetry/api'

const tracer = trace.getTracer('trpc')

export const otelMiddleware = t.middleware(async ({ path, type, next }) => {
  return tracer.startActiveSpan(`trpc.${type}.${path}`, async (span) => {
    try {
      const result = await next()
      if (!result.ok) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: result.error.message })
        span.recordException(result.error)
      }
      return result
    } finally {
      span.end()
    }
  })
})
```

**Span naming convention:** `trpc.{type}.{path}` — e.g. `trpc.mutation.room.trackFlip`. Industry pattern.

**Client-side propagation** — wrap the tRPC link's `fetch`:

```typescript
import { propagation, context } from '@opentelemetry/api'

httpBatchLink({
  url: '/api/trpc',
  fetch: (url, options) => {
    const headers = { ...options?.headers }
    propagation.inject(context.active(), headers)
    return fetch(url, { ...options, headers })
  },
})
```

**Batch gotcha:** `httpBatchLink` aggregates procedures into one HTTP request. The trace context applies to the outer HTTP span; per-procedure spans on the server are children of that batch span. For fpp, batched is fine.

### 1.4 Browser-side OTEL

**Use `@hyperdx/browser` 0.23.1.** Wraps `@opentelemetry/sdk-trace-web` plus session replay, Web Vitals as OTEL spans, React Error Boundary attachment.

```typescript
import HyperDX from '@hyperdx/browser'

HyperDX.init({
  apiKey: process.env.NEXT_PUBLIC_HYPERDX_API_KEY,
  service: 'free-planning-poker-web',
  tracePropagationTargets: [/api\/trpc/, /fpp-server/],
  consoleCapture: true,
  advancedNetworkCapture: true,
})
```

`tracePropagationTargets` injects W3C `traceparent` into matching fetches → end-to-end browser → tRPC → backend traces.

### 1.5 Source maps without Sentry

OTEL has **no native source-map story**. HyperDX CLI fills the gap:

```bash
npx @hyperdx/cli upload-sourcemaps \
  --serviceKey $HYPERDX_SERVICE_KEY \
  --path .next
```

`HYPERDX_SERVICE_KEY` is **distinct** from the ingestion key. Add as Vercel build env, run upload post-`next build` pre-deploy.

### 1.6 Package pins

```jsonc
"@vercel/otel": "^2.1.2",
"@opentelemetry/api": "^1.9.0",
"@opentelemetry/api-logs": "^0.205.0",
"@opentelemetry/sdk-logs": "^0.205.0",
"@opentelemetry/exporter-logs-otlp-http": "^0.205.0",
"@opentelemetry/exporter-trace-otlp-http": "^0.205.0",
"@opentelemetry/semantic-conventions": "^1.32.0",
"@hyperdx/browser": "^0.23.1",
"@hyperdx/cli": "latest"
```

OTel JS SDK 2.x (Feb 2025) bumped stable ≥2.0, experimental ≥0.200. Min Node ≥18.19 or ≥20.6.

**Confidence: HIGH.** Sources: nextjs.org/docs/pages/guides/instrumentation, opentelemetry.io/blog/2025/otel-js-sdk-2-0/, hyperdx.io/docs/install/next.

---

## 2. Bun + Elysia

### 2.1 `@elysiajs/opentelemetry` plugin

**Latest: 1.4.12** (matches Elysia 1.4). One-line install:

```typescript
new Elysia().use(opentelemetry({ /* config */ })).listen(7721)
```

Auto-creates parent-child spans for HTTP request lifecycle. Use **named functions** in handlers — arrow functions yield anonymous span names.

**Breaking change from 1.1.7:** auto-Node-instrumentation removed from defaults. Must explicitly pass `instrumentations: [getNodeAutoInstrumentations(...)]` and disable the broken ones (§2.3).

### 2.2 Bun runtime gotchas

Bun has **no native runtime instrumentation hooks** (bun#7185, open since 2023, still open 2026). Consequences:

- `NODE_OPTIONS=--require ./otel.js` is unreliable. Use `bunfig.toml`: `preload = ["./src/instrumentation.ts"]` — or import the OTEL setup module as the very first line of `index.ts`.
- `Bun.serve`, `bun:sqlite`, `Bun.SQL`, native file I/O — no OTEL instrumentation. Manual spans only.

### 2.3 Auto-instrumentations that break under Bun

Bun bug #26536 (open 2026):

| Package | Bun status |
|-|-|
| `@opentelemetry/instrumentation-express` | requestHook does not fire |
| `@opentelemetry/instrumentation-fastify` | requestHook does not fire |
| `@opentelemetry/instrumentation-http` | partial — high-cardinality span names (`GET /user/123` not `GET /user/:id`) |
| `@opentelemetry/instrumentation-undici` | Bun uses native fetch, not undici |
| `@opentelemetry/instrumentation-fs` | hangs Bun runtime |

The Elysia plugin sidesteps this by instrumenting at plugin layer, not via Node monkey-patching. Disable explicitly:

```typescript
getNodeAutoInstrumentations({
  '@opentelemetry/instrumentation-fs': { enabled: false },
  '@opentelemetry/instrumentation-express': { enabled: false },
  '@opentelemetry/instrumentation-fastify': { enabled: false },
  '@opentelemetry/instrumentation-undici': { enabled: false },
})
```

### 2.4 WebSocket span semantics — *EXTRAPOLATED*

OTEL messaging semconv covers Kafka, RabbitMQ, SQS, SNS only. WebSocket is unspecified. Community convention:

- **One SERVER span per connection upgrade.** Attributes: `messaging.system=websocket`, `messaging.destination=<roomId>`, `enduser.id=<userId>`.
- **Per-message INTERNAL child spans** for each WS action. Attributes: `messaging.operation=receive`, `fpp.action=<action>`.
- Outbound broadcasts: PRODUCER spans, also children of connection span.

**fpp pragmatic recommendation:**

- Rooms are short-lived (minutes). Span-per-connection works.
- **Don't** span-per-message for heartbeats / presence — too noisy. Emit log records keyed by the connection's trace_id.
- **Do** span the meaningful actions: `selectEstimation`, `flip`, `reset`, `userJoined`, `userLeft`.

### 2.5 mysql2 / Drizzle on Bun

`@opentelemetry/instrumentation-mysql2` relies on monkey-patching `mysql2`. Under Bun, mysql2 itself runs (Bun#16501 is Windows-only); whether the monkey-patch fires reliably is **undocumented**.

**Recommendation: `@kubiks/otel-drizzle`.** Instruments the Drizzle client directly via `instrumentDrizzleClient(db, { dbSystem: 'mysql' })`. Captures `db.operation`, `db.statement`, `db.system`, `db.name`. Argo uses it on Bun + Postgres successfully. fpp would be first to test the MySQL flavor — **spike before committing** (PRD Phase 2).

**Fallback:** Manual Proxy wrap of mysql2's `execute`/`query` methods with `tracer.startActiveSpan('mysql.query', ...)`. Most reliable Bun-compatible approach.

(Note: fpp-server itself doesn't talk to MySQL directly — that's Next.js. fpp-server does HTTP `fetch` to Next.js. So this matters for apps/web, not the WS server.)

### 2.6 Cross-service `fetch` instrumentation

Bun's native `fetch` is not undici. Manual `traceparent` injection mandatory — see [Argo reference §7](03-argo-reference.md#7-traced-fetch-helper).

**Confidence: MEDIUM.** Bun ecosystem still maturing. Sources: elysiajs.com/patterns/opentelemetry, github.com/oven-sh/bun/issues/26536, docs.kubiks.ai/opentelemetry-integrations/otel-drizzle.

---

## 3. Python FastAPI

### 3.1 Versions

| Package | Pin | Notes |
|-|-|-|
| `opentelemetry-api` | `>=1.42.0` | Python ≥3.10 |
| `opentelemetry-sdk` | `>=1.42.0` | |
| `opentelemetry-exporter-otlp-proto-grpc` | `>=1.42.0` | gRPC preferred (long-lived process) |
| `opentelemetry-instrumentation-fastapi` | `>=0.63b0` | Still beta — version offset (0.6x ↔ 1.4x) |
| `opentelemetry-instrumentation-dbapi` | `>=0.63b0` | For clickhouse-driver if needed |
| `opentelemetry-instrumentation-logging` | `>=0.63b0` | Adds trace_id/span_id to log records |

Python 3.14 implicit support (≥3.10 floor).

### 3.2 Manual instrumentation

Prefer `FastAPIInstrumentor.instrument_app()` over `opentelemetry-instrument` CLI auto-instrument — keeps control over hooks and excluded URLs.

```python
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

app = FastAPI()
FastAPIInstrumentor.instrument_app(
    app,
    excluded_urls="health,metrics",
)
```

### 3.3 `uv` + `opentelemetry-bootstrap` is broken

`opentelemetry-bootstrap --action=install` hardcodes `pip`. `uv` venvs don't include pip → `ModuleNotFoundError`.

**Workaround:** generate the list in a throwaway pip venv, then add to `pyproject.toml`:

```bash
opentelemetry-bootstrap --action=requirements > otel-requirements.txt
# Add listed packages to pyproject.toml manually, then:
uv sync
```

### 3.4 Logging bridge (python-json-logger coexistence)

Both handlers attach to the same root logger and process the same `LogRecord` — no conflict.

```python
from opentelemetry._logs import set_logger_provider
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter

provider = LoggerProvider()
provider.add_log_record_processor(BatchLogRecordProcessor(OTLPLogExporter()))
set_logger_provider(provider)

otel_handler = LoggingHandler(level=logging.INFO, logger_provider=provider)
logging.getLogger().addHandler(otel_handler)
# python-json-logger handler stays attached separately for stdout
```

Direct OTLP preferred over file-tail via collector.

### 3.5 ClickHouse client tracing (if needed later)

- `clickhouse-driver` (DB-API 2.0): wrap with `opentelemetry-instrumentation-dbapi.trace_integration()`.
- `clickhouse-connect` (HTTP, not DB-API): no built-in OTEL. Manual spans. ClickHouse server natively accepts W3C `traceparent` → forward via `custom_headers`.

**Confidence: HIGH.** Sources: pypi.org/project/opentelemetry-sdk/, opentelemetry-python-contrib.readthedocs.io/, opentelemetry.io/docs/zero-code/python/, github.com/open-telemetry/opentelemetry-python/issues/4809.

---

## 4. ClickStack + HyperDX state (2026)

### 4.1 Branding

HyperDX acquired by ClickHouse Inc. mid-2025. Rebranded as **ClickStack** (the all-in-one platform). `hyperdx` brand preserved for the UI/product. ClickHouse Inc. maintains canonical Docker images and Helm charts.

### 4.2 Ingestion ports

| Port | Protocol | Use |
|-|-|-|
| 4317 | OTLP gRPC | long-lived services (Bun, FastAPI) |
| 4318 | OTLP HTTP | serverless (Vercel) |
| 24225 | Fluentd | legacy |
| 13133 | healthcheck | Uptime Kuma |
| 8080 | UI | HyperDX web |

Cloud: `in-otel.hyperdx.io` with `authorization` header.

Self-hosted (fpp's case): no API key locally; first-visit UI signup.

### 4.3 Docker quickstart

```bash
git clone https://github.com/ClickHouse/ClickStack.git
cd ClickStack
docker compose up -d
```

Image: `docker.hyperdx.io/hyperdx/hyperdx-all-in-one:v2`. fpp VPS uses the **ClickHouse-branded** `clickhouse/clickstack-all-in-one:latest` — see [02-target-stack §What's running](02-target-stack.md#whats-running).

| Profile | RAM | CPU | Disk |
|-|-|-|-|
| Dev | 4 GB | 2 cores | 20 GB |
| Prod (medium) | 16 GB | 8 cores | 500 GB SSD |
| High scale | 64+ GB | 16+ cores | S3 tiered |

### 4.4 Source map upload

```bash
npx @hyperdx/cli upload-sourcemaps --serviceKey $HYPERDX_SERVICE_KEY --path .next
```

Service key distinct from ingestion key.

### 4.5 Session replay

DOM mutations + mouse/keyboard/scroll + console logs + XHR/Fetch/WebSocket + JS exceptions. Stored in `hyperdx_sessions` ClickHouse table. Bidirectional linking: session ↔ trace.

**Parity gaps vs Sentry Replay:**
- No rage-click / dead-click detection.
- No automatic "first session of new user" grouping.
- Masking only via `maskAllInputs`, `maskAllText` — per-element data-attribute masking *EXTRAPOLATED* not supported (docs don't show it).

### 4.6 Trace-to-log correlation

Shared `trace_id` and `span_id` columns on logs and traces tables. UI surfaces bidirectional links automatically.

```sql
SELECT Body, SeverityText
FROM otel_logs
WHERE TraceId = '<trace_id>'
ORDER BY Timestamp;
```

### 4.7 Alerts

| Type | Trigger | Channels |
|-|-|-|
| Search-based | SQL/Lucene query + count threshold over window, optional grouping | Slack, PagerDuty, webhook |
| Chart-based | Dashboard metric threshold | Same |

Backed by ClickHouse materialized views.

**Confidence: HIGH.** Sources: github.com/hyperdxio/hyperdx, clickhouse.com/docs/use-cases/observability/clickstack/, hyperdx.io/docs/.

---

## 5. Replacing Sentry semantics

### 5.1 Mapping table

| Sentry primitive | OTEL primitive | HyperDX surface |
|-|-|-|
| `captureException(err)` | `span.recordException(err)` + `span.setStatus(ERROR)` (in-trace) OR LogRecord with `exception.*` attrs + `SeverityNumber=ERROR` (standalone) | Errors tab, alerts |
| `captureMessage(msg, level)` | LogRecord with `SeverityNumber` | Logs tab |
| `addBreadcrumb(b)` | `span.addEvent('breadcrumb', attrs)` OR LogRecord on same trace_id | Trace timeline events |
| `Sentry.setUser({ id })` | `span.setAttribute('enduser.id', userId)` | Filter by enduser.id |
| Tags | Span attributes (request-scoped) OR Resource attributes (process-scoped) | Filter / group |
| Fingerprinting | **No native equivalent** — manual `GROUP BY` | Custom alert query |
| Release tracking | `service.version` Resource attribute | Group/filter |
| Sample rates | `ParentBased(TraceIdRatioBased)` SDK + tail-sampler at Collector | Collector-side |
| Performance (transactions) | Spans + RED metrics | Dashboards |
| Issue alerts | Search-based alerts | Partial parity |

### 5.2 Exception signalling — spec migration

OTEL is mid-migration. Spec status 2026:

- **Old (still default):** exception as span event named `exception` with `exception.type`, `exception.message`, `exception.stacktrace`.
- **New (preferred):** LogRecord with same attributes and SeverityNumber. Span event approach **deprecated** but not removed.

Migration gated by env var:

```text
OTEL_SEMCONV_EXCEPTION_SIGNAL_OPT_IN=logs       # log-only
OTEL_SEMCONV_EXCEPTION_SIGNAL_OPT_IN=logs/dup   # dual-emit during migration
```

**Recommendation:** start with `logs/dup` to validate HyperDX surfaces both, switch to `logs` once confirmed.

### 5.3 SeverityNumber mapping for current Sentry severities

`captureError(error, ctx, severity)` wrapper maps as:

| fpp severity | OTEL SeverityNumber | SeverityText |
|-|-|-|
| `'critical'` | 21 | FATAL |
| `'high'` | 17 | ERROR |
| `'medium'` | 13 | WARN |
| `'low'` | 9 | INFO |

**Biggest refactor lever:** wrap this in the existing `captureError` shim. Call-sites don't change — just the implementation flips from `Sentry.captureException` to OTEL log emission.

### 5.4 Breadcrumb mapping

Three approaches:

1. **Span events on a long-lived span.** `span.addEvent('breadcrumb', { ...data })`. Loses "last 50 events before crash" because span events aren't queryable independently.
2. **Standalone LogRecord per breadcrumb.** Keyed by `trace_id`. Query in HyperDX with `trace_id=X AND severity_number<=INFO`. Most flexible.
3. **Buffered in-memory, flushed as span attributes on error.** Closest to Sentry, custom code.

**Recommendation: approach (2).** fpp already uses Pino. Those logs become OTEL log records when the Pino→OTEL bridge is wired. The 121 sites currently calling `addBreadcrumb()` can switch to `logger.info('...', { ...data })` and gain trace_id correlation.

### 5.5 Fingerprinting gap

Sentry auto-groups errors via ML heuristics (stacktrace top frame, message similarity). HyperDX **does not** do this — query `exception.type` and `exception.message` via SQL `GROUP BY`.

Mitigations:

- HyperDX "Event Patterns" feature ML-clusters log patterns. Useful for noise, not per-error inbox.
- Saved dashboard: `SELECT exception_type, count() FROM otel_logs WHERE severity_number>=17 GROUP BY exception_type ORDER BY count() DESC`.
- Alerts: search-based grouped by `exception.type` with threshold ("count >= 5 over 5m").

**This is the biggest functional regression.** Document in PRD. Triage workflow changes (no resolved/ignored state, no assignees). For a solo dev project the regression is acceptable.

### 5.6 Sampling parity

Sentry has one `tracesSampleRate`. OTEL needs two layers:

**SDK head-based:**

```typescript
import { TraceIdRatioBasedSampler, ParentBasedSampler } from '@opentelemetry/sdk-trace-base'

const sampler = new ParentBasedSampler({
  root: new TraceIdRatioBasedSampler(0.05),   // 5% of new traces
})
```

**Collector tail-based (guarantees 100% error capture):**

```yaml
processors:
  tail_sampling:
    decision_wait: 10s
    policies:
      - name: errors
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: slow
        type: latency
        latency: { threshold_ms: 1000 }
      - name: baseline
        type: probabilistic
        probabilistic: { sampling_percentage: 5 }
```

Mirrors Sentry's "always capture errors + X% normal" behavior. **For fpp v1 the SDK sample rate of 1.0 is fine** — low traffic. Add tail sampling later if disk growth demands.

### 5.7 User context (PII)

OTEL JS/Python SDKs don't enforce PII restrictions. fpp's nanoid(21) user IDs are anonymous — set freely via `span.setAttribute('enduser.id', userId)`. Propagate cross-service via Baggage if needed.

**Confidence: HIGH** on mapping. **MEDIUM-LOW** on fingerprinting workflow (no polished doc).

---

## 6. Dual-run strategy

### 6.1 Node.js / Bun — Sentry SDK v8+ already uses OTEL

Sentry Node SDK v8+ is built on OpenTelemetry internally. Any OTEL spans your app emits are **already captured by Sentry** without extra config. To migrate:

1. Initialize OTEL SDK alongside Sentry.
2. Add a second `OTLPTraceExporter` pointing at HyperDX.
3. Run both in parallel.

**Collision points:**

| Risk | Fix |
|-|-|
| Duplicate HTTP spans | `spans: false` on Sentry's `httpIntegration()` |
| Duplicate `traceparent` headers | `tracePropagation: false` on Sentry |
| ESM loader hook collision | `registerEsmLoaderHooks: false` if registering custom |
| Custom OTEL setup | `skipOpenTelemetrySetup: true` + manual wire of `SentrySpanProcessor`, `SentryPropagator`, `SentryContextManager`, `SentrySampler` |
| Version conflict | `@opentelemetry/core@2.0.1` **incompatible** with `@sentry/opentelemetry@10.12.0+` — pin `>=2.1.0` |

### 6.2 Python — double-patching crashes

`opentelemetry-instrument` + Sentry SDK = hard `AttributeError` crash (opentelemetry-python-contrib#894). OTEL instruments FastAPI first, converting handlers to `functools.partial`; Sentry then fails to patch.

**Mandatory workaround:** set `instrumenter='otel'` in `sentry_sdk.init()`:

```python
sentry_sdk.init(
    dsn=SENTRY_DSN,
    instrumenter='otel',   # ← critical
    traces_sample_rate=1.0,
)

from sentry_sdk.integrations.opentelemetry import SentrySpanProcessor, SentryPropagator
tracer_provider.add_span_processor(SentrySpanProcessor())
set_global_textmap(SentryPropagator())
```

### 6.3 Sentry OTLP ingest (open beta)

Sentry also accepts OTLP:

```
https://o{ORG_ID}.ingest.us.sentry.io/api/{PROJECT_ID}/integration/otlp/v1/traces
```

**Caveats:** span events silently dropped, span links not searchable, metrics unsupported. Useful for verification, not long-term.

### 6.4 Parity validation (2-week dual-run)

Both systems use W3C TraceContext — same `trace_id`/`span_id` format. Spot-check correlation works.

| Metric | Source | Acceptance |
|-|-|-|
| Error count / endpoint / hour | Sentry Issues vs HyperDX `count() WHERE status_code='ERROR' GROUP BY http.route` | ±5% over 3 days |
| Sampled span count / route / hour | Both backends' RED | Within sampling noise (<5%) |
| p50/p95/p99 root span latency | Both backends | ±5% |
| Cross-service trace completeness | 20 known trace_ids in all 3 services | 100% |
| Source map symbolication | Known JS error stack frames | HyperDX matches Sentry quality |

After 3+ days of passing parity → remove Sentry SDK, remove `SentrySpanProcessor`, delete Sentry env vars.

**Confidence: HIGH.**

---

## 7. Local dev story

### 7.1 Local ClickStack

Already wired into VPS dotfiles — see [02-target-stack §local dev parity](02-target-stack.md#local-dev-host-exposed-via-composedevyml). `cd ~/SourceRoot/vps && ENV=dev make up` exposes:

- HyperDX UI: `http://localhost:7707` (or `https://hyperdx.test` via Caddy)
- OTLP gRPC: `localhost:4317`
- OTLP HTTP authed: `localhost:4318`
- OTLP HTTP unauthed: `localhost:4319`

fpp services point at `http://localhost:4319` (matches Argo's convention).

For the `*.test` ecosystem, add to `dotfiles/config/Caddyfile`:

```caddyfile
fpp-hyperdx.test {
  reverse_proxy localhost:7707
}
```

But the existing `hyperdx.test` route is shared across the whole local dev stack — no per-app routing needed.

### 7.2 Env var convention

```bash
# Local (Bun, Python)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4319
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_SERVICE_NAME=fpp-server
OTEL_RESOURCE_ATTRIBUTES=service.version=local,deployment.environment=development

# Prod Bun/Python (VPS, on monitoring-net)
OTEL_EXPORTER_OTLP_ENDPOINT=http://clickstack:4319

# Prod Next.js (Vercel)
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.jkrumm.com
OTEL_EXPORTER_OTLP_HEADERS=authorization=<ingestion-key>
OTEL_SERVICE_NAME=free-planning-poker
OTEL_RESOURCE_ATTRIBUTES=service.version=$VERCEL_GIT_COMMIT_SHA,deployment.environment=production
```

### 7.3 OpenTelemetry Collector — optional middle layer

For local dev: services ship directly to ClickStack `:4319`.

For prod: a Collector in front would enable tail sampling, batching/retry, resource enrichment, multi-backend fan-out.

**fpp v1 doesn't need this.** Direct-to-ClickStack is fine at fpp scale. Add Collector in a later phase if disk growth demands tail sampling.

---

## 8. Open questions / ambiguities

- **WebSocket span granularity.** No OTEL spec. Span explosion risk if naively per-message. Recommendation: per-connection SERVER span + INTERNAL spans only for meaningful actions; heartbeats/presence → log records on trace_id.
- **`@kubiks/otel-drizzle` with mysql2 on Bun.** Argo uses Postgres. Spike in Phase 2.
- **HyperDX session replay PII masking.** Per-element data-attribute masking *EXTRAPOLATED* not supported. Validate in Phase 4.
- **`Sentry.captureFeedback()` replacement.** No obvious OTEL equivalent. Decide in Phase 4: keep Sentry just for feedback, or webhook → Discord/email.
- **Sentry → HyperDX issues page replacement.** `sentry.router.ts` REST proxy disappears. Build HyperDX query or drop entirely?

---

## 9. Authoritative sources

- otel spec/blog: opentelemetry.io/docs/specs/, opentelemetry.io/blog/2025/otel-js-sdk-2-0/, opentelemetry.io/blog/2025/sampling-milestones/
- HyperDX/ClickStack: hyperdx.io/docs/v2, hyperdx.io/docs/install/{next,opentelemetry,browser}, hyperdx.io/docs/integrations/sourcemap, clickhouse.com/docs/use-cases/observability/clickstack/
- Next.js: nextjs.org/docs/pages/guides/instrumentation
- Elysia: elysiajs.com/patterns/opentelemetry, github.com/elysiajs/opentelemetry
- Bun gaps: github.com/oven-sh/bun/issues/26536, github.com/oven-sh/bun/discussions/7185
- Python: pypi.org/project/opentelemetry-sdk/, opentelemetry-python-contrib.readthedocs.io/, github.com/open-telemetry/opentelemetry-python/issues/4809
- Sentry coexistence: docs.sentry.io/platforms/javascript/guides/node/opentelemetry/, docs.sentry.io/platforms/python/tracing/instrumentation/opentelemetry/, docs.sentry.io/concepts/otlp/
- tRPC + browser propagation: oneuptime.com/blog/post/2026-02-06-trpc-end-to-end-opentelemetry-typescript/view

---

## Related

- [01 — Sentry Audit](01-sentry-audit.md)
- [02 — Target Stack](02-target-stack.md)
- [03 — Argo Reference](03-argo-reference.md)
- [PRD](PRD.md)
