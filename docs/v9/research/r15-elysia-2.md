# Elysia 2 pre-release as the server framework

Research run of 2026-11-19 (`agw research`, depth deep). Run status: ok. Citations grounded against fetched pages: 46/46. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line
- Versions: the `rc` tag resolves to 2.0.0-rc.3. 2.0.0-rc.4 is on npm but untagged. `next` is 2.0.0-beta.32, `experimental` is 2.0.0-exp.64, and `latest` is 1.4.32, a security-only line. No stable 2.0 date is announced in any source I read.
- Breaking changes that matter here: options come before the handler in route calls; hook names keep the `on` prefix (the beta rename was reverted in the RC); error handling is rebuilt around error classes; scopes are `local`, `plugin`, `global`; `derive` replaces `resolve`; WebSockets became an opt-in `websocket()` plugin with a new `.ws()` signature; TypeBox 1.x and Standard Schema.
- WebSocket: the route API is usable, but two open 2.0-era bugs hit the path you would use: WebSocket response-schema validation (#1933) and `ws.query` (#2017, reported on beta.30). Reproduce both on rc.3 before relying on either.
- Recommendation: pin `elysia@2.0.0-rc.3` exactly; keep every Elysia import in one transport file; keep room logic framework-free; serve the SPA with one catch-all `file()` route; skip CORS (same origin). Section 8 lists decisions that cannot be retrofitted.

## 1. Versions and dates
| Tag | Version | Date | Source |
|---|---|---|---|
| latest | 1.4.32 | 11 Nov 2026 | GitHub releases page |
| rc | 2.0.0-rc.3 | about 5 Nov 2026 | npm version history ("14 days ago" as read on 19 Nov) |
| next | 2.0.0-beta.32 | about Oct 2026 | npm ("a month ago") |
| experimental | 2.0.0-exp.64 | about Aug 2026 | npm ("3 months ago") |
| untagged | 2.0.0-rc.4 | about 8 Nov 2026 | npm ("11 days ago"); a secondary blog says 9 Nov |
| untagged | 2.0.0-rc.1 | about 28 Oct 2026 | npm ("22 days ago") |

Other dates: beta post 30 Jul 2026; RC post 19 Oct 2026. The RC post says the RC was about two months later than planned and recommends new projects start on RC.

Tag churn: the 1.4.32 release note describes an emergency override of `latest` "as 1.4.31 instead of 2.0.0-rc.4". Expect more tag movement; pin exactly.

1.4 policy: the 1.4.30 note (26 Aug 2026) says 1.4.x "will only publish security updates, no new features". 1.4.31 (5 Nov 2026) lists 28 advisories, including hardening of incoming and outgoing WebSocket validation.

## 2. Breaking changes, 1.4 to 2.0

### Lifecycle hooks and scope
- Names: `onRequest`, `onParse`, `onTransform`, `onBeforeHandle`, `onAfterHandle`, `onAfterResponse`, `onError`. `derive`, `mapResponse` and `trace` keep bare names. The beta had dropped the `on` prefix; the RC restored it so 1.x plugins work unchanged. The two-parameter `onError` form is still breaking.
- Startup and shutdown: the skills migration reference says `onStart` and `onStop`; the RC lifecycle page refers to `onStop`. The beta's `setup`/`cleanup` names are superseded.
- Ordering: a hook applies to routes registered after it. A hook added after `.use(plugin)` does not reach that plugin's routes.
- Scope strings: `'local'` (default), `'plugin'` (replaces `'scoped'`; reaches the immediate parent), `'global'`. The object form `{ as: 'scoped' }` is removed.
- Guards: `.guard()` and `.group()` override by default; a route schema replaces the inherited guard schema for the same slot. `schema: 'merge'` requires both. 1.x accumulated them.
- `.resolve()` is now `.derive()` and runs in the beforeHandle queue after validation. `.macro(name, def)` is removed; use `.macro({ name: { derive } })`.
- Route shape is `.get(path, options, handler)`. `app.store` is gone; read `store` from context. `context.path` is readonly.

### Plugin API
- Official plugins publish under `@elysia/*`; `@elysiajs/*` stays on 1.x.
- `new Elysia({ name, seed })` deduplicates named plugins: the same name and seed means one registration.
- `.use(import('./module'))` lazy-loads a plugin; `listen()` waits for `app.modules`. Tests must `await app.modules` before `app.handle()`.
- Scope promotion uses `.as('plugin')` or `.as('global')`, or a scope string on the hook. `defer()` runs work after the response is sent.

### WebSocket route API
- Install once: `import { websocket } from 'elysia/websocket'`, then `.use(websocket())`. Server options go in `websocket({ idleTimeout })`; the 1.x constructor option is replaced.
- Forms: `.ws(path, handler)` and `.ws(path, options, handler)`. Do not set `options.message` when passing a separate handler.
- Generators: each `yield` sends one message, checked against `response`. `ws.send()` still works.
- The socket exposes `body`, `query`, `params`, `headers`, `cookie` and derived values directly (`ws.query`, not the 1.x `ws.data.query`), plus `id`, `remoteAddress`, `readyState`, `send`, `publish`, `subscribe`, `unsubscribe`, `close`.
- Schemas: `body` validates each incoming message; `query`, `params`, `headers`, `cookie` validate the upgrade request; `response` validates each outgoing message.
- Parsing: JSON-shaped strings and safely convertible numeric strings are parsed before validation; other text stays text; binary stays binary. Design the envelope around this (see open bug #1911).
- Hooks: `beforeHandle` runs on upgrade and before each message handler. Returning `status(403, ...)` rejects the upgrade before a socket opens. `transform` runs on upgrade and again per message, so do not assume once per connection. `parse(ws, message)` replaces the 1.x `transformMessage`. `upgrade` adds handshake headers. Callbacks: `open(ws)`, `message(ws, msg)`, `drain(ws)`, `close(ws, code, reason)`.
- Authentication belongs in `beforeHandle`; message checks belong in `body`.
- Pub/sub: the 2.0 page lists `publish` and `subscribe` on the socket. The v1 API reference (read via context7) documents Bun's semantics: `publish` returns 0 (dropped), -1 (backpressure) or bytes sent, and `publishToSelf` defaults to false. I did not read a 2.0 page for the topic API; re-check on rc.3.
- Defaults (2.0 page, Bun defaults): `perMessageDeflate` false; `maxPayloadLength` 16 MiB; `idleTimeout` 120 s; `backpressureLimit` 16 MiB; `closeOnBackpressureLimit` false. The v1 reference also lists `sendPings` true.
- Close codes: `close` receives `code` and `reason`. Bun: `server.stop()` does not close open WebSockets; `server.stop(true)` closes each with 1001. Elysia 2 docs define no app close-code scheme; you define it.
- Backpressure: `drain(ws)` fires when the socket accepts more data; `backpressureLimit` caps buffered bytes per socket; `closeOnBackpressureLimit: true` drops slow readers.
- Subprotocol negotiation: no page I read documents `Sec-WebSocket-Protocol` handling in Elysia 2. Treated as open.

### Validation
- TypeBox: `t` from `elysia` uses TypeBox 1.x. The beta post says it moved from 0.34 to 1.3; the skills baseline sets typebox 1.3.0 or newer and exact-mirror 1.2.6 or newer. Do not mix with `@sinclair/typebox` 0.x. `t.Transform` is now `t.Codec`; `t.Recursive`, `t.Not` and `t.RegExp` are no longer exported; schemas have no `.static`.
- Standard Schema: any compatible validator works in any slot, alone or mixed with TypeBox per route. Example from the skills reference: `params: z.object({ id: z.coerce.number() })`. Elysia's TypeBox coercion does not apply to other validators.
- Failures: request validation returns 422; a response-schema failure returns 500.
- Files: Elysia 2 bundles no file-type detector. Call `setFileTypeDetector` before validating `t.File` types.

### Eden Treaty
- `treaty<App>(origin)` with a type-only import of the server app. The RC adds Eden plugins with explicit types and more precise error types. `treaty(app)` works in-process for tests. WebSocket: `treaty<typeof app>(origin).chat.subscribe()`, with typed `send`, `subscribe`, `on`, `off`, `close`.
- Zod: no page I read states that Zod schemas keep Eden end-to-end types. Standard Schema inference suggests they do; this is unverified.

### OpenAPI
- Use `@elysia/openapi` (the skills baseline prefers it over the older `@elysia/swagger`).
- RC post: inferred error types let OpenAPI list every error a route can produce without manual annotation.
- Zod: the stable (1.x) OpenAPI page says Zod has no native JSON Schema method and needs `mapJsonSchema`. Re-check this on rc.3.

### Error handling
- `onError` receives `error`, `status` and request context. Error classes match directly: `.onError(NotFound, ...)`, `.onError(ValidationError, ...)`. A catch-all uses `instanceof`.
- Return and throw both go through `onError` (beta post).
- Returning an `Error` from an error hook is sent as if no hook handled it, at that error's own status, and does not reach other error hooks.
- Custom errors: `HTTPError.id('CODE', 400)`, or any object implementing the `HTTPError` interface.
- Responses use RFC 9457 problem details with `application/problem+json`; `problem(status, { detail })` is the helper.
- Production: the beta notes say unhandled error messages no longer leak under NODE_ENV=production. The skills errors reference says some 5xx messages remain public; check your own error shape.
- The beta post shows `.error(Class, fn)`; the RC lifecycle page uses `.onError(Class, fn)`. Follow the RC page.

### Graceful shutdown
- `onStop` runs at shutdown. The RC lifecycle page says `decorate` and `state` values are never disposed and should be released in `onStop`; derive values with `Symbol.asyncDispose` are released after each response.
- `app.stop(true)` closes active connections abruptly (v1 reference via context7; I did not read a 2.0 page for `app.stop`). A SIGTERM example from Sevalla calls `await app.stop()` and then `process.exit(0)`.
- Known hangs: I found no open 2.0 issue about `app.stop()` hangs. The only hit was #276 (2023, closing the server in tests). Treat `app.stop()` with open sockets as untested. Bun's `server.stop()` leaves WebSockets open, so close them yourself (code 1001 or your own code) before stopping.

### Static files and SPA
- `@elysia/static` (`staticPlugin({ assets, prefix, indexHTML })`) serves directory index files. `indexHTML` is not a fallback for every missing path. Use the `file()` helper for explicit files.
- Bun fullstack: `staticPlugin({ prefix: '/', bunFullstack: true })` bundles HTML with Bun 1.3+. The skills docs say awaiting the plugin alone does not enable bundling.
- My recommendation, not doc-verified: register `/api` and `/ws` routes first, then one catch-all `.get('/*', file('dist/index.html'))` last.

## 3. Official plugins, dist-tags (read 19 Nov 2026)
| Package | latest | rc | next | experimental |
|---|---|---|---|---|
| @elysia/cors | 1.4.3 | 2.0.0-rc.1 | 2.0.0-beta.2 | 2.0.0-exp.1 |
| @elysia/static | 1.4.12 | 2.0.0-rc.0 | 2.0.0-beta.3 | 2.0.0-exp.0 |
| @elysia/openapi | 1.4.17 | 2.0.0-rc.1 | 2.0.0-beta.6 | 2.0.0-exp.1 |
| @elysia/opentelemetry | 1.4.12 | 2.0.0-rc.0 | 2.0.0-beta.2 | 2.0.0-exp.1 |
| @elysia/cron | 1.4.2 | 2.0.0-rc.0 | 2.0.0-beta.1 | 2.0.0-exp.0 |
| @elysia/eden | 1.4.10 | 2.0.0-rc.1 | 2.0.0-beta.6 | 2.0.0-exp.1 |

Caveats: the plugin RC tags are older than Elysia rc.3 (rc.0 or rc.1). I did not read any rc plugin's peer range, so compatibility with elysia rc.3 is unverified. The skills baseline (17 Oct) said cron needs beta.32 or newer, and CORS, static and OpenTelemetry need at least beta.30. Plugin release dates were not read.

## 4. Bun version and open bugs
- Bun minimum for Elysia 2: no source I read states it. Evidence: the skills baseline needs Bun types 1.3 or newer when used; the 1.4.30 note says the test suite was updated for Bun 1.4; issue #2017 reproduces on Bun 1.4.3. Pin one Bun 1.4.x patch in package.json and the Dockerfile, and test it. Treat this as provisional.
- Node: the rc.4 manifest declares engines node >=22.18 and no Bun engine.
- Open issues from the open-WebSocket issue list (read 19 Nov 2026):
  - #1933 (opened 5 Jul 2026): the response-schema check in the WebSocket send path is inverted. The reporter says valid TypeBox responses become ValidationError frames and invalid ones pass through. I did not reproduce it. Validate outgoing messages in domain code and test on rc.3.
  - #2017 (13 Oct 2026): `ws.data.query` is undefined even with a query schema; reported on 2.0.0-beta.30 with Bun 1.4.3. The docs say to use `ws.query`. Reproduce on rc.3; if it fails, parse the query in your adapter.
  - #1911 (6 Jun 2026): unexpected automatic JSON parsing of WebSocket text frames. Partly documented behaviour. Use an explicit envelope and always validate.
  - #1716 (1 Feb 2026): WebSocket object identity is not stable across open, message and close. Key per-connection state by `ws.id`, not the socket object.
  - #1961 (11 Aug 2026): the 2.0 codemod missed WebSocket imports, `any`-typed macros and swagger rewrites on a production migration. Review codemod output by hand.
  - #1517 (29 Oct 2025): "WebSocket config is not passed to bun". Older, probably about the 1.x constructor option; status on 2.0 unknown.
- Sizing: rooms hold 2 to 30 people, so connection counts are small. The risks are correctness and vote redaction, not throughput.

## 5. AOT build plugin and bundle sizes
- Use: `aot('src/index.ts')` as a plugin in `Bun.build`, imported from `elysia/plugin/aot/bun`. esbuild, Vite, Rspack and unplugin variants exist; targets are `bun`, `node` and `workerd`. Export the app from the entry file. The plugin dry-runs the app at build time, so call `process.exit(0)` after the build if you opened a pool during it. Use `inAotBuild()` to skip external connections during capture.
- Consistency: a changed route falls back to runtime compilation with a warning, or fails with 500 if the build stripped the JIT. Rebuild after route changes; the baseline manifest format 7 rejects older artifacts.
- Bundle sizes (beta post, Elysia 2.0.0-exp.60, not rc.3; hello world with `bun build --minify`): Elysia 2 344 KB; Elysia 2 + AOT 226 KB un-minified (141 KB minified). Comparison: Hono 4.12.28 21 KB, h3 2.0.1-rc.26 103 KB, Express 5.2.1 603 KB, Fastify 5.10.0 729 KB.
- With schema libraries (same post): TypeBox 736 KB on 1.4 vs 847 KB on Elysia 2, and 288 KB with AOT (the TypeBox compiler is dropped when every schema precompiles). Zod 1,260 KB on 1.4 vs 868 KB on 2, and 784 KB with AOT. Valibot 742 KB on 1.4 vs 350 KB on 2, and 266 KB with AOT.
- Memory (RC post, startup at 400 routes): 37 MB for Elysia 2 with TypeBox, 35 MB with AOT, 44 MB with Zod. The per-route figure is higher with AOT (26.7 kB vs 16 kB for TypeBox), so AOT is not a memory win at this scale.
- Recommendation: skip AOT at the start. It is a build step you can add later.

## 6. Bun.password (hashing an optional room password)
- Signatures (Bun docs): `await Bun.password.hash(password, params?)` returns a PHC string for argon2 (MCF for bcrypt). `await Bun.password.verify(password, hash)` returns a boolean. Sync variants are `Bun.password.hashSync` and `Bun.password.verifySync`; the docs warn they block and degrade performance.
- Default algorithm: argon2id. The Bun guide says "By default, Bun.password.hash() uses the Argon2id algorithm".
- Default parameters: the docs do not state them in prose. The example output `$argon2id$v=19$m=65536,t=2,p=1$...` implies memory 65536 KiB (64 MiB), 2 iterations, parallelism 1. Check in code.
- Options: `algorithm` (`argon2id`, `argon2i`, `argon2d`, or `bcrypt`), `memoryCost` (KiB, minimum 8), `timeCost` (iterations); for bcrypt, `cost` 4 to 31. Bcrypt hashes passwords longer than 72 bytes with SHA-512 first.
- The salt is generated and stored in the hash; `verify` detects the algorithm from the hash format.
- Use: hash at room creation and verify at join, both with the async API. Store only the hash. Rate-limit join attempts, because each hash or verify allocates its memory cost, so concurrent joins multiply memory use.

## 7. Recommendation: starting a greenfield server on Elysia 2 today
1. Tag and pin: use `rc`, which is 2.0.0-rc.3. Install exactly with `bun add --exact elysia@2.0.0-rc.3`. Do not start new code on `latest` (1.4.32, a different major line) or `next` (beta.32, older).
2. Plugins, exact and only what you need: `@elysia/eden@2.0.0-rc.1` in the client package; `@elysia/openapi@2.0.0-rc.1` if you want generated docs; `@elysia/opentelemetry@2.0.0-rc.0` if you trace into ClickStack. Skip `@elysia/cors` (same origin), `@elysia/cron` (room timers belong in domain code) and `@elysia/static` (use `file()`).
3. Churn guard: no caret or tag ranges in package.json; commit the lockfile; `bun install --frozen-lockfile` in CI and Docker; a scheduled check of `registry.npmjs.org/-/package/elysia/dist-tags` that opens a PR when a tag moves; bump only after reading the GitHub release notes and the open WebSocket issues; a contract test suite (golden WebSocket frames, close codes, vote redaction, and a `tsc` check of the Eden client against the server type).
4. Layout: `packages/protocol` (message schemas, types, close codes; no Elysia import); `packages/rooms` (pure domain: join, vote, reveal, password check via Bun.password; no Elysia import); `apps/server/src/transport-elysia.ts` (the only file importing elysia: `.ws` routes, upgrade checks, publish, error mapping). The React SPA imports types from `packages/protocol` for the WebSocket, not Eden.
5. Isolate behind the adapter: Elysia's WebSocket route API, the validator library, OpenAPI, Eden, OpenTelemetry and error mapping. If the 2.0 WebSocket path fails your contract tests, the transport file is the only thing to replace (for example with Bun's native `Bun.serve` websocket handler).
6. Shutdown: on SIGTERM, send each socket a 'restarting' message, close with 1001 or your app code, then `await app.stop()` and exit. Test this with a live socket.
7. Limits to set now: `maxPayloadLength` well below 16 MiB (my judgment: start at 16 KB, which covers a vote envelope); a low `backpressureLimit` with `closeOnBackpressureLimit: true`; a client ping interval shorter than `idleTimeout` (120 s default) for phones.

Tradeoffs:
- 2.0 RC vs 1.4.32: 1.4 gets security fixes only. 2.0 is where the project goes, and migrating later means touching every hook and route. The RC costs tag churn (the 1.4.32 override), open WebSocket bugs, and plugin RC tags older than core. The adapter keeps that cost in one file.
- Elysia vs raw `Bun.serve` for the WebSocket: Elysia gives typed `.ws` routes and schema validation; raw Bun has fewer moving parts and no RC churn. The transport file makes either choice reversible.
- TypeBox (`t`) vs Zod 4 via Standard Schema: TypeBox is Elysia's native path, with AOT precompilation and the most documented behaviour. Zod 4 is familiar and works through Standard Schema, but Eden typing with Zod is unverified.
- Eden vs a protocol package: Eden is convenient for HTTP, but the WebSocket contract belongs in `packages/protocol`, so the SPA does not depend on Elysia's type churn.

## 8. Decide now (cannot be retrofitted)
1. Wire protocol: a versioned envelope on every frame (for example `{ v: 1, type, ... }`) with explicit JSON text frames. Elysia parses JSON-shaped strings before validation, so design the envelope around that.
2. Protocol version: put it in the path (`/ws/v1`) or in a required subprotocol. Elysia 2 does not document subprotocol negotiation, so the path is the safer choice.
3. Close-code contract: app codes in the 4000 to 4999 range (for example room full, wrong password, kicked, room closed), 1001 for deploy restarts, and a reconnect rule that always resends full state.
4. Vote secrecy: the server sends per-recipient views. Before reveal, others receive only 'has voted' flags. Votes must never reach a client before reveal, because a client can read anything the server sends. Decide this in the protocol, not in the UI.
5. Identity: a client-generated id in localStorage is a label, not authentication. Anyone can claim any id. Decide now whether that is acceptable for a no-signup product (it probably is), and do not let vote secrecy depend on it.
6. Room password: store an argon2id hash (Bun.password) in memory and in Postgres. Decide whether a successful join issues a per-room token so reconnects do not ask again, and add the schema column now.
7. Deploy state: room state lives in memory on one VPS, and rolling deploys run old and new containers side by side. Decide between drain-until-empty, handing state over, or persisting room state in Postgres and rebuilding on boot. This is the largest non-Elysia decision.
8. Validation library for the shared protocol package: TypeBox or Zod 4. The protocol schemas are the expensive part to switch later.
9. Bun minor version and the exact Elysia pin: commit both to the repo.

## 9. Open points
The following stayed open and are listed under `unverified`: the stable 2.0 date; the Bun minimum; subprotocol negotiation and close-code handling in 2.0; the 2.0 pub/sub topic API; Eden with Zod; the Zod major version; rc plugin compatibility with elysia rc.3; `app.stop` hangs on 2.0; Bun.password defaults; rc.4 changes; the status of #1911, #1716, #1961 and #1517 on rc.3; #1933 and #2017 reproduction; AOT numbers on rc.3; and the startup/shutdown hook names.

## Not verified

- Stable Elysia 2.0 release date: No stable date announced in any source read; the RC post gives none.
- Minimum Bun version for Elysia 2 RC: No explicit minimum found; only Bun types 1.3+ in the skills baseline and Bun 1.4.3 in issue #2017.
- WebSocket subprotocol negotiation (Sec-WebSocket-Protocol) in Elysia 2: No page read documents subprotocol handling; the upgrade hook only adds headers.
- Close codes and app close-code scheme in Elysia 2: The close hook receives code and reason; no page read shows how codes are set, mapped or handled on stop.
- Bun pub/sub topic API in Elysia 2: Only the v1 reference was read; the 2.0 WebSocket page names publish and subscribe without detail.
- Eden end-to-end types with Zod 4 schemas: No doc states that Zod keeps Eden types; not tested.
- Zod major version expected by Elysia 2 examples: Major version inferred from z.file() in the example; not stated.
- Compatibility of rc plugin tags with elysia 2.0.0-rc.3: Plugin peer ranges were not read; plugin RC tags are older than core rc.3.
- app.stop() hangs in Elysia 2: Only the v1 reference and a 2023 issue (#276) were found; no 2.0 issue or test checked.
- Bun.password default argon2 parameters: Defaults inferred from the example output; not stated in prose and the TypeScript declarations were not read.
- Changes in 2.0.0-rc.4: Manifest read only; no changelog found; rc.4 is not on the rc tag.
- Status on rc.3 of #1911, #1716, #1961, #1517: Read from the issue list only; bodies not opened; versions not checked.
- Reproduction of #1933 and #2017 on rc.3: Reported bugs read; not reproduced; reports name older builds (beta.30 for #2017).
- AOT bundle sizes and memory on rc.3: Bundle figures are from exp.60 (beta post); memory figures are from the RC post, which does not state the exact build.
- Startup and shutdown hook names (onStart/onStop vs setup/cleanup): Sources conflict: the skills reference says onStart and onStop; the beta post used setup and cleanup; the RC lifecycle page mentions only onStop.
- Stable OpenAPI Zod handling in rc.3: Stable 1.x docs read via search snippet only; the RC behaviour is not checked.
- Plugin release dates: Only dist-tags were read for plugins; release dates were not checked.

## Sources

- https://registry.npmjs.org/-/package/elysia/dist-tags
- https://registry.npmjs.org/elysia
- https://next.elysiajs.com/blog/elysia-20-rc/
- https://elysiajs.com/blog/elysia-20
- https://github.com/elysiajs/elysia/releases
- https://next.elysiajs.com/patterns/websocket/
- https://github.com/elysiajs/skills/blob/main/elysia/references/migration.md
- https://github.com/elysiajs/skills/blob/main/elysia/references/versions.md
- https://registry.npmjs.org/-/package/@elysia/cors/dist-tags
- https://registry.npmjs.org/-/package/@elysia/static/dist-tags
- https://registry.npmjs.org/-/package/@elysia/openapi/dist-tags
- https://bun.com/docs/runtime/hashing
- https://registry.npmjs.org/-/package/@elysia/opentelemetry/dist-tags
- https://registry.npmjs.org/-/package/@elysia/cron/dist-tags
- https://registry.npmjs.org/-/package/@elysia/eden/dist-tags
- https://github.com/elysiajs/skills/blob/main/elysia/references/runtimes.md
- https://www.npmjs.com/package/elysia?activeTab=versions
- https://registry.npmjs.org/elysia/2.0.0-rc.4
- https://next.elysiajs.com/essential/life-cycle/
- https://next.elysiajs.com/essential/plugin/
- https://github.com/elysiajs/skills/tree/main/elysia/references
- https://github.com/elysiajs/elysia/issues?q=is%3Aissue+is%3Aopen+websocket
- https://github.com/elysiajs/skills/blob/main/elysia/references/websocket.md
- https://github.com/elysiajs/skills/blob/main/elysia/references/validation.md
- https://github.com/elysiajs/skills/blob/main/elysia/references/deploy.md
- https://github.com/elysiajs/skills/blob/main/elysia/references/plugins.md
- https://github.com/elysiajs/elysia/issues/2017
- https://github.com/elysiajs/skills/blob/main/elysia/references/eden.md
- https://github.com/elysiajs/elysia/issues/1933
- https://context7.com/elysiajs/elysia
- https://bun.com/docs/runtime/http/websockets
- https://bun.sh/guides/util/hash-a-password
- https://elysiajs.com/patterns/openapi
- https://docs.sevalla.com/guides/javascript/elysia
- https://github.com/elysiajs/elysia/issues/276
- https://oday-bakkour.com/blog/series/dev-stack-releases
