# Bun and Elysia as the backend

Research run of 2026-11-18 (`agw research`, depth deep). Run status: partial. Citations grounded against fetched pages: 39/49. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line

- **Elysia:** 1.4.32 is the npm `latest` stable line. The 2.0 line is still pre-release: `rc` tag 2.0.0-rc.3, `next` 2.0.0-beta.32, `experimental` 2.0.0-exp.64. For a production launch in November 2026, pin 1.4.x and plan the move to 2.0 after a stable 2.0 ships.
- **Eden Treaty:** end-to-end typed REST and typed WebSocket `subscribe()` from the server's exported app type. This is the strongest reason to pick Elysia for a TypeScript monorepo.
- **Validation:** Elysia accepts Standard Schema validators (Zod, Valibot, ArkType, Effect, Yup, Joi) next to its own TypeBox-based `t`. OpenAPI generation for Zod and Valibot needs an explicit mapper.
- **OpenTelemetry:** traces and HTTP request metrics work through `@elysia/opentelemetry`; the older `@elysiajs/opentelemetry` package is superseded. Logs on Bun are not documented in the sources I could verify and remain open.
- **Bun.sql vs postgres.js:** Bun.sql is a sound default for Postgres (pool limits, `prepare: false`, TCP keepalive). I found no independent head-to-head benchmark, so choose on features and operational fit, not on speed.
- **Drizzle:** stable is 0.45.4. 1.0 is at release candidate rc.5 (21 Oct 2026) with breaking changes, and Drizzle's Bun SQL page installs the rc line.
- **Bun test runner:** coverage, JUnit XML, concurrent tests and `mock.module` are all built in. That is enough for a solo project.
- **Graceful drain:** Bun's `server.stop()` waits for open WebSockets by default. A reported hang after server-initiated closes (Bun issue 36223) was fixed on main in July 2026; you need your own drain sequence with a timeout, and must test against the exact Bun version you pin.
- **Images:** `oven/bun:1-alpine` is about 40 MB compressed (amd64). The Bun 1.4 runtime binary is 77.0 MB on Linux x64, so a compiled single-file server is in that range plus your code.
- **Hono on Bun:** smaller and more portable across runtimes. Elysia has the richer typed client and WebSocket story. Most performance claims in both camps are vendor-reported.

## 1. Versions and maturity (as of 18 Nov 2026)

| Component | Current release | Date / status | Maturity |
|---|---|---|---|
| Elysia 1.4 | 1.4.32 (npm `latest`) | Published around early Nov 2026 per npm's version list | Stable |
| Elysia 2.0 | 2.0.0-rc.3 (`rc` tag), rc.4 also listed; 2.0.0-beta.32 (`next`); 2.0.0-exp.64 (`experimental`) | Beta announced 30 Jul 2026; rc builds in Oct-Nov 2026 | Pre-release, not stable |
| Elysia 1.4 line | Standard Schema support added | Elysia 1.4 blog dated 13 Sep 2025 | Stable |
| Bun | 1.4 released 20 Aug 2026; 1.4.1 on 4 Sep 2026; 1.4.2 on 11 Sep 2026; npm `bun-types` latest 1.4.4 | Bun 1.4 rewrote the runtime from Zig to Rust (per Bun's own post) | Stable, fast-moving |
| Drizzle ORM | 0.45.4 (npm `latest`); 1.0.0-rc.5 | rc.1 30 Apr 2026, rc.4 27 Jun 2026, rc.5 21 Oct 2026; no 1.0 GA found | Stable 0.45; 1.0 is RC |
| Hono | 4.13.19 (npm `latest`) | Mature | Stable |
| `@elysia/eden` | 1.4.10 | The old `@elysiajs/eden` npm package (1.4.9) is stale | Stable |
| `@elysia/opentelemetry` | 1.4.12 | The old `@elysiajs/opentelemetry` (1.4.11) does not record the HTTP request metric | Stable |
| `@elysia/openapi` | 1.4.17 | Replaces the older Swagger-based plugin name | Stable |

Licences: Elysia is MIT according to npm metadata of an old version. I did not check licences for Bun, Drizzle, postgres.js or Hono.

**Elysia 2 status.** Elysia calls 2.0 a complete rewrite and says the beta 'is not a stable release yet'; it installs via `elysia@next` and an auto-migration codemod (`bunx @elysia/codemod@latest`). Its own numbers (vendor-reported): a no-schema-library bundle is 344 KB in 2.0 versus 736 KB in 1.4; with Zod it is 868 KB versus 1,260 KB; startup for 1,000 routes with TypeBox is 43 ms. Breaking changes are real: a third-party plugin (`elysia-db-ratelimiter`) had to rename `onBeforeHandle` to `beforeHandle(scope, fn)` to support the 2.0 beta.

The Eden and WebSocket examples I read come from the 2.0-channel docs (next.elysiajs.com). I did not diff them against 1.4 docs, so treat the exact API below as 2.0-channel unless noted.

## 2. Eden Treaty (end-to-end types)

- Import `treaty` from `@elysia/eden` and create the client with `treaty<typeof app>('localhost:3000')`. The client needs the server's app type, so the server must export its `App` type from a shared package in the monorepo.
- Calls return `{ data, error }`. A handler that returns `status(400)` narrows the error type on the client; `data` stays nullable until checked.
- WebSocket: `api.chat.subscribe()` returns an `EdenWS` wrapper with typed `send`, `subscribe` and `on`; `chat.ws` gives the native socket. Browsers cannot set custom headers on a WebSocket, so authentication must use cookies or a server-approved flow.
- Not verified: whether Eden's inference is preserved end to end when routes use Zod or Valibot via Standard Schema. Elysia says types are inferred from the schema, but I did not test this with Eden.

## 3. WebSocket API

**Elysia layer.** `.ws(path, { body, response, open, message, close, drain, ping, pong, beforeHandle, upgrade, ... })`. The `body` schema validates incoming messages and the handler's return value becomes a reply. The 2.0 docs add the `websocket()` plugin from `elysia/websocket`. Elysia's reference lists these defaults: `idleTimeout` 120 s, `maxPayloadLength` 16 MB, `backpressureLimit` 16 MB, `closeOnBackpressureLimit` false, `sendPings` true, `publishToSelf` false.

**Bun layer.** One handler object per server rather than per socket. The `data` property types `ws.data`. Native `subscribe` and `publish` pub/sub. Per-message deflate. The `idleTimeout` default is 120 s (range 0 to 960). Bun's docs recommend checking the `Origin` header before `server.upgrade()`, because the same-origin policy does not cover WebSocket handshakes (cross-site WebSocket hijacking).

**Backpressure.** Bun 1.4.1 added `pause()` and `resume()` on the client WebSocket and notes that the WHATWG API cannot stop reading without closing, so unread messages accumulate in memory. The same risk applies on the server side for slow consumers; set `closeOnBackpressureLimit` deliberately.

**Scaling note (my inference, not a documented statement).** Bun's pub/sub is in-process. During a rolling deploy two containers run side by side, so fan-out across them needs an external bus (Postgres LISTEN/NOTIFY or Redis), or one instance must own each room.

## 4. Validation: Standard Schema vs TypeBox, and OpenAPI

- Elysia's `t` builder is TypeBox-based and gives runtime validation, compile-time types and OpenAPI from one source. Elysia 2 moves to TypeBox 1.3 and can tree-shake TypeBox when it is unused.
- Standard Schema (since 1.4) accepts Zod, Valibot, ArkType, Effect Schema, Yup and Joi. Several validators can be mixed in one app. Two caveats from the docs: Standard Schema does not validate file content types automatically (use Elysia's `fileType` helper), and `t.Accelerate` (alpha) converts Standard JSON Schema into a TypeBox compiler for speed.
- Elysia 2 bundle figures (vendor-measured, minified 'hello world' per the blog): without AOT, None 344 KB, TypeBox 847 KB, Valibot 350 KB, Zod 868 KB; with the AOT build plugin, None 226 KB, TypeBox 288 KB, Valibot 266 KB, Zod 784 KB. The blog says the un-minified 226 KB is 141 KB minified.
- **Choice for this app.** The SPA and the API share schemas, so the validator size matters on the client too. Valibot is the smallest in Elysia's table; Zod has the larger ecosystem and more team familiarity. TypeBox only makes sense if you want Elysia's native `t` and the AOT compile path. Either way, put schemas in a shared package behind Standard Schema, so the validator can change later.
- **OpenAPI.** `@elysia/openapi` 1.4.17 serves Scalar by default at `/openapi`, emits OpenAPI 3.1.2 by default, and converts Standard Schemas through the vendor's `~standard.jsonSchema` or a `mapJsonSchema` entry. For Zod v3/v4, Valibot and Effect the plugin prints one-time warnings with setup instructions unless you configure `mapJsonSchema`. Plan that configuration from day one.

## 5. OpenTelemetry on Bun

| Signal | Status on Bun with Elysia | Evidence |
|---|---|---|
| Traces | Supported. `.use(opentelemetry())` before routes creates spans per request and per lifecycle hook (named functions give readable span names). `record()` wraps custom spans; SSE and streaming are supported. Raw `Bun.serve` is not auto-instrumented, so raw servers need manual spans. | Elysia OpenTelemetry docs; SigNoz Bun guide |
| HTTP metrics | Supported by `@elysia/opentelemetry` (`http.server.request.duration`). The old package up to 1.4.11 does not record it. | SigNoz guide (tested with Bun 1.4.2, Elysia 1.4.30, `@elysia/opentelemetry` 1.4.12) |
| Runtime and host metrics | Supported via `RuntimeNodeInstrumentation` and `HostMetricsInstrumentation` with a `PeriodicExportingMetricReader`. | SigNoz guide |
| Node instrumentations | Bun 1.4 says `@opentelemetry/instrumentation-http` and `-fs` export spans for `node:http` and `node:fs`. An opentelemetry-js issue (Nov 2026, title read only) reports no HTTP server spans on Bun 1.4.4+ once `node:https` is loaded. Not reproduced here. | Bun 1.4 post; opentelemetry-js issues |
| Logs | Not documented in the Elysia or SigNoz Bun guides. A Bun issue (Jan 2026) shows an `OTLPLogExporter` used with Bun, but its status is unknown. **Open.** | Bun issue 26536 (snippet only) |

Further points: Railway's docs (Nov 2026) state that Bun has no built-in OpenTelemetry and that automatic instrumentation does not support Bun. Elysia recommends a `bunfig.toml` preload for instrumentation that must start before libraries load. Minifying the compiled binary shortens function names and breaks span names, so use `--minify-whitespace --minify-syntax` instead. Libraries that OpenTelemetry monkey-patches must be marked `--external` and shipped in `node_modules`.

## 6. Bun.sql vs postgres.js, and Drizzle

**Bun.sql** (built in; the same API also covers MySQL, MariaDB and SQLite per InfoQ):
- Pool options: `max`, `idleTimeout` (closes idle connections; never interrupts running work), `maxLifetime`, `connectionTimeout` (applies to establishing a connection, not to a running query). Bun does not open a connection until a query runs.
- TCP keepalive is 60 s for PostgreSQL and MySQL, so a vanished server fails queries instead of hanging.
- `prepare: false` disables persisted named prepared statements on PostgreSQL. This is my inference, not stated in the docs: it matters when the pooler runs in transaction mode.
- `onconnect` and `onclose` callbacks are available.

**Performance.** Bun's homepage shows 20,243 queries/s for Bun v1.4 against 10,000 for Node.js (100 rows, 100 in flight, localhost PostgreSQL 18.3), with a Bun.sql versus postgres.js chart I did not read in full. That is vendor-run. Independent data is thin: the postgrejs benchmark (Bun 1.4.2, Oct 2026) compares PostgreJS with `pg` and postgres.js but not Bun.sql; a July 2026 Bun REST benchmark used postgres.js 3.4.9 on Bun 1.3.14 with no Bun.sql comparison. I found no independent Bun.sql versus postgres.js number. Decide on features, operations and driver risk.

**Drizzle.** Stable 0.45.4 is the npm `latest`. 1.0 release candidates: rc.1 (30 Apr 2026, per Drizzle's post), rc.4 (27 Jun 2026), rc.5 (21 Oct 2026). rc.5 breaking changes include: the postgres-js parser fix (driver-level serializers no longer overwritten, so manual `JSON.stringify` workarounds must be removed); relational `where` with `undefined` now throws (use `EmptyFilter`); empty relation filters such as `{}` no longer generate an `exists` check; `withReplicas` sends every query to the primary unless you call `db.$replica`; RQB v2 query strategy on pg and MySQL, with a per-query `strategy: 'basic'` opt-out; `paramsInErrors` to include parameters in errors.

Bun SQL with Drizzle: the official Drizzle page installs `drizzle-orm@rc` and `drizzle-kit@rc` and uses `import { drizzle } from 'drizzle-orm/bun-sql'`, `drizzle(process.env.DATABASE_URL!)`. Drizzle's 2024 release notes say the bun-sql driver arrived in 0.39.0, so the stable line may already include it. The docs now point to the rc line, so this is conflicting and needs a spike before you commit.

## 7. Bun's test runner

- **Coverage:** `bun test --coverage` prints a per-file table of function and line coverage with uncovered line numbers. Coverage thresholds were not verified.
- **JUnit:** `bun test --reporter=junit --reporter-outfile=./junit.xml` writes XML and creates the folder if needed; console output is unchanged.
- **Concurrency:** `bun test --concurrent` runs tests within each file in parallel unless marked `test.serial`. Bun 1.4 adds `bun test --parallel` across files.
- **Mocks:** `mock()` and `mock.module()` replace a package's exports for the test; `spyOn` is available. Vitest runs under Bun, including `--coverage`, per Bun 1.4.
- **Caveat (inference):** tests that touch in-memory room state need isolated fixtures when run concurrently.

## 8. Graceful shutdown and WebSocket draining for rolling deploys

**What Bun does.** `server.stop()` stops accepting connections, closes idle keep-alive connections immediately, and waits for in-flight requests and open WebSockets to finish. `stop(true)` terminates everything, and open WebSockets close with code 1001. The promise resolves once every connection has closed. Elysia's `app.stop(closeActiveConnections?)` delegates to the adapter; `onStop` runs as a hook; `Symbol.dispose` calls stop.

**The hang.** Bun issue 36223 (opened 28 Jul 2026, Bun 1.3.14, macOS arm64) reports that `server.stop(true)` never resolves once the server has closed a WebSocket itself with `ws.close(1001)` or `ws.terminate()`. Client-closed or left-open sockets were fine. A Bun collaborator reproduced it and said it is fixed on main (canary 1.4.0) and will ship in the next release. I did not confirm which stable release contains the fix. Treat a bounded wait as mandatory.

**Practical drain sequence (my design, not a documented Bun pattern):**
1. On SIGTERM, fail readiness so Traefik stops routing new upgrades to this container.
2. Send each room socket a 'draining' message with a reconnect hint.
3. After a short grace period, close remaining sockets with 1001 or an app-specific code.
4. Await `server.stop(true)` inside `Promise.race` with a timeout, then exit before Docker's kill timeout (set the container stop grace period above your drain budget; general Docker behaviour, not checked in this review).
5. Clients reconnect with jittered backoff and rejoin by their client-generated id.

**Overlap problem.** During a rolling deploy two containers run at once, and each holds its own in-memory rooms. A client that reconnects to the new container finds no room unless state was persisted. The practical options are: persist room state to Postgres on each vote, reveal and join, and rehydrate on the new instance; or accept room loss at deploy time and make reconnect prompt the user to rejoin. This is the biggest design decision in the current architecture.

**Idle and ping defaults.** Bun's idle timeout is 120 s; Elysia sends pings by default, which keeps mobile connections from being reaped silently.

## 9. Docker image size and single-file executables

- **Base images (compressed, Docker Hub listings):** `oven/bun:1-alpine` 40.33 MB on linux/amd64 (pushed about Sep 2026); `oven/bun:alpine` 54.63 MB on linux/amd64 (pushed Nov 2026); `oven/bun:1.4.1-slim` 69.4 MB on linux/arm64. Debian, slim, alpine and distroless variants exist.
- **Bun 1.4 runtime binary:** 77.0 MB on Linux x64, 76.8 MB on Linux arm64, 84.8 MB on Windows x64, 61.2 MB on macOS arm64 (Bun's own table; the app adds to this).
- **Compile recipe (Elysia's deploy page):** `bun build --compile --minify-whitespace --minify-syntax --target bun --outfile server src/index.ts`, run in a builder stage and copied into `gcr.io/distroless/base`. Elysia says compiled servers use roughly 2 to 3 times less memory than the dev runtime (vendor claim).
- **Targets:** `bun-linux-x64`, `-baseline` variants for older CPUs, and `-musl` variants. Elysia says the 'random Chinese characters' failure means the CPU lacks AVX2 and that there is no known workaround. The target table does list baseline builds; I did not verify whether they remove the AVX2 requirement.
- **OpenTelemetry and AOT:** instrumented packages need `--external`, so `node_modules` must ship next to the binary. The Elysia AOT build plugin dry-runs the app, so database pools keep the build process alive; call `process.exit(0)` after the build.
- **Final image size for this app** was not measured. Expect the distroless base plus the binary plus assets; measure it before quoting a number.

## 10. Known production pitfalls

1. **Bun point releases regress.** Bun 1.4.1 had a `bun build` rename bug that broke Elysia apps and an AsyncLocalStorage memory leak; both were fixed in 1.4.2 (Bun homepage release note). Pin the exact Bun version and rerun the drain test on every bump.
2. **`server.stop()` can hang** after server-initiated WebSocket closes (issue 36223); see section 8.
3. **`server.stop()` waits for WebSockets by default.** Without an explicit close and a timeout, a rolling deploy can stall until the orchestrator kills the process.
4. **Slow consumers accumulate memory** when messages arrive faster than they are processed (Bun 1.4.1). Set `backpressureLimit` and `closeOnBackpressureLimit` intentionally.
5. **Minified compiled binaries lose span names;** instrumented libraries must be `--external` and ship `node_modules`.
6. **OpenTelemetry HTTP server spans** may disappear on Bun 1.4.4+ once `node:https` loads (opentelemetry-js issue, title only read).
7. **Elysia 2 migrations break plugins**: hook names and scope syntax changed (see section 1).
8. **Drizzle rc churn**: the postgres-js parser change and RQB defaults can change query results; test the upgrade path.
9. **Cross-site WebSocket hijacking**: check `Origin` before upgrade, because cookies are sent on the handshake.
10. **Browsers cannot send WebSocket headers**: plan the auth flow (cookie or token in the first message) before building the room protocol.
11. **Bun is a moving target**: the 1.4 rewrite from Zig to Rust is large, so keep upgrades deliberate.
12. **In-process pub/sub** does not fan out across instances (section 3).

## 11. Hono on Bun, briefly

- **Hono** 4.13.19 is multi-runtime (Cloudflare Workers, Deno, Bun, Node.js) with a WebSocket helper and a Bun adapter package (`@hono/bun`), per Hono's docs updated 16 Nov 2026.
- **Size:** Elysia's blog table lists Hono 4.12.28 at about 21 KB minified for a hello-world; Elysia 2 at about 141 KB minified (both vendor-measured).
- **Memory:** Bun's 1.4.1 release notes show idle RSS after load of 34 MB for Hono and 44 MB for Elysia. Elysia's blog shows, after a load test, Hono at 73.9 MB and Elysia at 45.7 MB. These two sources disagree about who is lighter; both are vendor-run.
- **Throughput:** Elysia claims it leads Hono in most benchmarks; Hono's docs call it one of the fastest Bun frameworks. A third-party Bun 1.4.3 article shows Hono at 98,145 req/s for a JSON endpoint against Express at 55,382 (snippet only). Neither side is independent.
- **Typed client:** Elysia's Eden also covers WebSockets; I did not verify Hono's RPC client, so no comparison is claimed.
- **Fit:** Hono is the better choice if you want the server to move between runtimes. Elysia is the better fit if the API is Bun-only and you want Eden plus Elysia's WebSocket routing.

## 12. Recommendation

1. **Elysia:** start on 1.4.32 with an exact pin; do not start on 2.0 rc. Keep the handler code thin so the 2.0 move is a codemod plus fixes.
2. **Bun:** pin one exact 1.4.x release, add the drain test (section 8) to CI, and upgrade only after it passes.
3. **Validation:** Standard Schema through a shared schema package. Valibot if bundle size matters for the SPA; Zod if familiarity matters more. Configure `mapJsonSchema` for OpenAPI.
4. **Typed client:** Eden, with the server's app type exported from a shared package.
5. **OpenTelemetry:** `@elysia/opentelemetry` for traces and metrics to ClickStack over OTLP/HTTP. For logs, emit structured JSON with `trace_id` and `span_id` from the active span and verify the ingest path with a spike before relying on it.
6. **Postgres:** Bun.sql as the driver. For the ORM, either Drizzle 0.45.x on the postgres.js driver (zero RC risk) or Drizzle 1.0.0-rc.5 with `drizzle-orm/bun-sql` pinned exactly (accepts churn). For a schema this small, raw Bun.sql plus drizzle-kit migrations is also defensible.
7. **Tests:** `bun test` with `--coverage` and `--reporter=junit` in CI; `--concurrent` only for tests without shared state.
8. **Deploy:** compiled binary on distroless with a drain sequence and a room-state persistence decision.

**Main tradeoffs.** Elysia gives the best typed-client and WebSocket developer experience on Bun, but it depends on one maintainer team, and its major version is mid-migration. Hono is leaner and portable but needs more hand-wiring for typed WebSocket rooms. Bun.sql keeps the stack dependency-light but adds a runtime-specific driver to test. Compiled binaries are simpler to ship but make OpenTelemetry instrumentation fiddlier.

## 13. Must decide now (hard to retrofit)

1. **Room state ownership.** Is authoritative room state in process memory only, or persisted to Postgres and rehydrated? This determines how deploys behave and whether a single VPS can ever run two instances.
2. **WebSocket protocol versioning.** Add a protocol version to every message envelope, because cached SPAs keep old clients connected across deploys.
3. **Client identity.** The anonymous client-generated id in localStorage is the seat key for reconnection. Define its format and lifetime now (for example UUIDv7), and treat it as untrusted.
4. **Telemetry data policy.** Decide which attributes may be exported. Room ids and vote values should never appear in spans or logs, which fits the privacy-first brief and is hard to undo once data is stored.
5. **Schema package boundary.** Keep validators and types behind Standard Schema in a shared package, so the validator and the client-server type sharing can change without touching every route.
6. **Version pins and upgrade path.** Pin exact Bun and Elysia versions and write down the Elysia 2 migration plan now, while the surface is small.

## 14. Still open

- Elysia 2.0 general availability date and final API. Not stable as of 18 Nov 2026.
- Drizzle 1.0 general availability date, and whether the stable 0.45 line includes `drizzle-orm/bun-sql` without the rc tag.
- Independent Bun.sql versus postgres.js performance numbers.
- OpenTelemetry logs from Bun through the Elysia plugin or the OTLP log exporter.
- Which stable Bun release contains the issue 36223 fix, and whether the baseline builds remove the AVX2 requirement.
- End-to-end Eden type inference with Zod or Valibot Standard Schemas.
- Licences for Bun, Drizzle, postgres.js and Hono.
- Measured container size for this app.
- Hono's RPC client compared with Eden.

Most performance and memory figures in this report come from Elysia, Bun, Hono or Docker vendor material and should be treated as indicative.

## Not verified in this run

- Elysia 2.0 general availability date and final API: Only pre-release tags exist as of 18 Nov 2026; no stable 2.0 release found.
- Drizzle 1.0 general availability and whether stable 0.45 includes drizzle-orm/bun-sql without the rc tag: Drizzle docs pin rc, while 2024 release notes say bun-sql arrived in 0.39.0; conflict not resolved by a spike.
- Independent Bun.sql versus postgres.js performance: Only a vendor chart (not read in full) and benchmarks that do not compare the two drivers; no independent head-to-head found.
- OpenTelemetry logs from Bun via Elysia plugin or OTLP log exporter: Not documented in Elysia or SigNoz Bun guides; only a Jan 2026 issue snippet read.
- Which stable Bun release contains the fix for issue 36223: Fix reported on main/canary; the stable release notes read (1.4, 1.4.1) do not mention it.
- Whether Bun baseline builds remove the AVX2 requirement: Target table lists baseline variants; the page says no known workaround for the AVX2 error; not tested.
- Eden end-to-end type inference with Zod or Valibot Standard Schemas: Docs examples use TypeBox t schemas only; not tested with Standard Schema validators.
- Elysia 1.4 docs versus 2.0-channel Eden and WebSocket API differences: Examples were read from the next-channel docs; not diffed against 1.4 docs.
- Licences for Bun, Drizzle, postgres.js and Hono: Not checked in this review; only Elysia's MIT licence was seen, in old npm metadata.
- Final container image size for this application: Not measured; requires building the actual image.
- Hono RPC client compared with Eden: Hono's typed client was not read, so no comparison is made.
- Elysia throughput and memory versus Hono (independent): Only the repository snippet was seen; the run data was not read; vendor-run figures remain unverified.
- Coverage thresholds and mock.module behaviour across concurrent tests in Bun: Threshold configuration and process-wide mock scope were not confirmed in the docs read.
- Docker stop grace period and SIGTERM behaviour: General Docker behaviour used for the drain design; not checked against a source in this review.
- Drizzle's Bun SQL page installs drizzle-orm@rc and drizzle-kit@rc and imports drizzle from drizzle-orm/bun-sql: cited, but the page was never retrieved this run
- Eden Treaty: treaty<typeof app>, subscribe() returns EdenWS with send, subscribe, on; chat.ws gives the native socket; browsers cannot send headers: cited, but the page was never retrieved this run
- Eden responses return data and error; status(400) narrows error type on the client: cited, but the page was never retrieved this run
- Elysia ws route options and WebSocket defaults: idleTimeout 120 s, maxPayloadLength 16 MB, backpressureLimit 16 MB, closeOnBackpressureLimit false, sendPings true: cited, but the page was never retrieved this run
- Bun WebSocket idleTimeout range 0 to 960 seconds, default 120: cited, but the page was never retrieved this run
- Elysia lifecycle: onStop hook, stop(closeActiveConnections?) delegates to adapter, Symbol.dispose calls stop: cited, but the page was never retrieved this run
- Bun server.stop(): waits for in-flight requests and WebSockets by default; stop(true) terminates; open WebSockets close with 1001; promise resolves when all connections close: cited, but the page was never retrieved this run
- Bun SQL: pool options max, idleTimeout, maxLifetime, connectionTimeout; TCP keepalive 60 s; prepare false disables named prepared statements (PostgreSQL only); idleTimeout does not interrupt running work: cited, but the page was never retrieved this run
- bun test --coverage prints per-file function and line coverage with uncovered lines: cited, but the page was never retrieved this run
- bun test --reporter=junit --reporter-outfile writes JUnit XML and creates the folder: cited, but the page was never retrieved this run

## Sources

- https://registry.npmjs.org/elysia
- https://www.npmjs.com/package/elysia?activeTab=versions
- https://elysiajs.com/blog/elysia-20
- https://elysiajs.com/blog/elysia-14
- https://elysiajs.com/essential/validation
- https://elysiajs.com/patterns/opentelemetry
- https://elysiajs.com/patterns/deploy
- https://bun.com/blog/bun-v1.4
- https://bun.com/blog/release-notes/bun-v1.4.1
- https://bun.com/
- https://www.npmjs.com/package/bun-types
- https://www.npmjs.com/package/drizzle-orm
- https://orm.drizzle.team/docs/latest-releases
- https://github.com/drizzle-team/drizzle-orm/releases
- https://x.com/DrizzleORM/status/2049984883775447146
- https://orm.drizzle.team/?ref=launchnests
- https://www.npmjs.com/package/@elysia/eden
- https://bun.com/docs/api/websockets
- https://github.com/oven-sh/bun/issues/36223
- https://signoz.io/docs/instrumentation/opentelemetry-bun/
- https://docs.railway.com/observability/tracing/functions.md
- https://github.com/open-telemetry/opentelemetry-js/issues
- https://github.com/oven-sh/bun/issues/26536
- https://www.infoq.com/news/2026/01/bun-v3-1-release/
- https://www.postgrejs.com/docs/getting-started/benchmarks-bun
- https://npgsqlrest.github.io/blog/benchmarks-2026-07/bun.html
- https://context7.com/oven-sh/bun
- https://hub.docker.com/r/oven/bun
- https://hub.docker.com/layers/oven/bun/1-alpine/images/sha256-d73746a3e6cd8de6d7abff1c4c678028b6fe25e0c39808f9a71214589fa8b023
- https://hub.docker.com/layers/oven/bun/alpine/images/sha256-5a1fe2d60106ee903ee62008deab884376f18e07bbb6676cc86e9e1e1e710690
- https://hub.docker.com/layers/oven/bun/1.4.1-slim/images/sha256-13322d1181c5956d733e50e8250fd9343b7f9c422b6057e4c7aeaac98b9c746e?tab=layers
- https://www.npmjs.com/package/hono
- https://hono.dev/docs/helpers/websocket
- https://hono.dev/docs/concepts/benchmarks
- https://dev.to/fabwaseem/bun-vs-nodejs-in-2026-bun-14-vs-node-24-and-26-benchmarked-4pab
- https://encore.dev/articles/elysia-vs-hono
- https://context7.com/elysiajs/elysia-openapi
- https://www.npmjs.com/package/@elysia/opentelemetry
- https://github.com/extend-therapy/elysia-db-ratelimiter/releases/tag/v2.0.1-beta.1
- https://github.com/oven-sh/bun/pull/45858
- https://github.com/Dave93/elysia-benchmarks
- https://www.npmjs.com/package/elysia
- https://www.npmjs.com/package/@elysiajs/eden
- https://www.npmjs.com/package/@elysiajs/opentelemetry
- https://bun.com/docs/runtime/http/websockets
- https://context7.com/llmstxt/next_elysiajs_llms-full_txt
- https://context7.com/elysiajs/elysia
- https://www.npmjs.com/package/@elysia/openapi
- https://context7.com/drizzle-team/drizzle-orm-docs
