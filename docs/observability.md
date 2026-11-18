# Observability and error handling

Read this before changing logging, Logdy, telemetry names, `recordError` or `recordEvent`, or an error path. The signal contract is `docs/otel-migration/05-observability-v2.md` (source of truth) and `.claude/rules/observability.md` (loads on telemetry files).

## Service names

OTel `service.name` per service (how HyperDX/ClickStack groups them):

| Service | `service.name` | Source |
|-|-|-|
| Next.js web | `free-planning-poker` | `OTEL_SERVICE_NAME`, default in `apps/web/instrumentation.ts` |
| fpp-server | `fpp-server` | `apps/server/src/telemetry.ts` |
| fpp-analytics | `fpp-analytics` | `fpp-analytics/util/telemetry.py` |

## Logdy Integration

Logdy provides a unified web UI for viewing logs from all services in real-time during local development.

**Web UI:** http://localhost:7723 (or https://fpp-logdy.test via Caddy)

### Features

Real-time log streaming and automatic JSON parsing (Pino) from all services; filter by `service`, `origin.port` or field (e.g. `userId:abc123`, `level:error`), color-coded levels (20=debug … 60=fatal), timeline view.

### Installation (One-time per Machine)

```bash
brew tap logdyhq/logdy && brew install logdy
logdy --version
```

### Usage

```bash
# Start all services with Logdy (the default — recommended for multi-service development)
bun run dev
# Opens:
# - http://localhost:7720 (Next.js)         or https://fpp.test
# - http://localhost:7721 (fpp-server)       or https://fpp-server.test
# - http://localhost:7722 (fpp-analytics)    or https://fpp-analytics.test
# - http://localhost:7723 (Logdy UI)         or https://fpp-logdy.test

# Start individual services without Logdy (simpler for single-service work)
bun run dev:web                                                      # Next.js only
bun run --filter=@fpp/server dev                                     # fpp-server only
cd fpp-analytics && uv run uvicorn main:app --reload --port 7722     # Analytics only
```

### Logging Architecture

All services use structured JSON logging (Pino format):

| Service | Logger | Format | Output |
|---------|--------|--------|--------|
| **Next.js** | Pino | JSON | stdout |
| **fpp-server** | Pino | JSON | stdout |
| **fpp-analytics** | python-json-logger | JSON (Pino-compatible) | stdout |

**Pino Log Format:**
```json
{
  "level": 30,              // 10=trace, 20=debug, 30=info, 40=warn, 50=error, 60=fatal
  "time": 1704206400000,    // Unix timestamp (ms)
  "msg": "User logged in",
  "service": "free-planning-poker",  // Service identifier
  "userId": "abc123",       // Custom fields
  "component": "auth",
  "action": "login"
}
```

**Benefits:**
- Unified log viewing across all three services
- JSON structure makes logs searchable and filterable
- Production-ready (structured logs work with log aggregation tools)
- Error logs automatically sent to HyperDX as OTEL log records

**How it works:** Logdy runs in socket mode on ports 7724/7725/7726; each service pipes logs to its dedicated port via `logdy forward`, tagged with `origin.port` (7724=Next.js, 7725=fpp-server, 7726=fpp-analytics). The UI (7723) aggregates all streams in real-time.

**Note:** Next.js dev prints some unsuppressable plain-text logs (compile times); dev-only, absent in `next start`.

**Logdy Configuration:**
- Config file: `logdy.config.json` (automatically loaded)
- Custom columns: time, level, service, msg, error
- Middleware: Filters debug logs (level < 30) and noisy compile logs
- Error column: Displays `error.message` field in red for easy spotting

### Production Logging

All services emit production-ready Pino JSON to stdout (captured by Docker/Vercel),
each tagged with a `service` field (`free-planning-poker`, `fpp-server`,
`fpp-analytics`); correlate across services by `userId`/`roomId`. No standalone log
aggregator is configured — HyperDX/ClickStack receives OTLP log records from the
code itself: fpp-server (`recordError`, `recordEvent`, `otelLog.*`), the web server
(the `app-error` facade) and fpp-analytics (stdlib `logging` bridge). Every record
has a non-empty Body (events: `event.name` plus its attributes as `key=value`).

Resource attributes on every runtime incl. the browser: `service.namespace=free-planning-poker`,
`service.version` = short git SHA (`OTEL_SERVICE_VERSION` Docker build arg set by
`deploy.yml`; `VERCEL_GIT_COMMIT_SHA` shortened on Vercel; `local` in dev) and
`deployment.environment.name` = `prod` | `dev` (mapped from `NODE_ENV`). The browser
SDK runs with `advancedNetworkCapture: false` (no request/response headers or
bodies) and session replay with `maskAllInputs: true`.

## Error Handling Standards (OpenTelemetry → HyperDX)

Sentry has been replaced by a self-hosted OTEL stack (ClickStack + HyperDX on the
VPS). **Observability v2** then added metrics + log-based events + a single typed
taxonomy — see `docs/otel-migration/05-observability-v2.md` (the source of truth)
and `.claude/rules/observability.md`. The facade was re-founded on OTEL-native
verbs (clean break, no Sentry-era aliases):

- `recordError(err, ctx, sev)` — exceptions (span exception + correlated log).
- `recordEvent(EVENT.X, attrs)` — log-based domain events (typed, registry-keyed).
- `metrics.*` — typed instrument handles (fpp-server only; the browser emits
  events, never metrics).
- Operator narration → `log.warn`/`log.info`. On fpp-server/analytics this is
  Pino-to-stdout (piped into ClickStack on the VPS). On **apps/web** it's the
  `app-error` facade's `log.*`, which dual-writes stdout **and** a plain OTLP log
  record (no `event.name`) server-side — Vercel stdout reaches no aggregator our
  stack reads. Raw `logger` (`fpp/utils/logger`) is ESLint-banned outside the
  facade on web.
- `captureMessage` / `addBreadcrumb` are **gone**.

Every attribute key / event name / metric name originates in
`@fpp/shared/telemetry` (`ATTR` / `EVENT` / `METRIC`). No raw telemetry string
literals elsewhere.

### Import Rule (Enforced by ESLint)
```typescript
// ✅ Correct - use the facade
import { recordError, recordEvent } from 'fpp/utils/app-error';

// ❌ BANNED - direct OTEL log emission outside the facade
import { logs } from '@opentelemetry/api-logs';
// ❌ BANNED - meters are created only in telemetry.ts
import { metrics } from '@opentelemetry/api';
// ❌ BANNED - direct HyperDX SDK calls (init lives in instrumentation-client.ts)
import HyperDX from '@hyperdx/browser';
```

### When to Use recordError

**Capture:**
- System errors (database, server crashes)
- Failed mutations with no fallback
- Authentication failures
- tRPC: INTERNAL_SERVER_ERROR, TIMEOUT, UNKNOWN
- Bugs in validation logic (e.g., unexpected null/undefined)

**Don't Capture:**
- User input validation errors (wrong format, too long, etc.)
- tRPC: BAD_REQUEST, CONFLICT (business logic errors)
- WebSocket 1006 closes (auto-reconnect)
- Expected business logic failures

### Severity Decision Tree

```
Prevents app from working? → critical
Blocks user action? → high (system errors, auth failures)
Validation/business error? → medium (fix the frontend)
Recoverable/handled? → medium (network issues, query failures)
Informational? → low
```

### tRPC Mutation Pattern

```typescript
mutation.mutate(data, {
  onError: (error) => {
      recordError(error, {
        component: 'ComponentName',
        action: 'actionName',
        extra: { errorCode }
      }, 'high');

    // Always show user feedback
    showErrorNotification(error.message);
  }
});
```

### recordError Usage

Always pass `component`/`action`/`extra` context — `recordError(error)` alone is not enough. Capture validation *logic* bugs (low/medium); do not capture plain user-input errors (see "Don't Capture"). Examples: `docs/error-handling-patterns.md`.

### Event Guidelines (`recordEvent`)

Breadcrumbs are gone. Discrete business occurrences are now **log-based events**
emitted via `recordEvent(EVENT.X, attrs)` — typed names from the
`@fpp/shared/telemetry` registry, never `span.addEvent()` (OTEP 4430).

**Signal discipline (no reflexive "log everything"):**
- **Domain events** (`room.joined`, `vote.cast`, `round.flipped`, …) are emitted
  by **fpp-server** at the state-mutation chokepoint (`room.entity`/`room.state`)
  — the authoritative source. Don't mirror them from the browser.
- The **browser emits only client-only events** the server can't observe:
  `ws.reconnected`, `ws.reconnect_exhausted`, `ws.recovery_reload`.
- Operator narration (invalid message, fail-open warnings) → plain logs via
  `log.warn`/`log.info` (web facade dual-writes stdout + OTLP server-side; see
  the facade verbs above), not events.
- Never an event per render/effect, keystroke, or high-frequency tick.

Add a new event/attribute/metric to the registry **first**, then emit it. See
`.claude/rules/observability.md` for the full decision matrix.

## Error Handling Implementation Guide

System errors on web flow through **CustomTRPCError**: `apps/web/src/server/api/custom-error.ts` defines the class plus `toCustomTRPCError`; `apps/web/src/pages/api/trpc/[trpc].ts` is the single capture point; `apps/web/src/utils/app-error.ts` wraps OTEL.

### Next.js API Routes (Pages Router)

All Next.js API route handlers (`apps/web/src/pages/api/*.ts`) wrap their logic in try-catch, capture with context, and return HTTP 500:

```typescript
import { type NextApiRequest, type NextApiResponse } from '@trpc/server/adapters/next';
import { recordError } from 'fpp/utils/app-error';

const ApiHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    if (req.method !== 'POST') throw new MethodNotAllowedError('Only POST requests allowed');
    const { userId, data } = req.body;
    validateInput(userId, data);
    await db.insert(table).values({ userId, data });
    return res.status(200).json({ success: true });
  } catch (error) {
    recordError(
      error instanceof Error ? error : new Error('Operation failed'),
      { component: 'api-route-name', action: 'handlerName', extra: { method: req.method ?? 'unknown', hasBody: !!req.body } },
      'high',
    );
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default ApiHandler;
```

**Key Points:** wrap the whole handler; capture with component/action context; return a safe 500; use `'high'` for API failures (they block the user).

### tRPC Router Error Handling (CustomTRPCError)

**IMPORTANT:** tRPC routers never use try-catch or `recordError` directly — that causes
double-capture. Attach `.catch()` to every database/fetch call and rethrow a
`toCustomTRPCError` with component, action, extra and severity:

```typescript
import { TRPCError } from '@trpc/server';
import { toCustomTRPCError } from 'fpp/server/api/custom-error';
import { createTRPCRouter, publicProcedure } from 'fpp/server/api/trpc';

export const exampleRouter = createTRPCRouter({
  getData: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx: { db }, input: { id } }) => {
      const data = await db.query.table.findFirst({
        where: eq(table.id, id),
      }).catch((error) => {
        throw toCustomTRPCError(error, 'Failed to query database', {
          component: 'exampleRouter',
          action: 'getData',
          extra: { id },
          severity: 'high',
        });
      });

      if (!data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Data not found' });
      }

      return data;
    }),
});
```

The same `.catch()` → `toCustomTRPCError` shape covers external `fetch` (also check
`response.ok` and capture `response.status` in `extra`) and `Promise.allSettled` (rethrow the
first `rejected` reason with failed/total counts in `extra`); full code in `docs/error-handling-patterns.md`.

### Error Types

**Business logic errors** — expected, user-facing failures — use a standard `TRPCError`
(`NOT_FOUND`, `CONFLICT`, `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`) and are **not** captured:

```typescript
throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found' });
```

**System errors** — database failures, external API errors, timeouts — use
`toCustomTRPCError` and **are** captured in HyperDX.

**Common mistakes:** try-catch or `recordError` in a router (double-capture); wrapping a
business error in `CustomTRPCError`; omitting `.catch()`; omitting component/action/extra.
Severity stays as the decision tree above: critical (crash/data loss/security), high
(blocked user action — the DEFAULT for system errors), medium (degraded), low (informational).
