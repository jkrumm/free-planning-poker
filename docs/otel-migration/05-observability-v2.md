# Spec: Observability v2 — Metrics, Events & a Typed Telemetry Taxonomy

**Status:** Spec. Pre-implementation. Successor to [PRD.md](PRD.md) (the Sentry→OTEL migration, now shipped).
**Owner:** Johannes
**Last updated:** 2026-05-20

> The migration replaced Sentry with pure OTEL → ClickStack/HyperDX and deliberately scoped out metrics ([PRD §2](PRD.md#2-goals--non-goals): "Traces + logs only for v1"). The pipeline is live. This spec is the deferred phase: turn the three services from *error-reporting* instrumentation into *product-grade* observability — metrics + log-based events + a single typed taxonomy — so the multiplayer room becomes measurable, with HyperDX dashboards for feature usage, concurrency, and action flow.

---

## 1. Why now

What exists today (audited 2026-05-20):

- Three vendor-agnostic facades (`apps/web/src/utils/app-error.ts`, `apps/server/src/utils/app-error.ts`, `fpp-analytics/util/error_capture.py`) exposing the Sentry-shaped trio `captureError` / `captureMessage` / `addBreadcrumb`.
- Distributed traces browser → tRPC → WS → analytics, including W3C `traceparent` smuggled through the WS payload (`_traceparent`). This part is genuinely good and stays.
- **Zero metrics.** No `getMeter`, no Counter/Histogram/UpDownCounter anywhere.
- The room — the highest-value surface — is the least instrumented: of 12 WS actions, most (`estimate`, `setSpectator`, `reset`, `setAutoFlip`, `setPresence`, `flip`) are direct mutations with no span attributes, no event, no metric.
- Attribute naming mixes a defensible `fpp.*` prefix with non-conformant camelCase (`ws.roomId`, `ws.userId`, `fpp.userId`).

The goal: best-practice, vendor-agnostic, **strictly typed E2E** observability where every meaningful room action emits the right signal, the taxonomy lives in one place, and drift is caught by types + lint.

---

## 2. Principles

1. **Facade stays; vocabulary changes.** A thin wrapper over the OTEL API is correct (it kept the Sentry swap to an exporter change). Keep the facade, drop the Sentry verbs, re-found it on OTEL primitives.
2. **Signal discipline.** Each fact is recorded as exactly one *primary* signal type, chosen deliberately (§4). No reflexive "log everything."
3. **Single typed source of truth.** Attribute keys, event names, and metric names live once in `@fpp/shared`. Raw string keys must not typecheck. This is the real enforcement; lint is the backstop.
4. **Cardinality is a budget, not an afterthought.** High-cardinality dims (`room.id`, `user.id`, `vote.value` where unbounded) go on spans/events only — never on metric attributes.
5. **The authoritative source emits the authoritative metric.** `fpp-server` owns room/user/connection state, so it owns all room metrics. The browser emits events for client-only interactions, not metrics.
6. **Follow the spec, don't reinvent it.** OTEL semantic conventions for naming, units (UCUM), and event semantics. Reserve `otel.*` (forbidden), `fpp.*` (proprietary cross-cutting only), domain-first for everything else.

---

## 3. The signal decision matrix

Authoritative reference for "which signal do I emit?" — applies at every call site.

| Signal | Use for | FPP examples | Carries high-card attrs? |
|-|-|-|-|
| **Span** | Duration + causality of an operation; the unit of a trace | `ws.<action>` handling, tRPC call, DB query, cross-service `fetch` | Yes (on the span) |
| **Span attribute** | Static fact about an operation (no timestamp of its own) | `room.id`, `user.id`, `action.type` on the WS span | Yes |
| **Log-based Event** | A discrete, named, business-meaningful occurrence you want to count, filter, and drill into | `vote.cast`, `round.flipped`, `room.joined`, `ws.disconnected` | Yes — this is where `room.id`/`vote.value` live for product analytics |
| **Metric** | A numeric series for dashboards/alerts: rates, distributions, concurrency | `fpp.user.active`, `fpp.action.count`, `fpp.action.duration` | **No** — low-cardinality labels only |
| **Plain log record** | Human/operator narration; bridge from libraries | "cron sweep removed 4 stale users" | Incidental |
| **Exception** | An error condition | recorded by `recordError` (§6) | Yes |

### Why events *and* metrics (the ClickHouse nuance)

The backend is ClickHouse. Unlike Prometheus, it can `GROUP BY` millions of raw event rows in SQL — including high-cardinality dims you may **not** put on a metric. So the division of labour is:

- **Log-based Events** carry per-action product analytics at full cardinality (`vote.cast` with `room.id`, `user.id`, `vote.value`). Drill-down and funnels are ClickHouse SQL / HyperDX Chart Explorer over the Logs source.
- **Metrics** carry what events are *bad* at: **concurrency gauges** (active users/rooms/connections — point-in-time state that's painful and expensive to reconstruct from an event stream) and cheap, low-card, long-retention rollups (action rate, latency histograms).

You picked "both, fully" — this spec builds both, but assigns them by what each is actually good at rather than duplicating signal.

### Span events are deprecated — use the Logs API

OTEP 4430 (accepted early 2026) **deprecates `span.addEvent()` and `span.recordException()`** in favour of the Logs API emitting a log record with a mandatory `event.name`. A backward-compat SDK processor converts these back to span events for backends that want them. Implication for us:

- New "in-flight occurrence" instrumentation = **log-based Event** (`recordEvent`), never `span.addEvent()`.
- `recordError` keeps calling `span.recordException()` for now (shim-supported, surfaces in trace view), with a tracking note to move to a log-based exception event once the converting processor is wired into our SDK setup.

---

## 4. Naming & conventions

Per OTEL semantic-convention naming spec; you chose to migrate to conform.

**Attributes:**

- lowercase `snake_case` within segments, `.` as delimiter: `room.user_count`, never `roomUserCount`.
- **Domain-first, no prefix** for genuine business concepts: `room.*`, `user.*`, `vote.*`, `round.*`, `action.type`, `outcome`, `close.reason`.
- **`fpp.*`** reserved strictly for the facade's cross-cutting metadata that is *not* a business concept: `fpp.component`, `fpp.action` (the operation/function label), `fpp.severity`. (Naming spec: prefix only genuinely proprietary keys; reverse-DNS for cross-org — not us.)
- **Standard OTEL keys** where they exist: `exception.type|message|stacktrace`, `error.type`, `http.*`, `service.*`.
- `otel.*` is **forbidden** (reserved by the spec).

> `action.type` vs `fpp.action` are different axes and both stay: `action.type` = the room action discriminator (`vote`/`flip`/`reset`/…); `fpp.action` = the facade operation label (which function ran). Keep them distinct.

**Metric names:** dot-namespaced, instrument-suffixed, **never** `_total`, UCUM units, generally **not** pluralized. `fpp.action.count` (Counter), `fpp.action.duration` (Histogram, unit `s`), `fpp.user.active` (UpDownCounter). Units in metadata, not the name.

**Event names (`event.name`):** domain-first, dotted: `room.joined`, `vote.cast`, `round.flipped`.

### Attribute rename map (current → target)

| Current | Target | Where |
|-|-|-|
| `ws.roomId` | `room.id` | server WS span |
| `ws.userId` | `user.id` | server WS span |
| `ws.action` | `action.type` | server WS span / metrics / events |
| `ws.id` | `fpp.ws.connection_id` | server WS span |
| `fpp.userId` (userContext) | `user.id` | web facade |
| `fpp.roomId` (userContext) | `room.id` | web facade |
| `fpp.username` (userContext) | `user.name` | web facade |
| `fpp.breadcrumb` + `fpp.category` | replaced by `event.name` | both facades |
| `fpp.component`, `fpp.action`, `fpp.severity` | unchanged (proprietary) | all facades |

`HyperDX.setGlobalAttributes(...)` keys (the RUM-session layer) stay as the SDK expects them; only the mirrored OTLP attributes (`userContextAttrs`) move to domain-first.

---

## 5. The typed shared taxonomy (`@fpp/shared`)

The "strict typed E2E" core. New module `packages/shared/src/telemetry/`, consumed by web **and** server so the client and the authoritative server agree on every key by construction.

```
packages/shared/src/telemetry/
├── attributes.ts   # ATTR — every attribute key, as const
├── events.ts       # EVENT — every event.name + its required attribute shape
├── metrics.ts      # METRIC — every metric name + instrument descriptor
└── index.ts
```

```ts
// attributes.ts — the only place attribute key strings exist
export const ATTR = {
  ROOM_ID: 'room.id',
  ROOM_USER_COUNT: 'room.user_count',
  ROOM_SPECTATOR_COUNT: 'room.spectator_count',
  ROOM_AUTOFLIP_ENABLED: 'room.autoflip_enabled',
  USER_ID: 'user.id',
  USER_NAME: 'user.name',
  USER_IS_SPECTATOR: 'user.is_spectator',
  USER_IS_PRESENT: 'user.is_present',
  VOTE_VALUE: 'vote.value',
  ROUND_VOTE_COUNT: 'round.vote_count',
  ROUND_DISTINCT_VALUES: 'round.distinct_values',
  ROUND_CONSENSUS: 'round.consensus',
  ROUND_DURATION: 'round.duration',
  ACTION_TYPE: 'action.type',
  FLIP_TRIGGER: 'flip.trigger',
  OUTCOME: 'outcome', // action RED only: ok | error
  CLOSE_REASON: 'close.reason',
  ERROR_TYPE: 'error.type', // bounded exception-class enum
  // facade-proprietary
  FPP_COMPONENT: 'fpp.component',
  FPP_ACTION: 'fpp.action',
  FPP_SEVERITY: 'fpp.severity',
  FPP_WS_CONNECTION_ID: 'fpp.ws.connection_id',
} as const;

// events.ts — names are the contract; attribute typing makes call sites strict
export const EVENT = {
  ROOM_CREATED: 'room.created',
  ROOM_JOINED: 'room.joined',
  ROOM_LEFT: 'room.left',
  ROOM_CLOSED: 'room.closed',
  ROOM_RENAMED: 'room.renamed',
  ROOM_AUTOFLIP_CHANGED: 'room.autoflip_changed',
  VOTE_CAST: 'vote.cast',
  VOTE_CLEARED: 'vote.cleared',
  ROUND_FLIPPED: 'round.flipped',
  ROUND_RESET: 'round.reset',
  USER_KICKED: 'user.kicked',
  USER_RENAMED: 'user.renamed',
  USER_SPECTATOR_CHANGED: 'user.spectator_changed',
  USER_PRESENCE_CHANGED: 'user.presence_changed',
  WS_CONNECTED: 'ws.connected',
  WS_DISCONNECTED: 'ws.disconnected',
  WS_RECONNECTED: 'ws.reconnected',
} as const;

// metrics.ts — single definition; the facade instantiates instruments from this
export const METRIC = {
  USER_ACTIVE:        { name: 'fpp.user.active',            kind: 'observable_updown', unit: '{user}' },
  ROOM_ACTIVE:        { name: 'fpp.room.active',            kind: 'observable_updown', unit: '{room}' },
  CONNECTION_ACTIVE:  { name: 'fpp.ws.connections.active',  kind: 'observable_updown', unit: '{connection}' },
  ACTION_COUNT:       { name: 'fpp.action.count',           kind: 'counter',   unit: '{action}' },
  ACTION_DURATION:    { name: 'fpp.action.duration',        kind: 'histogram', unit: 's' },
  VOTE_CAST:          { name: 'fpp.vote.cast',              kind: 'counter',   unit: '{vote}' },
  ROUND_FLIPPED:      { name: 'fpp.round.flipped',          kind: 'counter',   unit: '{round}' },
  ROOM_CREATED:       { name: 'fpp.room.created',           kind: 'counter',   unit: '{room}' },
  ROOM_CLOSED:        { name: 'fpp.room.closed',            kind: 'counter',   unit: '{room}' },
} as const;
```

**Python (`fpp-analytics`)** can't import TS. It keeps a parallel `util/telemetry_taxonomy.py` with the same constants. v1: hand-kept (analytics emits a small subset). Future: generate the Python module from the TS source in CI to guarantee parity.

---

## 6. Facade API redesign (per service)

Replace the Sentry trio with OTEL-native verbs. Keep the call-site ergonomics.

| Old | New | Behaviour |
|-|-|-|
| `addBreadcrumb(msg, category, data)` | `recordEvent(EVENT.X, attrs)` | Log-based Event: log record with `event.name`, `severityNumber` INFO, typed attributes. Correlated to active trace. |
| `captureMessage(msg, ctx, level)` | `log.info/warn(...)` (operator narration) **or** `recordEvent` (if it's a named occurrence) | Splits the current overload into its two real meanings. |
| `captureError(err, ctx, sev)` | `recordError(err, ctx, sev)` | Unchanged behaviour (records exception on span + emits log record). Rename only; deprecation note for the `recordException` path. |
| — (new) | `metrics.*` | Typed instrument handles created once at init from `METRIC` (§5), e.g. `metrics.actionCount.add(1, { [ATTR.ACTION_TYPE]: 'vote' })`. |

`recordEvent` shape:

```ts
export function recordEvent(name: EventName, attributes: TelemetryAttributes): void {
  getOtelLogger().emit({
    severityNumber: SeverityNumber.INFO,
    severityText: 'INFO',
    attributes: { 'event.name': name, ...userContextAttrs(), ...attributes },
  });
}
```

`TelemetryAttributes` is keyed by `(typeof ATTR)[keyof typeof ATTR]`, so a raw `'roomId'` string key fails to compile. That is the primary guardrail.

**Transition: clean break, no aliases.** Telemetry was just migrated to OTEL; there is no saved historical data or dashboard depending on the old verbs/attributes, so we don't preserve backward compatibility. Rename directly: delete `captureMessage`/`addBreadcrumb`, rename `captureError`→`recordError`, migrate all ~280 call sites. Split the migration per service/PR for review sanity if desired, but no deprecated-alias window is needed.

---

## 7. Event taxonomy

Emitted via `recordEvent`. `S` = fpp-server (authoritative, primary), `W` = web (client-only context where the server can't see it).

| `event.name` | When | Key attributes | Emit |
|-|-|-|-|
| `room.created` | First user creates/opens a room | `room.id` | S |
| `room.joined` | User joins/rejoins | `room.id`, `user.id`, `room.user_count` | S |
| `room.left` | User leaves | `room.id`, `user.id`, `room.user_count` | S |
| `room.closed` | Room emptied / swept | `room.id`, `close.reason` (`empty`\|`timeout`) | S |
| `room.renamed` | `changeRoomName` | `room.id` | S |
| `room.autoflip_changed` | `setAutoFlip` | `room.id`, `room.autoflip_enabled` | S |
| `vote.cast` | `estimate` with non-null value | `room.id`, `user.id`, `vote.value`, `round.vote_count` | S |
| `vote.cleared` | `estimate` with null value (deselect) | `room.id`, `user.id`, `round.vote_count` | S |
| `round.flipped` | `flip` (manual or auto) | `room.id`, `round.vote_count`, `round.distinct_values`, `round.consensus`, `round.duration`, `flip.trigger` (`manual`\|`auto`) | S |
| `round.reset` | `reset` | `room.id`, `round.vote_count` (pre-reset) | S |
| `user.kicked` | `kick` | `room.id`, `user.id` (target) | S |
| `user.renamed` | `changeUsername` | `room.id`, `user.id` | S |
| `user.spectator_changed` | `setSpectator` | `room.id`, `user.id`, `user.is_spectator` | S |
| `user.presence_changed` | `setPresence` | `room.id`, `user.id`, `user.is_present` | S |
| `ws.connected` | Socket open | `room.id`, `user.id` | S |
| `ws.disconnected` | Socket close (non-normal) | `room.id`, `user.id`, `close.reason` | S |
| `ws.reconnected` | Action queue flush after reconnect | `room.id`, `user.id` | W |

`heartbeat` is intentionally **not** an event — it's noise. It feeds presence/liveness only.

---

## 8. Metric taxonomy

All emitted by **fpp-server** (authoritative). Units UCUM. **No metric carries `room.id` or `user.id`.** `vote.value` is safe as a label *only because the planning-poker deck is a bounded set* — call that out in the code.

| Metric | Instrument | Unit | Attributes | Notes |
|-|-|-|-|-|
| `fpp.user.active` | ObservableUpDownCounter | `{user}` | — | Async callback sums users across `roomState.rooms`. |
| `fpp.room.active` | ObservableUpDownCounter | `{room}` | — | Async callback reads `roomState.rooms.size`. |
| `fpp.ws.connections.active` | ObservableUpDownCounter | `{connection}` | — | Async callback reads `roomState.userConnections.size`. ≠ active users (reconnects). |
| `fpp.action.count` | Counter | `{action}` | `action.type`, `outcome` | RED rate, partitioned by the 12 action types. |
| `fpp.action.duration` | Histogram | `s` | `action.type` | RED duration; p50/p95/p99 of handler time. |
| `fpp.vote.cast` | Counter | `{vote}` | `vote.value` | Vote distribution; bounded deck → safe label. |
| `fpp.round.flipped` | Counter | `{round}` | `flip.trigger` (`manual`\|`auto`), `round.consensus` | Rounds completed; consensus + auto-flip rate. |
| `fpp.room.created` | Counter | `{room}` | — | Creation rate. |
| `fpp.room.closed` | Counter | `{room}` | `close.reason` | Closure rate by reason. |

**Model:** RED (Rate/Errors/Duration) on the action layer (`fpp.action.*`, with `error.type` as a low-card label on the error path); USE (Utilization/Saturation/Errors) on the server layer if/when added (CPU/heap via ObservableGauge, connection backpressure via UpDownCounter).

**Why observable, not manual ±1:** the room/user/connection counts derive from the authoritative in-memory Maps (`roomState`). Reading them in an async callback each collection cycle removes all manual increment/decrement bookkeeping — and with it the bug class the spec warns about: a missed decrement on a crash/kick/sweep path orphaning a time series, or an inc/dec attribute-set mismatch. The Map *is* the source of truth; the gauge just samples it. Event-style totals (`created`/`closed`/`vote.cast`/`round.flipped`) stay synchronous Counters fired at the mutation site.

---

## 9. Span conventions

Spans are mostly fine already (WS-boundary propagation works). Changes:

- Rename WS span attributes per §4 (`ws.roomId`→`room.id`, etc.).
- On the `ws.<action>` span, also set `action.type`, `room.id`, `user.id` and, where cheap, the domain attrs (`vote.value`, `round.vote_count`) so a single trace tells the whole story.
- Record `fpp.action.duration` from the same span's wall time (start/end already bracket the handler).
- Keep `recordError` on `span.recordException()` for now; add a `// TODO(otel): migrate to log-based exception event per OTEP 4430` and wire the converting processor when we touch SDK init.
- Static facts → span **attributes**, never `span.addEvent()` (deprecated).

### The `instrumentAction` wrapper (fpp-server)

Two concerns must not be copy-pasted into 12 handlers: the **transport/RED layer** (continue the trace, span the handler, count + time the action) and the **domain layer** (the business event + domain metric). Split them:

- `instrumentAction` owns the transport/RED layer at the WS-message boundary. It folds in the trace-context extraction currently inline in `index.ts`.
- The **domain event + domain metric fire at the state-mutation chokepoint** in `room.entity.ts` / `room.state.ts` — **not** in the message handler. This is deliberate: auto-flip (1s timer), the 30-min cleanup sweep, and empty-room closure mutate state *without an incoming WS message*. Emitting at the entity guarantees those paths are measured too, and gives each domain event exactly one source.

```ts
// utils/instrument-action.ts — the transport/RED layer
export function instrumentAction(
  action: { action: string; roomId: number; userId: string; _traceparent?: string },
  connectionId: string,
  fn: () => void,
): void {
  const parentCtx = action._traceparent
    ? propagation.extract(context.active(), { traceparent: action._traceparent })
    : context.active();

  context.with(parentCtx, () => {
    wsTracer.startActiveSpan(`ws.${action.action}`, (span) => {
      span.setAttributes({
        [ATTR.ACTION_TYPE]: action.action,
        [ATTR.ROOM_ID]: action.roomId,
        [ATTR.USER_ID]: action.userId,
        [ATTR.FPP_WS_CONNECTION_ID]: connectionId,
      });
      const start = performance.now();
      try {
        fn(); // handler body; the domain event/metric fire inside the entity
        metrics.actionCount.add(1, { [ATTR.ACTION_TYPE]: action.action, [ATTR.OUTCOME]: 'ok' });
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        recordError(err as Error, { component: 'messageHandler', action: action.action }, 'high');
        metrics.actionCount.add(1, {
          [ATTR.ACTION_TYPE]: action.action,
          [ATTR.OUTCOME]: 'error',
          [ATTR.ERROR_TYPE]: (err as Error).name, // bounded enum, never the message
        });
        // Swallow: one bad action must not tear down the socket.
      } finally {
        metrics.actionDuration.record((performance.now() - start) / 1000, {
          [ATTR.ACTION_TYPE]: action.action,
        });
        span.end();
      }
    });
  });
}
```

`heartbeat` **bypasses** `instrumentAction` entirely — dispatched before the wrapper, it emits no span/event/metric and only refreshes liveness. (Today *every* message, including heartbeat, gets a span — noise this removes.)

Worked example — manual flip. The handler stays thin; the entity is the single chokepoint reached by both the manual action and the auto-flip timer:

```ts
// message.handler.ts
case 'flip':
  instrumentAction(action, ws.id, () => room.flip('manual'));
  break;

// room.entity.ts — flip() is the sole source of the round.flipped signal
flip(trigger: 'manual' | 'auto') {
  // ...existing mutation; compute voteCount, distinctValues, consensus, durationSec...
  const span = trace.getActiveSpan(); // present for manual, absent for the timer
  span?.setAttributes({ [ATTR.ROUND_VOTE_COUNT]: voteCount, [ATTR.ROUND_CONSENSUS]: consensus });
  recordEvent(EVENT.ROUND_FLIPPED, {
    [ATTR.ROOM_ID]: this.id,
    [ATTR.ROUND_VOTE_COUNT]: voteCount,
    [ATTR.ROUND_DISTINCT_VALUES]: distinctValues,
    [ATTR.ROUND_CONSENSUS]: consensus,
    [ATTR.ROUND_DURATION]: durationSec,
    [ATTR.FLIP_TRIGGER]: trigger,
  });
  metrics.roundFlipped.add(1, { [ATTR.FLIP_TRIGGER]: trigger, [ATTR.ROUND_CONSENSUS]: consensus });
}
```

---

## 10. Per-service wiring

**fpp-server (primary).** It already mounts `@elysiajs/opentelemetry`. Add a `MeterProvider` via the plugin's `metricReader` option (or a standalone `PeriodicExportingMetricReader` + `OTLPMetricExporter` from `@opentelemetry/exporter-metrics-otlp-proto`, matching the existing proto exporters, pointed at `${BASE_URL}/v1/metrics`, `exportIntervalMillis: 60_000`). Instantiate all instruments once from `METRIC` in `telemetry.ts`; expose typed handles. Register the three `*.active` observable callbacks against `roomState` after it exists at startup (they read the Maps each collection cycle — no per-event bookkeeping). Then instrument the actions via `instrumentAction` (transport/RED) + entity-level `recordEvent`/metric (domain), per §9.

**Resource attributes (all services).** Add `service.namespace: 'free-planning-poker'` to every service's resource so HyperDX groups the three as one app, alongside the existing `service.name` / `service.version` / `deployment.environment`. Consider `service.instance.id` to disambiguate instances during rolling deploys.

**Sampling.** Keep 100% trace sampling — at 50–200 concurrent rooms the volume is trivial and full fidelity beats the savings. Metrics are aggregated (not sampled); events are 100%. Revisit head/tail sampling only if span volume becomes a real cost.

**apps/web.** Emits **events**, not metrics (the browser is not authoritative for room state, and the server already counts everything). Align the facade to `recordEvent`; add client-only events (`ws.reconnected`, queue-flush, client-side errors). Server-side Next.js metrics are out of scope unless a tRPC RED need emerges. `@vercel/otel` can host a MeterProvider if that day comes.

**fpp-analytics.** Add a small RED set for its own endpoints (request count, duration, error count by `endpoint`) via `PeriodicExportingMetricReader` + OTLP HTTP metrics exporter. Mirror the relevant constants in `telemetry_taxonomy.py`.

---

## 11. Enforcement

**Types (primary).** `recordEvent`/`recordError`/`metrics.*` accept only `ATTR.*`-keyed attribute objects and `EVENT.*`/`METRIC.*` names. Raw string keys/names don't compile. This is the strongest guard and it's free.

**ESLint (backstop).**
- Extend the existing `apps/web` `no-restricted-imports` block to **`apps/server`** (currently absent there): ban `@opentelemetry/api-logs` (`logs`) and `@opentelemetry/api` `metrics` outside the facade; ban `@hyperdx/browser` outside `instrumentation-client.ts`.
- Add `@opentelemetry/api` `metrics` and `getMeter` to the restricted list so meters are only created inside the facade/`telemetry.ts`.
- Keep the facade/instrumentation files on the existing `no-restricted-imports: off` allowlist.
- Raw string-literal attribute keys can't be banned via oxlint (`no-restricted-syntax` unsupported) — the typed registry covers that gap.

**Project rule + CLAUDE.md.**
- New `free-planning-poker/.claude/rules/observability.md` with `paths:` over the telemetry/facade/handler files, codifying §3 (decision matrix), §4 (naming), and §7–8 (taxonomy). This is what keeps future AI edits on-pattern.
- Update the root `CLAUDE.md` "Error Handling Standards" section: replace the `addBreadcrumb`/`captureMessage` guidance with `recordEvent`/`recordError`/`metrics`, and link this spec.
- Purge stale telemetry guidance from `apps/server/CLAUDE.md`: it still documents Sentry-era sampling ("Performance tracing: 10% in production", "Connection errors sampled at 10%") and a `SENTRY_DSN` env var that no longer match the code (100% sampling, no Sentry). Correct in the same pass.

---

## 12. Dashboards (HyperDX) — deferred

> **Not in this effort.** The current goal is to *collect* the right signals with the right shape. Dashboards come later, once data has accumulated. This section is the eventual target so the taxonomy is designed to support it — not a deliverable now.

Target panels once signals land. Source per panel in brackets.

- **Room RED** [Metrics]: action rate (`fpp.action.count` by `action.type`), error rate, p50/p95/p99 (`fpp.action.duration`).
- **Live concurrency** [Metrics]: `fpp.user.active`, `fpp.room.active`, `fpp.ws.connections.active` as time series + current value.
- **Vote distribution** [Metrics]: `fpp.vote.cast` by `vote.value` — which cards people actually pick.
- **Consensus rate** [Metrics]: `fpp.round.flipped` split by `round.consensus`.
- **Session funnel** [Logs/events]: `room.created` → `room.joined` → `vote.cast` → `round.flipped`, grouped by `room.id` via ClickHouse SQL — completion and drop-off.
- **Per-room drill-down** [Logs/events]: filter events by `room.id` to replay a session timeline (this is exactly what high-cardinality events are for).

> **Verify before building:** ClickStack metrics ingestion is functional but still maturing (PromQL-in-ClickHouse is a 2026 roadmap item; research confidence was *medium*). Phase 0 smoke-tests one counter end-to-end before any metric dashboard work. Events ride the already-proven logs pipeline, so the funnel/drill-down panels are low-risk regardless.

---

## 13. Cardinality budget

- Hard SDK default: 2,000 series per metric. Keep each metric's label cross-product **under ~200** (order-of-magnitude buffer).
- `fpp.action.count`: `action.type` (12) × `outcome` (2: ok\|error) = 24, plus `error.type` only on the error path (bounded by exception-class names). Safe.
- `fpp.vote.cast`: `vote.value` = bounded deck (~13). Safe.
- Configure SDK **Views** with an explicit attribute allowlist per metric so a stray `room.id`/`user.id` passed at a record site is dropped before export, not just by convention.
- `error.type` on any error-path counter must be a documented low-card enum, never a raw exception message.

---

## 14. Breaking changes & migration impact

- **Saved HyperDX queries/dashboards** referencing `ws.roomId`, `ws.userId`, `fpp.userId`, `fpp.breadcrumb`, `fpp.category` break. There are no shared/saved dashboards of note yet (per [README](README.md): only a basic errors view was planned), so impact is low — but re-point any that exist.
- **`addBreadcrumb` semantics change** from `fpp.breadcrumb=true` log records to `event.name` log records. Any ClickHouse query filtering on `fpp.breadcrumb` must move to `event.name IS NOT NULL` / a specific name.
- Call-site churn (~280 sites) is staged behind deprecated aliases (§6), not a single diff.

---

## 15. Open questions

1. **`room.type`** — *Resolved: dropped.* There is only one room type today, so no `room.type` label exists on any metric or event. Re-introduce only if a real low-card split (e.g. deck type) appears later.
2. **Browser metrics** — confirmed out for v1. Revisit only if a client-side RED need (e.g. WS reconnect rate as a metric vs derivable from events) proves real.
3. **Python taxonomy generation** — hand-kept for v1; decide later whether to codegen `telemetry_taxonomy.py` from the TS registry in CI.
4. **Exception-as-event migration** — when do we wire the OTEP-4430 converting processor and move `recordError` off `span.recordException()`? Tracked, not blocking.
5. **Null/deselect votes** — *Resolved: emit `vote.cleared`.* A null `estimate` is a deselect → emit `vote.cleared` (event only, no metric) so "changed my mind"/indecision rate is measurable; `vote.cast` fires for non-null values only.
6. **Observable gauges** — *Resolved: adopted.* The three `*.active` metrics read the authoritative `roomState` Maps via async callbacks (§8), not manual ±1.
7. **Rolling-deploy gauge overlap** — *Accepted.* During a zero-downtime RollHook rollout, old+new fpp-server instances both report `*.active` briefly; since these are additive, totals can double-count for seconds. Acceptable; `service.instance.id` lets you disaggregate if needed.

---

## 16. Phased execution

| Phase | Scope | Gate |
|-|-|-|
| 0 | Smoke-test metric ingestion: one throwaway counter → confirm it lands in `otel_metrics_*` in ClickHouse | Metrics pipeline confirmed |
| 1 | `@fpp/shared/telemetry` registry (`ATTR`, `EVENT`, `METRIC`) + types | typecheck green |
| 2 | fpp-server: MeterProvider wiring, instrument handles, instrument all 12 actions (span attrs + `recordEvent` + metrics) | events + metrics visible for flip flow |
| 3 | Attribute rename (camelCase → domain-first) + facade verb rename across web + server — **clean break, no aliases** | all call sites migrated |
| 4 | web: align facade to `recordEvent`; client-only events | — |
| 5 | analytics: endpoint RED metrics + `telemetry_taxonomy.py` | — |
| 6 | Enforcement: ESLint (server + meter bans), `.claude/rules/observability.md`, CLAUDE.md update | lint green |
| 7 | SDK Views (allowlist), validation | cardinality bounded |
| — | _Deferred:_ HyperDX dashboards (§12) | not in this effort — data collection only |

---

## 17. Success criteria

- [ ] fpp-server emits all §8 metrics; they chart in HyperDX.
- [ ] Every one of the 12 WS actions emits its §7 event with domain-first attributes.
- [ ] A single trace for the flip flow shows `room.id`/`user.id`/`action.type` on the WS span.
- [ ] Attribute keys are 100% snake_case/domain-first or `fpp.*`-proprietary; no camelCase keys remain.
- [ ] All telemetry attribute/event/metric strings originate from `@fpp/shared/telemetry` (no raw literals outside it).
- [ ] No metric carries `room.id` or `user.id`; SDK Views enforce the allowlist.
- [ ] ESLint bans direct `logs`/`metrics`/`@hyperdx/browser` imports in **both** TS services.
- [ ] `.claude/rules/observability.md` exists and CLAUDE.md points to this spec.
- [ ] No `addBreadcrumb`/`captureMessage` verbs remain (clean rename to `recordEvent`/`recordError`).
- [ ] _(Deferred)_ Dashboards — out of scope for this effort; data collection only.
