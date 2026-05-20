---
paths:
  - packages/shared/src/telemetry/**
  - apps/server/src/telemetry.ts
  - apps/server/src/utils/app-error.ts
  - apps/server/src/utils/instrument-action.ts
  - apps/server/src/room.entity.ts
  - apps/server/src/room.state.ts
  - apps/server/src/message.handler.ts
  - apps/web/src/utils/app-error.ts
  - apps/web/instrumentation.ts
  - apps/web/instrumentation-client.ts
  - fpp-analytics/util/telemetry.py
  - fpp-analytics/util/telemetry_taxonomy.py
  - fpp-analytics/util/error_capture.py
---

# Observability (OTEL → ClickStack/HyperDX)

Full spec: `docs/otel-migration/05-observability-v2.md`. This rule is the
working summary — when in doubt, the spec wins.

## Single typed taxonomy

Every attribute key, event name and metric name originates in
`packages/shared/src/telemetry/` (`ATTR` / `EVENT` / `METRIC`), consumed by web
+ server. Python mirrors the subset it emits in
`fpp-analytics/util/telemetry_taxonomy.py` (hand-kept). **No raw telemetry
string literal anywhere else** — pass `ATTR.*` keys, `EVENT.*` names, `METRIC.*`
descriptors. A raw `'roomId'` must not typecheck. `event.name` (the OTEL-reserved
event key) is the one allowed literal, inside `recordEvent` only.

## Which signal? (decision matrix, spec §3)

- **Span / span attribute** — duration + static facts of an operation. The WS
  span is created by `instrumentAction`.
- **Log-based Event** (`recordEvent(EVENT.X, attrs)`) — a discrete, named,
  business occurrence to count/filter/drill into. Carries high-cardinality dims
  (`room.id`, `user.id`, `vote.value`). Never `span.addEvent()` (OTEP 4430).
- **Metric** (`metrics.*`) — numeric series for dashboards/alerts.
  **Low-cardinality labels only — never `room.id` or `user.id`.**
- **Plain log** — operator narration (invalid message, fail-open warning). A
  plain log is *not* an event (no `event.name`). Transport differs by service
  because stdout aggregation does:
  - **fpp-server / analytics** → `log.*` (Pino) to stdout, piped into ClickStack
    on the VPS. Not OTEL.
  - **apps/web (Vercel)** → `log.warn`/`log.info` from the `app-error` facade,
    which dual-writes Pino stdout (Logdy + Vercel platform logs) **and**, on the
    server, a plain OTLP log record — because the Vercel app's stdout reaches no
    aggregator our stack reads. In the browser it skips the OTLP emit (the
    HyperDX SDK's `consoleCapture` already forwards it). Raw `logger` (Pino) is
    ESLint-banned outside the facade on web for this reason.
- **Exception** (`recordError(err, ctx, sev)`) — error conditions.

## Naming (spec §4)

snake_case within `.`-delimited segments. **Domain-first, no prefix** for
business concepts (`room.*`, `user.*`, `vote.*`, `round.*`, `action.type`,
`outcome`, `close.reason`). **`fpp.*`** only for facade cross-cutting metadata
(`fpp.component`, `fpp.action`, `fpp.severity`, `fpp.ws.connection_id`).
`otel.*` is forbidden. Metric names: dot-namespaced, instrument-suffixed, never
`_total`, UCUM units in metadata.

## Facade verbs (clean break — no Sentry-era verbs)

`recordError` / `recordEvent` / `metrics.*`, plus `log.warn`/`log.info` for
operator narration (web facade — see §3). **No `captureMessage`,
`captureError`, `addBreadcrumb`** in TS. ESLint bans importing `logs`
(`@opentelemetry/api-logs`), `metrics` (`@opentelemetry/api`),
`@hyperdx/browser` and the raw Pino `logger` (`fpp/utils/logger`) outside the
facade/telemetry/instrumentation files.

## Server emission rules (authoritative source)

- **fpp-server owns all metrics.** The browser emits **events only**.
- **Domain events + domain metrics fire at the state-mutation chokepoint** in
  `room.entity.ts` / `room.state.ts`, **not** `message.handler.ts` — so timer/
  cron mutations (auto-flip, the 30-min sweep, empty-room close) are measured
  too. One source per domain event.
- `instrumentAction` owns ONLY transport/RED (trace continuation, span,
  `fpp.action.count`/`duration`, ok|error outcome). `heartbeat` bypasses it.
- The three `*.active` gauges are **ObservableUpDownCounters** whose callbacks
  sample `roomState`'s Maps. Never manual ±1. Event-style totals
  (created/closed/vote.cast/round.flipped) are synchronous Counters.
- `recordError` keeps `span.recordException()` for now — `// TODO(otel)` OTEP
  4430. New in-flight occurrences use `recordEvent`, never `span.addEvent()`.

## Taxonomy reference

Events (spec §7) and metrics (spec §8) are the contract — add a new
`EVENT`/`METRIC`/`ATTR` to the registry first, then emit. `vote.cleared` fires
for a null estimate (deselect); `vote.cast` for non-null only. Cardinality
budget (spec §13): each metric's label cross-product stays well under 200; SDK
Views enforce a per-metric attribute allowlist.
