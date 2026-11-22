---
paths:
  - "packages/telemetry/**"
  - "apps/*/src/**/telemetry*"
  - "apps/*/src/**/instrument*"
  - "apps/*/src/**/*.events.ts"
---

# Telemetry names and the content policy

Telemetry is how a red production is understood without a person watching, and it must never become a second place a hidden vote or a name can leak (invariants 4 and 11).

## The rule

- **Every attribute, event and metric name is declared in `@fpp/telemetry`** and imported from there; no raw telemetry string anywhere else. OpenTelemetry APIs are imported in `packages/telemetry` only.
- **Never carried**, in any span, log, metric or analytics event: a vote value, a display name, a room name or slug, a topic title, a tracker key, an access code, user input. A room appears as its numeric id, a seat as its index. Metric labels are `build` and fixed enums only.
- **Never captured as an error**: a user mistake or business conflict (it is a `nack` or a typed response), WebSocket close 1006.
- **Capture once**, at a boundary: the runtime's command boundary, Elysia's `onError`, the browser's global handlers, through `recordError(error, { component, action }, severity)`. Code below a boundary never catches to log. No untyped `extra` bag.
- Domain events are emitted by the adapter from the reducer's output, never inside the reducer; events are log records with `event.name`; gauges are callbacks that sample state.
- **Umami events** are named in `@fpp/telemetry` too (`room_created`, `vote_cast`, ...), sent with `umami.track` by the client that caused them; an event from inside a room names its activity; event data holds buckets and enums, never a value, a name or a slug. The device id is never handed to Umami.
- Browser telemetry is errors and connection state only, as OTLP logs to `/api/otel`, with a session id that lives in memory for one page load. No replay, no field web vitals, no cookie (invariant 10).
- Service names are `fpp-api`, `fpp-room`, `fpp-site`; the row that first emits one registers it in the vps repo's `observability/services.yaml` in the same change.

## Why

`docs/v9/ARCHITECTURE.md`, Measurement and Invariants 10, 11; `docs/v9/ENGINEERING.md`, Code patterns (what carries over from v1). `docs/observability.md` describes v1's setup, not this one.

## The check

The telemetry content test fails when a display name, slug or vote value appears in any exported span, log or metric (from `v9-api-telemetry` on); a registry test fails on a free-string property of an Umami event (from `v9-umami-events` on). oxlint restricts OpenTelemetry imports to `packages/telemetry`.
