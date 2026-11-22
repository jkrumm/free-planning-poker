# packages/telemetry

The names every telemetry signal carries, and the facades that send them. Rule `telemetry.md` (what is never carried, capture once) applies to every file here; `docs/v9/ARCHITECTURE.md`, Measurement, is the contract.

## Where things are

| Path | Holds |
|-|-|
| `src/names.ts` | pure: services, resource attributes, `ATTR`, `EVENT`, `SPAN`, `METRIC` and `METRIC_LABELS` (the labels each metric may carry) |
| `src/umami.ts` | pure: the registry of Umami's events and their properties; a property is a boolean or a closed list |
| `src/facade.server.ts` | the only import of OpenTelemetry: `createServerTelemetry` builds spans, metrics, log records, `recordError`, `recordEvent` |
| `src/facade.browser.ts` | `track(event, data)` for `window.umami`; browser telemetry (errors, connection state) joins it in `v9-browser-telemetry` |
| `src/facade.memory.ts` | in-memory exporters and `leaksIn`, for tests only |

## Rules that are easy to miss

- **A new name goes into the registry first**, then is emitted. `test/names.test.ts` fails on a registered name or any `fpp.` literal in another package, and on an OpenTelemetry import there; oxlint refuses the import too.
- **No SDK without an endpoint.** `createServerTelemetry` builds nothing when `endpoint` is undefined and no exporter is given: calls run, nothing is recorded or sent. Never default an endpoint to localhost.
- **An error is exported by its type and its stack frames, never its message**: a database error's message holds the row. Add context as `component` and `action`, not as text.
- **A metric label comes from `METRIC_LABELS`**: the SDK's view drops any other attribute before export. A room is its numeric id and a seat its index, on spans only, never on a metric.
- **The `@opentelemetry/api` peer range of `sdk-trace-base` (2.x) stops below 1.10 while the other SDK packages need 1.10**: bun warns on install; it works because the API is a duck-typed global. Remove the warning when `sdk-trace-base` 3 clears the 3-day release age.
- **The content test is `apps/api/test/telemetry/content.test.ts`**: it plays a round with markers as names, slug, votes, topic, key, code and device id and fails on any in an export. Extend its markers when a new kind of user input reaches the runtime.
