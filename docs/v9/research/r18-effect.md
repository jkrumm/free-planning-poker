# Effect for a Bun room server

Research run of 2026-11-20 (`agw research`, depth deep). Run status: ok. Citations grounded against fetched pages: 49/49. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line

- **Effect version and status:** Effect 4.0 is stable (released 30 Sep 2026). The npm `effect` package reads 4.1.4 as of 20 Nov 2026. Effect 3.x is feature-frozen and receives only bug and security fixes. The v4 line has a long-term-support policy, but several modules this project would touch are tagged unstable.
- **@effect/platform-bun:** It can serve Bun.serve WebSocket upgrades and streams. Its documented API does not expose Bun's native publish/subscribe or the `send()` backpressure return codes. An open issue (#10607) reports unbounded buffering of inbound WebSocket frames.
- **RPC over WebSocket:** It has typed errors, streams with backpressure, and self-framing NDJSON. Reconnection is a documented `Effect.retry` pattern, not a built-in policy. RPC lives under the unstable import path.
- **Schema vs Zod 4:** Both work at an Elysia Standard Schema boundary. Zod 4 is much smaller in the browser by its own measure (5.36 kB gzip core, 1.88 kB for Zod Mini). Effect Schema adds encode/decode, JSON Schema, Arbitraries and native Effect integration. I did not retrieve a trustworthy current head-to-head benchmark table.
- **Bundle size:** Effect's own figure for a minimal Effect+Stream+Schema program is 35.6 kB (3.x) vs 7.1 kB (4.x), minified and gzipped. Independent reproduction has not been reported.
- **Elysia:** Elysia's docs list Effect Schema among Standard Schema validators. ManagedRuntime is the documented way to run Effect inside another framework's handlers. I found no Elysia-specific Effect integration.
- **Fiber overhead:** I found no current independent benchmark on Bun. In one 2022 fib micro-benchmark, Effect ran roughly 45x slower than plain sync code (derived from one old run). That is not decisive for a few hundred sockets, where I/O dominates.
- **Testing:** TestClock and Layer doubles make Effect-managed code deterministic for time and services. A seeded sans-IO simulator is a different tool and covers whole-system event interleavings. They complement each other.
- **OpenTelemetry:** Effect's v4 docs show `@effect/opentelemetry` installed with Bun. Core v4 also ships an OTLP exporter. I did not find Bun-specific validation.
- **AI agents:** Effect ships AI docs, skills, an MCP client, a language service and type-aware lint rules. I did not find a documented catalogue of agent failure modes from Effect. The mitigation evidence is mostly tooling.
- **Criticism:** The recurring complaints are learning curve, step-through debugging, readability and API churn during the v4 beta and RC.
- **Functional core:** Community guidance favours a pure core without Effect. I found no maintainer statement on this.
- **Recommendation:** Keep the reducer, the protocol frames (Zod 4) and the room loop as plain TypeScript. Use Effect only in the shell: the webhook worker, OAuth connectors, persistence adapter and startup/shutdown. Pin versions exactly.

## 1. Versions, release dates, Effect 4 status

- npm latest: `effect` 4.1.4 and `@effect/platform-bun` 4.1.4 (both read 20 Nov 2026). The npm `@effect/rpc` 'latest' is 0.76.2, the pre-consolidation line. v4 docs place RPC under `effect/unstable/rpc`.
- Timeline: v4 beta announced 18 Feb 2026, when Effect said v3 remained the recommended choice for production. Release Candidate on 12 Aug 2026. Stable 4.0 on 30 Sep 2026, after roughly eight months of beta and six weeks of RC per InfoQ. Effect 4.1 was released 2 Nov 2026, and 4.1.3 and 4.1.4 followed the week of 16 Nov.
- v3 is in a feature freeze. Bug and security fixes continue; 3.21.0 shipped in March 2026.
- LTS for 4.x: bug fixes until Sep 2029 or one year after 5.0, whichever is later; security fixes until Sep 2029 or two years after 5.0.
- Consolidation: all `@effect/*` packages share one version. Functionality from `@effect/platform`, `@effect/rpc` and `@effect/cluster` now lives in `effect`. Separate packages remain for `platform-*`, `sql-*`, `ai-*`, `opentelemetry`, `atom-*` and `vitest`.
- Stability caveat: modules under `effect/unstable/*` may break in minor releases. The beta post counted 17 such modules. The stable post says some newer modules are still tagged unstable or experimental.
- Breaking changes from 3.x, as listed in the RC notes: MessagePack and RPC serialization removed (moved to `effect/unstable/encoding/SchemaBinary`); Mime moved; Config constructors renamed to PascalCase (`Config.String`) and `mapOrFail` renamed `mapEffect`; fast-check no longer re-exported, and `Schema.toArbitrary` and `effect/testing/FastCheck` removed; `PgClient.fromPool` removed; pull-based Socket `run`, `runString`, `runRaw` and the send queue removed. Earlier in the beta, `ServiceMap` was renamed `Context`. Schema brand typing changed, and `Schema.brand` became type-only. A v3-to-v4 migration guide and a migration skill exist.

## 2. @effect/platform-bun

- Documented capabilities of `BunHttpServer` (v4 API reference, marked unstable): streaming bodies, multipart, file responses, and WebSocket upgrades. Other protocol upgrades fail, because Bun.serve cannot hand over the connection.
- Operational defaults to know: `idleTimeout` defaults to 0, which disables Bun's 10 s idle timeout. The reference warns that directly exposed servers should set it or sit behind a proxy. Graceful shutdown waits 20 s by default, then interrupts. Handlers are uninterruptible unless wrapped in `Effect.interruptible`.
- WebSocket options: lifecycle handlers are owned by the server and cannot be overridden. Options such as `perMessageDeflate`, payload limits and idle timeouts pass through.
- Bun's native surface (Bun docs): topic pub/sub via `ws.subscribe` and `server.publish`; `send()` returns -1 (queued with backpressure), 0 (dropped, closed, or above `backpressureLimit`) or the byte count; a `drain` callback; `ws.pause()` and `ws.resume()`; and a recommended Origin allowlist check before `server.upgrade()` to prevent cross-site WebSocket hijacking.
- Mapping: the Effect reference page I read exposes no publish/subscribe and no send return codes. Effect's Socket layer is pull-based, with a reader and a writer and end-to-end backpressure. Fan-out to room members would therefore be your own code, or raw Bun calls outside Effect's abstraction.
- Maturity: recent fixes include Bun and Deno `fileWebResponse` range options, teardown of an older Bun server, and FormData round-trips. Open issue #10607 says inbound WebSocket frames buffer without limit before the Socket reader. I could not confirm its current status.

## 3. @effect/rpc over WebSocket

- Definitions: `Rpc` declares tag, payload, success, error and defect schemas. `stream: true` yields `Stream<Success, Error>`. `exitSchema` encodes failures, including middleware error schemas.
- Wire protocol: a serialization format and a transport are chosen separately. Formats in the pre-RC docs were json, ndjson, jsonRpc, ndJsonRpc and msgPack; msgPack and RPC serialization were removed in the RC. Sockets need self-framing (ndjson); plain HTTP bodies do not. The docs warn that mixing them silently corrupts the stream. `RpcServer.layerHttp` takes a protocol option, with websocket as the default.
- Typed errors: encoded through the Exit schema, so a client receives typed failures, not thrown strings.
- Streams and backpressure: RPC stream backpressure and HTTP stream backpressure were added in the RC. Server notifications became first-class messages. In-flight streams fail after a missed socket pong, which gives liveness detection.
- Browser client: the Socket interface is unified across Node, Bun, Deno and browser, with typed handshake headers. I did not read a browser RPC client example.
- Reconnection: the RC notes say reconnects are 'as simple as Effect.retry' around a scoped read loop. I found no built-in resume or replay. For a room, resume has to come from your own per-room revision numbers.
- Stability: RPC is an unstable module. Minor releases may change it.

## 4. Effect Schema vs Zod 4

| Criterion | Effect Schema (v4) | Zod 4 |
|---|---|---|
| Bidirectional encode/decode | Yes: transformations and 'flipping' of schemas (repo SCHEMA.md) | Codecs section exists in docs (not read) |
| Brands | Brand typing fixed in RC; `Schema.brand` type-only | Not verified |
| Arbitraries | Native `Arbitrary.schema` with reworked shrinking; fast-check not re-exported | Not verified |
| JSON Schema export | Listed as tooling; a tuple allOf fix landed in beta | JSON Schema section exists in docs (not read) |
| Standard Schema | Listed by Elysia; Effect's own conformance not verified in source | Listed by Elysia |
| Core browser size | No Schema-only number from Effect; Effect+Stream+Schema minimal program is 7.1 kB | 5.36 kB gzip core (Zod 4, z.boolean script); Zod 3 12.47 kB; Zod Mini 1.88 kB |

- Zod's own performance claims (Node 22.13, arm64): string parse 24.7 µs vs 363 µs for Zod 3 (14.7x); array 7.4x; object (Moltar) 6.5x. Zod's tsc claim is ~175 instantiations vs >25,000 for Zod 3 on one test file.
- Third-party size tables disagree with Zod's numbers. One README lists Effect/Schema at about 115.5 KB and Zod@4 at about 40.8 KB, with no stated method. These appear to measure whole-library imports, not a schema-only script. One blog gives Zod about 13 KB and Effect Schema about 30 KB for a typical schema. Treat these as low-confidence.
- Cross-library benchmarks: open-circle schema-benchmarks measures initialization, validation and parsing, plus minified size and TypeScript inference. Effect's SCHEMA.md has a runtime performance table on that suite, but I could not retrieve its values. A 2024 community benchmark said Zod had the highest check time and Effect the highest parse time. It is old and low-confidence.
- Fit for this project: Zod 4 is smaller in the browser, already decided, and well known to coding agents (inference). Effect Schema pays off mainly if frames are Effect RPC. Two schema libraries in one codebase is a cost.

## 5. Browser bundle size, 3.x vs 4, tree shaking

- Effect's stable post: minimal program (Effect, Stream, Schema) 35.6 kB in 3.x vs 7.1 kB in 4.x, minified and gzipped, from identical source, medians of nine fresh-process runs. Effect's beta post said roughly 70 kB to 20 kB for a similar program. The two figures differ. InfoQ notes the stable numbers have not been independently reproduced.
- Effect 3's FAQ attributes its size to the included fiber runtime. Effect 4 claims tree-shaking across rewritten core modules.
- Zod states that its method-heavy API is hard to tree-shake, which motivated Zod Mini.
- Server footprint, from Elysia's comparison of minified hello-world apps: Elysia 2 exp.60 141 KB, Effect HTTP Node 4.0.0-beta.102 357 KB, Hono 21 KB, Express 603 KB. This is vendor-run and for a server, not a browser.
- Measure your own browser entry with the same bundler before deciding. I did not do that.

## 6. Elysia and ManagedRuntime

- Elysia 2 was published as a beta on 30 Jul 2026, installed with `elysia@next`. Elysia's blog says 2 is a complete rewrite. The npm `latest` tag is 1.4.32. A third-party note reports 2.0.0-rc.4 on 8 Nov; I did not check the registry tag, so treat the RC status as unconfirmed.
- Standard Schema: Elysia added it in 1.4. Its validation docs list Zod, Valibot, ArkType, Effect Schema, Yup and Joi. Caveat: with Standard Schema, Elysia does not validate file content types automatically; use its `fileType` helper.
- Elysia 2 introduces `t.Accelerate`, which converts Standard JSON Schema for compiled validation (alpha flag). Whether that works with Effect Schema's JSON Schema output is unverified.
- A third-party repository doc says the Elysia 2 beta rewrites the WebSocket API, so code written against 1.x `.ws()` will not carry over. Treat as low-confidence.
- ManagedRuntime: Effect's AI docs example for Hono creates a runtime from the app layer, shares a global memo map across the app, and calls the runtime from handlers. The same shape applies to Elysia handlers (inference). I found no published Elysia integration package.

## 7. Runtime overhead of fibers

- Effect's vendor figures for 4.x vs 3.x: concurrent task throughput 0.71M to 4.57M tasks/s (about 6.4x); heap for 50,000 fibers 157.5 MB to 21.8 MB (86% less). These are vendor measurements.
- A 2022 micro-benchmark (fib, one run): sync 7.69 ms, Promise 272 ms, Effect with Promise 344 ms, Effect with sync 353 ms. Derived: Effect was about 45x slower than sync and about 1.3x slower than Promise. The commenter says this is not a relevant benchmark. It predates v3 and v4.
- For this system, Effect's per-step cost matters little against socket I/O, but it matters in tight reducer loops. Keep the reducer as plain functions.

## 8. Testing

- TestClock replaces the Clock service. `sleep`, timeouts, retries and schedules advance only when you call `adjust` or `setTime`. This is for Effect-managed code.
- Layer-based doubles: `Layer.succeed` substitutes a test implementation for a service. A production write-up shows a platform client swapped for a fake with no change to callers.
- Versus a sans-IO core with a seeded simulator: the simulator controls every message ordering, disconnect and reconnect in one seed, including code that never touches Effect. TestClock controls only time inside Effect. Use the simulator as the primary determinism tool and TestClock only in Effect-shell tests.

## 9. OpenTelemetry on Bun

- The v4 tracing doc shows `bun add @effect/opentelemetry` with OpenTelemetry SDK packages.
- Core v4 has an `Otlp` module that installs an OTLP logger, metrics exporter and tracer exporter from one configuration. `OtlpTracer` exports over OTLP/HTTP.
- `OtelTracer` bridges Effect tracing into an existing OpenTelemetry TracerProvider.
- Unverified: Bun-specific behaviour, ClickStack ingestion, and whether the OTLP exporter behaves under Bun's runtime. A small spike is needed.

## 10. AI coding agents

- An official `effect.website/llms.txt` was not located. Context7 hosts an effect-smol llms index (third-party).
- Effect publishes AI guide documentation and skills (Kit Langton's skills; a v3-to-v4 migration skill). The RC notes add SQL, HttpApi testing and CLI schema coverage to the AI docs.
- MCP: a native MCP client landed in v4, and an MCP protocol adapter with a conformance suite was added in the RC.
- Language tooling: the legacy LSP was removed in favour of `effect/tsgo`. 16 new LSP rules and `tsrs --lint` arrived in November. The LSP rules are also available as type-aware OXLint rules.
- Failure modes: I found no documented catalogue from Effect. Community commentary says typed errors and DI help agents type-check their own output. Third-party 'rat-stack' guidance relies on compiler checks, lint rules and commit hooks. Inference: agents trained on v3 mix v3 and v4 APIs, so pin versions, use the migration skill and lint in CI.

## 11. Production reports and criticism

- A production write-up from a small team (Social Fetch) used Effect in its request layer: typed errors, Schema at the boundary, Schedule-based retries and bounded concurrency. Its costs: debugging steps through Effect internals, Effect.gen/Layer/Schedule must be learned before the layer is productive, and the team judged the cost worth it only for the narrow request layer.
- Hacker News comments quoted there: one called the learning curve 'brutal' compared with RxJS; another objected to readability lost by replacing for-of with Effect.forEach and await with Effect.runPromise; two said execution flow is hard to follow in a debugger.
- A critical review lists conceptual overhead (type parameters, layers, fibers, causes) and runtime indirection. It is secondary and low-confidence.
- Churn: during the v4 beta and RC there were renames (ServiceMap to Context, Config constructors, Socket API rewrite, Schema brand changes). The team's own RC notes call the RC a final stretch before stable.
- Stack traces: not verified in primary sources; the debugging complaint is the closest evidence.
- Lock-in: the Effect types and layers spread through a codebase. Vendor download figures (43.9 M weekly, across tags) are not adoption evidence. Adopters named by Effect include OpenCode and T3Code, but these are curated announcements.

## 12. Functional core, imperative shell

- Community guidance favours a pure core without Effect: one gist keeps the core as plain values and Either-like results; another, an 'Effect v4 coding standards' gist, says to prefer an imperative shell and a functional core containing domain logic, parsers and transitions. A blog argues to keep effects out of the core only when the distinction is real.
- A counterpoint from a lobste.rs thread: the pattern can forgo database query planning and transactions.
- I found no Effect maintainer statement on this. Treat it as community practice.

## Where Effect pays off here

- **Pure reducer:** No. Keep it plain TypeScript with no Effect import. Determinism, property tests and the simulator need nothing from Effect.
- **Protocol schemas:** Mostly no. Zod 4 is already decided and smaller in the browser. Effect Schema pays only if you adopt Effect RPC.
- **Room actor loop:** Limited. A per-room single-writer queue is easy in plain TypeScript. Effect helps when the loop needs timeouts, scoped subscriptions and interruption, at the price of a runtime bridge from Bun's synchronous WebSocket callbacks.
- **Persistence adapter:** Modest yes. Drizzle has native Effect v4 support, and the adapter can wrap transactions and typed errors. Keep the interface Effect-free so the simulator can use fakes.
- **Webhook delivery worker with retries:** Yes, the strongest case. Schedule-driven backoff, typed retry conditions (retry 429 and 5xx, not 4xx), bounded concurrency and persisted queues.
- **OAuth connectors:** Yes, moderately. Typed errors per provider, HttpClient, token refresh under a Schedule, and scoped resources.
- **Startup and graceful shutdown:** Yes. Layers and Scope give ordered acquisition and release. The server's 20 s graceful default still needs your own code to close room sockets on SIGTERM.

Rooms of 2 to 30 people and a few hundred sockets are bounded by I/O and fan-out, not by Effect's per-step cost.

## Recommendation

Keep the room server as plain TypeScript: pure reducer, Zod 4 frames, a per-room single-writer loop, and Bun's native WebSocket with explicit limits. Add Effect where retries, typed errors, scoped resources and ordered startup and shutdown earn their keep: the webhook worker, OAuth connectors and persistence adapter. Pin `effect` and `elysia` exactly, and avoid `effect/unstable/*` on hot paths. Reject a full Effect spine built on RPC over Bun for now. It rests on unstable modules, an open platform-bun buffering issue and a thin Bun-specific record. This is an inference from the evidence above, not an Effect recommendation.

## Must decide now (cannot be retrofitted cheaply)

1. **Reducer boundary:** the reducer package has no Effect dependency, enforced by lint or a dependency-graph check.
2. **Projection on the server:** hidden votes never leave the server. Frames carry only the per-seat projection.
3. **Protocol versioning:** every frame carries a protocol version and a type discriminator.
4. **Per-room revision numbers:** every event carries a monotonic revision so clients can resync after reconnect. Without this, resume is not possible later.
5. **WebSocket policy in Bun:** Origin allowlist before upgrade; `idleTimeout` set explicitly (Bun's default is 10 s; the Effect server wrapper defaults to 0); a payload cap; and a rule for `send()` returning -1 or 0 (drop, close, or pause).
6. **Fan-out mechanism:** Bun's native topic pub/sub or your own loop. Effect's reference does not expose pub/sub, so this choice is also a dependency choice.
7. **Version policy:** exact pins; a rule that unstable modules stay out of the hot path; a decision on whether Effect enters the process at all.
8. **Trace context:** carry a trace parent in frames or events if you want end-to-end traces (inference).
9. **Test strategy:** the simulator is the main test tool; no TestClock in the reducer.

## Not verified

- Effect 4 Schema conformance to the Standard Schema interface (read in Effect source): Only Elysia's docs list Effect Schema as Standard Schema; Effect's own interface was not read.
- Current cross-library Schema benchmark numbers (Effect vs Zod 4 vs Valibot): Methodology read, but the results site and Effect's SCHEMA.md performance table values were not retrieved.
- Schema-only browser bundle size for Effect Schema in v4, and like-for-like size vs Zod 4: Only vendor minimal-program figure (Effect+Stream+Schema) and third-party tables with unclear methods were available.
- Zod 4 brands, arbitrary generation and JSON Schema API details: Docs sections exist in the sidebar but were not read.
- Current Zod version on npm: Registry version not checked; sidebar lists 4.5 and 4.6 posts.
- RPC browser client example and built-in reconnection/resume policy in v4: Transport reference read; no browser client example or built-in reconnect policy found, and this host is not confirmed as official.
- Fiber overhead vs plain synchronous code on current v4, on Bun: No independent current benchmark found; only vendor throughput and a 2022 micro-benchmark.
- Effect platform-bun open-bug status beyond #10607 and Socket reconnect behaviour on Bun: Only the search snippet of one issue was read; current status not confirmed.
- Bun native pub/sub and send() backpressure exposure through Effect: Only the reference page was read; the source may expose more than the page lists.
- Official llms.txt for Effect docs: Not retrievable (not located at this URL); third-party mirrors only.
- Documented AI agent failure modes and mitigations from Effect: No primary catalogue found; evidence is community commentary and tooling announcements.
- Elysia 2 RC/beta status and WebSocket API shape: Elysia's post labels 2 a beta; a third-party note says rc.4; registry tags were not checked.
- Elysia integration with Effect beyond Standard Schema and ManagedRuntime: No Elysia-specific Effect integration package or guide found.
- Effect OpenTelemetry on Bun and export to ClickStack: Install instructions read; no Bun runtime test or ClickStack check found.
- Stack trace quality in Effect v4: No primary source read; only community debugging complaints.
- Effect maintainer position on functional core, imperative shell: Only community gists and blog posts found; no maintainer statement located.
- Effect-based TestRandom and @effect/vitest v4 APIs: Only TestClock documentation read; randomness and vitest helpers not checked.

## Sources

- https://www.npmjs.com/package/effect
- https://www.npmjs.com/package/@effect/platform-bun
- https://www.npmjs.com/package/@effect/rpc
- https://www.npmjs.com/package/elysia
- https://effect.website/blog
- https://effect.website/blog/effect-v4-rc-august-recap
- https://effect.website/blog/this-week-in-effect/127
- https://effect.website/blog/this-week-in-effect/138
- https://effect.website/blog/this-week-in-effect/133
- https://effect.website/blog/releases/effect/40-beta/
- https://effect.website/blog/releases/effect/40
- https://www.infoq.com/news/2026/11/effect-4-0-release/
- https://bun.com/docs/runtime/http/websockets
- https://effect.website/docs/v4/api/platform-bun/BunHttpServer
- https://github.com/Effect-TS/effect/issues/10607
- https://effect.website/docs/v4/api/effect/rpc/Rpc
- https://effect.plants.sh/rpc/transports-and-serialization/
- https://zod.dev/v4
- https://github.com/Effect-TS/effect/blob/f110af1a/packages/effect/SCHEMA.md?plain=1
- https://github.com/mjancarik/esmj-schema
- https://blog.rajpoot.dev/posts/typescript/zod-vs-valibot-vs-effect-schema-2026/
- https://github.com/softnetics/schema-validator-benchmark
- https://github.com/open-circle/schema-benchmarks
- https://elysiajs.com/essential/validation
- https://elysiajs.com/blog/elysia-20
- https://oday-bakkour.com/blog/dev-stack-release-audit-november-9-2026-nodejs-elysia
- https://markdownregistry.com/a/art_bpkjigskysw43eqc/v/ae41be5b0ad8a9b8be4f0128f2c90e9ff0439d5e145e7ac0fd10288014dc2387
- https://github.com/Effect-TS/effect-smol/blob/main/ai-docs/src/03_integration/10_managed-runtime.ts
- https://effect.website/docs/v4/api/effect/testing/TestClock
- https://effect.website/docs/v4/testing/testclock
- https://www.socialfetch.dev/blog/effect-typescript-production
- https://effect.website/docs/v4/observability/tracing
- https://effect.website/docs/v4/api/effect/observability/Otlp
- https://effect.website/docs/v4/api/opentelemetry/OtelTracer
- https://dev.to/almaju/comment/2e8gg
- https://effect.website/docs/v3/additional-resources/effect-vs-fp-ts
- https://sparkles-docs.pages.dev/research/algebraic-effects/typescript-effect
- https://gist.github.com/redbar0n/af5e339ea8b2563738455dcdf6042ed5
- https://gist.github.com/FNDEVVE/ae8d1dc0f440c3c537e53d4fbc659872
- https://nalar.dev/functional-core-imperative-shell/
