# OpenTelemetry in the browser and on Bun

Research run of 2026-11-18 (`agw research`, depth standard). Run status: ok. Citations grounded against fetched pages: 15/15. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line

- **Browser SDK:** Do not start on `@opentelemetry/sdk-trace-web`. Its npm page (version 2.12.0, Apache-2.0) says the package is deprecated in favour of `@opentelemetry/sdk-trace`, and its README example still uses the old `plugin-document-load`. The browser instrumentations are being split between opentelemetry-js and a newer opentelemetry-browser repo. For this app, `@hyperdx/browser` (0.26.0) is the simplest single agent: it captures fetch, XHR, WebSocket requests, exceptions and console logs, adds `traceparent` to matching requests, and records session replay into the ClickStack you already run. Treat replay as a privacy decision, not a default.
- **WebSocket trace context:** I found no verified browser instrumentation for WebSocket messages in OpenTelemetry. Carry W3C `traceparent` (and `tracestate`) as a field in your own message envelope, and extract it on the server per message.
- **Bun server:** Bun 1.4 (20 Aug 2026) runs the OpenTelemetry `http` and `fs` instrumentations, and `AsyncLocalStorage` is implemented (1.4.1 on 4 Sep 2026 made `run()` about 2x faster). `@opentelemetry/sdk-node` is still marked experimental on npm, and its default context manager is `AsyncLocalStorageContextManager`. Use `@elysiajs/opentelemetry` 1.4.11 or a manual sdk-node setup, but confirm spans on the real Bun build under load before relying on them.
- **Metrics and SLOs:** Expose connection, room, latency, fan-out, reconnect and deploy-disconnect metrics with no room id or user id labels. Alert on connection drops outside deploy windows, not on every deploy blip.
- **Sampling:** Head-sample in the SDK with a parent-respecting composite sampler; keep errors and reveals through collector-side tail sampling (details unverified here).
- **Proxy:** Serve telemetry from the app's own origin, for example a Traefik path on the VPS. HyperDX's `url` option accepts a custom collector URL, and Umami's own docs recommend proxying its script and collection endpoint against blockers.
- **Product usage split:** Umami owns pageviews, funnels, feature adoption and web vitals (Umami lists Web Vitals among its default metrics). OpenTelemetry owns server health, message latency, fan-out and deploy behaviour. Do not duplicate the same event in both.
- **Decide now:** the message envelope with trace fields and protocol version, the drain and close-code contract for deploys, the first-party telemetry domain, identity rules for the anonymous client id, replay masking and consent, and the event taxonomy.

## Versions, licences and maturity

| Component | Version (source) | Licence | Maturity note |
|---|---|---|---|
| `@opentelemetry/sdk-trace-web` | 2.12.0 (npm page) | Apache-2.0 | Deprecated on npm; use `@opentelemetry/sdk-trace`. Release date conflicting on the page ("a month ago" and "9 days ago"), so not confirmed. |
| `@opentelemetry/sdk-node` | npm page indexed 12 Nov 2026 | Apache-2.0 per OTel convention, not read | Marked experimental, breaking changes possible. |
| `@opentelemetry/instrumentation-xml-http-request` | Context7 docs | not read | Deprecated; move to `@opentelemetry/browser-instrumentation` (xhr) in the opentelemetry-browser repo, which emits different telemetry. |
| `@opentelemetry/sampler-composite` | Context7 docs | not read | Experimental package in opentelemetry-js. |
| `@hyperdx/browser` | 0.26.0 (npm) | not verified | 0.x semver, so expect breaking changes (my inference). Release date not confirmed. |
| `@elysiajs/opentelemetry` | 1.4.11 (npm) | not verified | Docs import from `@elysia/opentelemetry`, npm name is `@elysiajs/opentelemetry`. Check before installing. Release date not confirmed. |
| Bun | 1.4 (20 Aug 2026), 1.4.1 (4 Sep 2026) | not verified | OTel http/fs instrumentation and AsyncLocalStorage work; Bun notes `createHook` and related hooks are stubs. |
| Umami | current docs | MIT (third-party template page) | Self-hosted, cookieless. |

## Browser: what to use

**OpenTelemetry web SDK.** The current docs for document-load, user-interaction and fetch instrumentation were not readable in this run (the page returned navigation only). The deprecation of the XHR instrumentation and the move to opentelemetry-browser are the key maturity signals. Browser instrumentation in the OTel ecosystem is in flux, so pinning exact versions and testing the emitted span names is necessary. I did not verify a web-vitals instrumentation in OpenTelemetry; if you want vitals in OTel, record them yourself with the `web-vitals` library into a histogram.

**HyperDX browser SDK.** Documented init options: `apiKey`, `service`, `tracePropagationTargets` (regexes; matching requests get a `traceparent` header), `consoleCapture`, `advancedNetworkCapture` (headers and bodies, off by default), `url` (the OpenTelemetry collector URL, needed only for self-hosted), `maskAllInputs`, `maskAllText`, `disableReplay`, `disableIntercom`. It also offers `setGlobalAttributes`, `addAction` and `attachToReactErrorBoundary`. Its integration list includes XHR, fetch and WebSocket requests, so it covers the three network paths you care about, but the docs say nothing about propagating context inside WebSocket messages.

**Privacy risk specific to this app.** Votes are hidden until reveal. Session replay records the DOM, so an unmasked replay could capture votes before reveal. Use `maskAllText` and `maskAllInputs`, or disable replay until you have a consent design. Do not put room ids in URL-based attributes or replay URLs; prefer route templates such as `/room/[id]`.

**Recommendation:** use `@hyperdx/browser` as the only browser agent, with replay off by default or fully masked, and add a manual span per outgoing WebSocket message when you need latency. Only split out OpenTelemetry web packages if you need vendor-neutral browser traces that HyperDX does not expose.

## WebSocket propagation

The pattern that works without a WebSocket instrumentation:

1. Client: on each send, put `traceparent` and `tracestate` in the envelope (for example `{v, trace, type, payload}`), starting a client span for the send.
2. Server: extract the context with the W3C propagator for each message, start a receive span with that parent, and for fan-out create one broadcast span with a link to each sender span rather than making every recipient a child.
3. Put `buildId` (the deploy version) into the envelope or the handshake so disconnects and reconnects can be tied to a deploy.

The envelope field and protocol version are hard to retrofit once clients are in the field, so define them in the rewrite.

## Server: Bun, AsyncLocalStorage, sdk-node and Elysia

- Bun's own notes say the OpenTelemetry `http` and `fs` instrumentations export spans on Bun 1.4, and `shimmer` and `require-in-the-middle` can patch bundled code.
- Bun's Node compatibility page lists `AsyncLocalStorage` and `AsyncResource` as implemented, with `createHook`, `executionAsyncId`, `triggerAsyncId` and `executionAsyncResource` as stubs. The OTel default context manager needs ALS, not the hooks, so it should be fine, but verify.
- Elysia's plugin defaults: `AsyncHooksContextManager`, a W3C tracecontext and baggage propagator, all traces sampled, `getNodeAutoInstrumentations()`, a BatchSpanProcessor with OTLP over http/protobuf, and a `metricReader`/`views` option for histogram buckets. Auto-instrumentation of Bun.serve requests is not verified; check that inbound spans appear on the real build. If they do not, create spans manually for the WebSocket upgrade and each message.
- Elysia's docs show the plugin applied with `opentelemetry({ spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())] })`.

## Metrics for a real-time room server

Labels: `build`, `instance`, `route` (fixed), `reason` (fixed enum). Never `roomId`, `clientId`, or user-agent strings.

| Metric | Type | Notes |
|---|---|---|
| `ws.connections.active` | gauge | per instance |
| `rooms.active` | gauge | |
| `room.participants` | histogram | buckets matching 2 to 30 people |
| `message.latency` | histogram (ms) | server receive to last fan-out write |
| `fanout.recipients`, `fanout.duration` | histogram | per broadcast |
| `ws.reconnects` | counter | `reason` enum: network, deploy, server-error |
| `ws.closed` | counter | `code` from the close frame (1000, 1001, 1006, 1012) |
| `deploy.disconnects` | counter | disconnects in the first N seconds after a deploy start |
| `votes.rejected` | counter | `reason` enum |
| process event-loop lag, RSS | gauge | Bun process metrics |

**Proposed SLOs** (my proposals, not sourced): 99% of votes and reveals reach all connected members within 500 ms server-side over 30 days; 99% of reconnects restore room state within 5 s; 99.9% WebSocket upgrade success; at least 99% of deploy-disconnected clients reconnect within 10 s.

**Proposed alerts:** active connections drop more than 30% within 2 minutes outside a deploy window; fan-out p95 above 500 ms for 10 minutes; reconnect rate above 3x its 7-day baseline for 5 minutes; message handler error rate above 1%; no active connections while rooms exist (a crash signal). Deploy windows should be annotated so the drop alert is suppressed in that window only.

## Sampling

- Current room traffic is small, so 100% server span sampling is probably affordable at this stage; check it against monthly span volume. Elysia's default is all traces sampled.
- The OpenTelemetry composite sampler example (opentelemetry-js) shows the shape: honour the parent decision, never sample health checks, always sample checkout-like routes, and sample 10% of the rest. Adapt it to: always sample messages that carry an error or a reveal, sample 10% of other messages.
- Browser: sample spans at 10 to 20% of sessions; replays only for sessions where consent exists.
- Tail sampling for errors belongs in the collector, since head sampling cannot see errors. I did not read the OpenTelemetry tail-sampling page in this run, so its configuration is unverified.

## First-party proxy against ad blockers

- Serve the browser SDK's telemetry and the Umami script and collection endpoint from the app origin, for example `https://app.example/telemetry/...` routed by Traefik to ClickStack and Umami. The Umami docs recommend proxying the tracker and collection endpoint, self-hosting the script, or renaming it, because blocklists are maintained by many people and some match path patterns.
- Ad blockers are a moving target; a same-origin path reduces blocking but does not guarantee it. Plan for missing data.
- The marketing pages on Cloudflare Workers are a different origin, so they need their own proxy or the telemetry goes to the app origin only.
- Replays and any ingestion key visible in the client are public; design the telemetry path with that in mind.

## Product usage: OpenTelemetry vs Umami

- **Umami:** pageviews, referrers, funnels, feature adoption (room created, reveal clicked, estimate chosen), retention, and web vitals (Umami lists Web Vitals among default metrics). It is cookieless, which fits the privacy promise.
- **OpenTelemetry/ClickStack:** latency, errors, fan-out, connection and deploy behaviour, and browser exceptions with traces.
- Rule: a product question goes to Umami; an operations question goes to OpenTelemetry. The same event should not be counted in both, except when you need to join a usage event to a failure via a trace link.
- No user id or room id in Umami events either; use aggregate buckets.

## Decide now (cannot be retrofitted)

1. **Protocol:** the envelope with trace fields, a protocol version, and `buildId` in the handshake.
2. **Close and drain contract:** which close codes the server sends on deploy, a drain message before shutdown, and client reconnect behaviour. RFC 6455 defines 1001 (going away); I did not fetch the IANA entry for 1012 (service restart).
3. **First-party telemetry domain and path** on the same origin as the SPA; the Workers site needs its own decision.
4. **Identity rules:** the anonymous client id is never a metric label or a Umami property; decide whether it appears in spans (pseudonymous) and its retention.
5. **Replay policy:** off by default, full masking when on, and a consent design before any replay.
6. **Event taxonomy** shared by Umami and OpenTelemetry, with a rule for which tool owns each event.
7. **Metric names and bucket boundaries**, fixed before the first release, since changing them later breaks dashboards.

## Tradeoffs

- HyperDX gives replay and exception capture with less glue, but its SDK is pre-1.0 and its replay privacy defaults need careful masking.
- Raw OpenTelemetry browser packages are more vendor-neutral, but several are deprecated or moving, and replay is not part of them.
- Running sdk-node on Bun is workable on 1.4, but it is not the path the Node SDK was built for; load-test spans and memory before committing.
- Two analytics tools (Umami plus OTel) mean two privacy reviews, but each has a clear job.

## Recommendation

Use `@hyperdx/browser` in the SPA with masked replay, first-party proxy, and trace propagation in the WebSocket envelope. On the Bun server, use Elysia's OpenTelemetry plugin or a plain sdk-node setup, verified on the real build. Expose the metrics and SLOs above with fixed labels. Keep product usage in Umami, and fix the protocol and privacy decisions now.

## Not verified in this run

- Browser document-load, user-interaction and fetch instrumentation: current configuration and span names: Page read returned navigation only; content truncated before the instrumentation section. Docs answer did not cover it either.
- WebSocket instrumentation in OpenTelemetry browser SDKs and web vitals instrumentation: No source found. Docs answer and HyperDX docs mention WebSocket capture but not message-level context propagation; no official web-vitals instrumentation verified.
- Tail-based sampling configuration in the OpenTelemetry Collector: Page read returned navigation only; the sampling content was truncated. Tail-sampling claims are not sourced.
- Whether @elysiajs/opentelemetry auto-instruments requests served by Bun.serve, and the correct package name: Docs show @elysia/opentelemetry while npm lists @elysiajs/opentelemetry; span capture on Bun not tested or documented.
- HyperDX session replay: whether it goes through the url collector, masking defaults, consent handling, pricing and licence: Docs list masking options but not replay transport or defaults; licences of HyperDX/ClickStack not verified.
- Release dates of @hyperdx/browser 0.26.0, @elysiajs/opentelemetry 1.4.11 and @opentelemetry/sdk-trace-web 2.12.0: npm page gives inconsistent relative dates ('a month ago' and '9 days ago'); the other two pages gave no date.
- Licences of @hyperdx/browser, @elysiajs/opentelemetry, Bun and @opentelemetry/sdk-node: Not read on the package pages; only sdk-trace-web's Apache-2.0 was seen directly.
- Close code meanings 1001 and 1012 used for deploy drains: RFC 6455 and IANA registry not fetched in this run; 1012 meaning stated from general knowledge.
- Proposed SLO targets, alert thresholds and sampling rates: Recommendations, not sourced. Set from reasoning about a small room server; validate against real traffic after launch.

## Sources

- https://www.npmjs.com/package/@opentelemetry/sdk-trace-web
- https://bun.com/blog/bun-v1.4
- https://elysiajs.com/plugins/opentelemetry
- https://www.hyperdx.io/docs/install/browser
- https://opentelemetry.io/docs/languages/js/getting-started/browser/
- https://opentelemetry.io/docs/concepts/sampling/
- https://www.npmjs.com/package/@hyperdx/browser
- https://www.npmjs.com/package/@elysiajs/opentelemetry
- https://www.npmjs.com/package/@opentelemetry/sdk-node
- https://bun.com/docs/runtime/nodejs-compat
- https://bun.com/blog/bun-v1.4.1
- https://context7.com/open-telemetry/opentelemetry-js
- https://umami.is/
- https://umami.is/platform
- https://docs.umami.is/docs/bypass-ad-blockers
- https://docs.umami.is/docs/metric-definitions
- https://umami.is/product-analytics
- https://docs.controlplane.com/template-catalog/templates/umami
