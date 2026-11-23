# Effect 4 by layer, revisited

Research run of 2026-11-23 (`agw research`, depth deep), asked after the owner questioned whether the stage-1 decisions undervalued Effect. Run status: ok. Citations grounded against fetched pages: 27/28. A citation ties a claim to a page; it is not proof. Treat everything under "Unverified" as a lead, and re-check a version number before pinning it. The rulings drawn from it are in `../STRATEGY.md`, "Your rulings of 2026-11-23".

## Bottom line

- **Status:** Effect 4.0.0 shipped 2026-09-30 as the first stable line; npm latest is 4.1.5. Stability is tagged per export. Unannotated APIs are presumed stable, and Socket, SocketServer, RPC, cluster workflows and the atom React hooks are tagged unstable.
- **(1) Pure reducer core: avoid Effect.** decide/evolve/project are already deterministic, and Effect adds ceremony with no determinism gain. Use fast-check directly for property tests, since Effect 4 no longer re-exports it.
- **(2) Room actor: optional.** A per-room Scope and fiber give structural timer cancellation and cleanup. Cluster/Entity machinery is unstable and built for multi-node sharding, which this app does not need.
- **(3) Transport: adopt Bun.serve native.** Bun now documents the backpressure, pause, idle and close controls a server needs. Effect's socket layer is unstable, had an open Bun inbound-buffer bug (issue #10607, closed as completed in #10628 on 2026-11-19), and its API changed in the RC. The 853 ms vs 234 ms p99 is one 2000-socket connection storm; it is relevant to reconnect UX, not to steady-state play, and it does not decide the question alone.
- **(4) Browser client: avoid for now.** A production SvelteKit pilot measured Effect 4.1.2 at about 15 kB gzip per page. Reconnect and timeouts are a few lines either way. Pending-command ids and resume-from-seq are protocol design that Effect does not supply. TestClock is the real gain.
- **(5) Protocol: keep Zod 4 (or Zod Mini) for the shared schema.** Effect RPC is unstable and has a silent-hang bug history. Avoid it on the wire.
- **(6) Postgres, jobs, drain: adopt, as v9 already does.** This is Effect's most mature layer. Avoid ClusterWorkflowEngine unless you truly need durable workflows.

## 0. Version and stability facts

Effect 4.0.0 is the first stable release and went out on 2026-09-30, a rewrite of the fiber runtime with a zero-dependency core. Effect 4.x gets bug fixes until September 2029 (or one year after 5.0, whichever is later) and security fixes two years beyond that [effect.website/blog/releases/effect/40; infoq.com]. The stability rule: APIs tagged `@stability unstable` or `experimental` may change in minor or patch releases; everything without a tag is presumed stable. Four days after launch the team found that some modules meant to be unstable had shipped untagged and retro-tagged them in 4.0.2 [effect.website/blog/effect-4-first-week]. The language service warns on unstable APIs unless you allow them per module [same].

The docs mark these as unstable: Socket, SocketServer, Rpc/RpcClient/RpcServer, ClusterWorkflowEngine and @effect/atom-react hooks [effect.website/docs/v4/api/effect/socket/Socket; search snippets for SocketServer, RpcServer, RpcClient, ClusterWorkflowEngine; effect.website/docs/v4/api/atom-react/Hooks].

Effect 3-only or superseded claims I found and did not use: the beta blog's statement that v3 remains recommended for production (Feb 2026, superseded by stable); the v3 Mailbox page; the v3-era @effect/cluster 0.60 'pre-1.0' argument in a community issue [github.com/mmurakaru/meli-turbo/issues/154]; the 35.6 kB v3 bundle figure.

## 1. Pure reducer core (decide / evolve / project)

**Facts.** Effect 4 removed the fast-check re-export and Schema.toArbitrary. Schema-derived generation now goes through effect/unstable/arbitrary/Arbitrary.schema, or you depend on fast-check directly [effect.website/blog/effect-v4-rc-august-recap]. The Effect TestClock is a controllable Clock so that sleeps, timeouts, schedules and retries advance deterministically [effect.website/docs/v4/api/effect/testing/TestClock, search snippet]. @effect/vitest provides it.effect-style tests with TestClock, scoped tests, shared layers and property testing [github.com/Effect-TS/effect/blob/main/packages/vitest/README.md, search snippet].

**Analysis.** A pure reducer has no time, IO or randomness to model, so Effect's main payoffs (services, typed effects, interruption) have nothing to act on. Wrapping decide/evolve in Effect.gen adds allocation and makes the core harder to read for a team that is still learning v4. The seeded simulator is a plain PRNG (mulberry32 or similar); I did not verify whether Effect's TestRandom would be a better fit.

**Pattern.**
```
type Cmd = { t: 'vote'; seat: number; card: string } | { t: 'reveal' } | ...
const decide = (s: State, c: Cmd): Event[] | RoomError => ...
const evolve = (s: State, e: Event): State => ...
const project = (s: State, viewer: number): PublicView => ...
// property: fc.assert(fc.property(fc.array(arbCmd), cmds => invariantsHold(cmds.reduce(step, init))))
```

**Verdict: avoid Effect in room-core.** Keep it dependency-free, as it is today.

**Observability and failure.** Pure functions produce typed error unions, which is equivalent to Effect's typed errors here. No OTel spans are needed inside the core; instrument at the room loop.

## 2. Server room loop / actor per room

**Facts.** The stable core advertises structured concurrency, typed errors, dependency injection and resource management [effect.website/blog/releases/effect/40]. The v4 Mailbox API page was not found at the v4 path (404 on effect.website/docs/v4/api/effect/Mailbox); only the v3 Mailbox page exists, so Mailbox's v4 API and stability are unverified. Cluster and Entity modules exist but ClusterWorkflowEngine is unstable [effect.website/docs/v4/api/effect/cluster/ClusterWorkflowEngine, snippet]. The RC fixed a cluster shutdown hang from abandoned requests and added replay and owner-loss coverage [effect.website/blog/effect-v4-rc-august-recap], which signals that the cluster layer was still being hardened in 2026.

**Analysis.** A room is a single-writer state machine with a timer (reveal countdown, disconnect grace period). It needs three things: serial command processing, timers that cancel cleanly, and teardown when empty. A per-room fiber with a bounded queue and a Scope delivers all three structurally: interrupting the scope cancels timers and runs finalizers. The hand-written equivalent (a per-room async queue plus cleanup functions) is workable, but races like a reveal timer firing during a leave/rejoin are where hand-written code tends to fail. Effect's cost is the learning curve and the fiber-dump debugging surface. Supervision is structural: a room fiber forked into its own scope cannot take down its siblings. Restart policy stays your code (re-hydrate the room from Postgres).

**Verdict: optional.** Use a per-room scope and fiber if the team wants structured cancellation. Do not use Entity or Cluster for a single-process room registry.

**Caveat.** I did not verify queue or fork API names against the v4 reference this run; check them against 4.1.x before coding.

## 3. WebSocket transport on Bun

**Bun native facts (bun.com docs).** Handlers are declared once per server. `ws.send` returns -1 when the message is queued under backpressure, 0 when it is dropped (closed, or buffered beyond backpressureLimit), and the byte count otherwise. `drain` fires after -1. Bun checks backpressureLimit before queueing, so a socket can hold the limit plus one message. `ws.pause()` stops reading so the client sees TCP backpressure; the idle timeout is suspended while paused. `close(code, reason)` sends a close frame, and the close handler receives the same code and reason. The docs warn that the same-origin policy does not apply to WebSocket handshakes, so check Origin before upgrade [bun.com/docs/runtime/http/websockets].

**Effect 4 facts.** Socket is pull-based with end-to-end backpressure: nothing is read until the consumer pulls. For pause-capable transports the default highWaterMark is 64 KiB. Browsers buffer without limit unless you set one; exceeding it fails the socket and closes with 1008 [effect.website/docs/v4/api/effect/socket/Socket]. Every close, including a clean 1000, fails the reader with SocketError wrapping SocketCloseError, so consumers must classify closes themselves [same]. Reconnect is Effect.retry around the scoped consume loop [same; RC August recap]. SocketServer is unstable and hands each accepted connection to a handler as a Socket [effect.website/docs/v4/api/effect/socket/SocketServer]. platform-bun's BunSocket re-exports the Node socket constructors and provides Bun WebSocket client layers, so a server-side Effect socket on Bun goes through BunHttpServer's upgrade path [github.com/Effect-TS/effect/blob/main/packages/platform/bun/src/BunSocket.ts, snippet].

**Known Bun-path bug.** Issue #10607 (opened 2026-11-13; effect 4.1.2, Bun 1.4.2): BunHttpServer's message callback buffers inbound frames with no limit before the Socket reader sees them. The author argues Bun cannot pause a ServerWebSocket and that the bound must live in the message callback. It was closed as completed in #10628 on 2026-11-19 [github.com/Effect-TS/effect/issues/10607]. Two cautions: the issue says Bun cannot pause, while the current Bun docs document ws.pause(), so the claim is version-specific; and the issue quotes socket.runRaw, which the RC removed, so verify against your installed version. Related fix: accepted-socket writes now fail after the reader is released, PR #10730 (commit b246e24, 2026-11-19) [github.com/Effect-TS/effect/commit/b246e24...; search snippet].

**Is the 3-7x p99 difference relevant at 30 seats?** The measured ratio is 853 / 234 = 3.6x, within the range you cited. Derived sizing, with an assumption: a few hundred rooms × 30 seats gives roughly 6,000 to 15,000 sockets at full occupancy, so a 2,000-socket burst is 13 to 33 percent of the room population. That makes it a plausible reconnect storm after a deploy or network blip, so the tail matters for worst-case reconnect UX. It matters much less for steady-state play: at 300 active rooms with one action per second and a 30-seat broadcast, that is about 9,000 sends per second (an assumption, not a measurement), and the bake-off's steady-state per-message latency was not provided. On memory, the 2.3 MB vs 7.7 MB slow-consumer result is the most meaningful robustness datum. Bun's backpressureLimit also bounds per-socket buffering natively, so the same bound is achievable without Effect, though I did not measure that.

**Verdict: adopt Bun.serve native for the transport.** Pattern (names per Bun docs; limits illustrative, not measured):
```
Bun.serve<Conn>({
  fetch(req, server) {
    const o = req.headers.get('origin');
    if (o && !allowed.has(o)) return new Response('Forbidden', { status: 403 });
    return server.upgrade(req, { data: parseConn(req) }) ? undefined : new Response('Upgrade failed', { status: 400 });
  },
  websocket: {
    maxPayloadLength: 16_384, backpressureLimit: 262_144, idleTimeout: 30,
    message(ws, raw) { if (room.onMessage(ws.data, raw) === 'bad') ws.close(1008, 'bad frame'); },
    drain(ws) { room.flush(ws.data); },
    close(ws, code) { room.leave(ws.data, code); },
  },
});
```
If the team wants Effect-style lifecycle, wrap each connection in an Effect acquireRelease or Scope, and keep the socket API native.

## 4. Browser room client

**Reconnect and timeouts.** Socket.fromWebSocket takes a disableReconnects option, which implies built-in reconnect; I did not read its semantics [Socket docs]. The documented pattern is Effect.retry around the scoped reader loop [Socket docs; RC August recap]. Effect.timeout is available, and its error message was restored in the RC [RC August recap].

**What Effect does not supply.** I read no Effect 4 module that provides client message ids, acknowledgement state, or resume-from-last-seq. RpcServer tracks in-flight requests and handles acknowledgements [search snippet], but resume semantics are protocol design. Your 718-line state machine's core logic stays either way.

**Pitfall.** RpcClient with retryTransientErrors swallowed pre-open dial failures, so registered streams hung with no signal. The issue (4.0.0-beta.103) reports a production incident and was closed as completed in #7068 on 2026-08-05 [github.com/Effect-TS/effect/issues/7030]. Check your version.

**React.** @effect/atom-react hooks are unstable: useAtomValue, useAtomSet, useAtomSuspense, useAtomSubscribe, plus useAtom [effect.website/docs/v4/api/atom-react/Hooks]. Gotcha: in promise and promiseExit modes the setter observes the atom's next settled result, not one correlated with that write; overlapping writes can resolve with another write's result. Serialize writes if each caller needs its own result [same].

**Bundle size, three measurements, different programs.**
- Official stable-release figure: a minimal program using Effect, Stream and Schema is 7.1 kB min+gzip in v4, vs 35.6 kB in v3, on identical source [effect.website/blog/releases/effect/40]. The beta post said about 20 kB (roughly 70 kB in v3) [effect.website/blog/releases/effect/40-beta]. The beta-era migration doc said about 6.3 KB [github.com/Effect-TS/effect/blob/6389d9ac64c0f62ccc8b575fb9afc65fc104e814/MIGRATION.md]. Use the stable figure and treat the others as earlier snapshots.
- Production measurement: CCRTA's SvelteKit 2.68 / Vite 8 build with Effect 4.1.2 (verified 2026-11-08) gave a shared Effect chunk of 15.1 kB gzip. Each converted page grew 15.2 to 15.7 kB gzip, and /bus-tracker went from 15.6 to 31.3 kB. Rollup regrouping added 2.0 kB to the shared entry. It is a single Svelte site, not a React room client, and the imported Effect modules are not listed [lightningjar.com/findings/keep-effect-out-of-layout].
- Zod comparison, same measurement style (Rollup, gzip, z.boolean script): Zod 3 12.47 kB, Zod 4 5.36 kB, Zod Mini 1.88 kB [zod.dev/v4]. Zod Mini's own page reports 2.12 kB vs 5.91 kB for a different snippet [zod.dev/packages/mini, search snippet].

I found no measured Effect 4 bundle for a React room client. Measure your own client before and after.

**Verdict: avoid Effect in the browser for now.** If you adopt it later, isolate it in one lazily loaded module, as CCRTA did for its shared helpers.

## 5. Protocol schemas: Effect Schema vs Zod 4, and RPC

**Facts.** Zod 4 is stable with the bundle figures above [zod.dev/v4]. Effect 4 reworked Schema arbitraries natively and optimized synchronous parsing [RC August recap; RC September recap, search snippet]. Effect Schema's stability tag was not verified this run.

**Effect RPC.** RPC modules are unstable [search snippets: Rpc, RpcClient, RpcServer]. The stable post says unstable modules may change in minor releases [effect.website/blog/releases/effect/40]. 14.ai describes Effect RPC for internal dashboard-to-server calls and Effect HTTP for its public API, with OpenAPI generated from schemas; the source is a 2025 talk summarized by ZenML, self-described as partly promotional, and the Effect version is not stated [zenml.io summary]. Treat that as weak evidence of production use, not as proof of v4 readiness. RPC has open or recent pitfalls: #7030 (silent stream hang, closed 2026-08-05) and an adjacent error-detail loss issue #5988, referenced in #7030 but not read.

**Verdict.** Use Zod 4 (or Zod Mini where bundle size matters) for the shared wire schema. Keep room-core free of both. Effect Schema is optional if the server is already Effect-based; the migration gain is not measured here. Avoid effect/unstable/rpc on the room wire protocol, which has custom seq and ack requirements.

## 6. Postgres persistence, jobs, drain

**Facts.** @effect/sql-pg uses a native PgProtocol client; pg is gone from the core. PgClient.fromPool and PgClient.layerFromPool were removed, so pass connection settings to PgClient.make or PgClient.layer [RC August recap; effect.website/docs/v4/api/sql-pg]. 4.1.3 fixes: PostgreSQL transport retirement after scope release, and nested transactions waiting for a savepoint can now be interrupted; statements from a fiber that outlives its transaction fail instead of leaking [This Week in Effect 144]. SQL persisted queues use migrations [RC August recap].

**Durable jobs.** ClusterWorkflowEngine persists activity results as cluster messages, so completed activities replay from storage; durable clock wakeups are supported [ClusterWorkflowEngine docs, snippet]. It is unstable.

**Drain.** Effect's Scope and finalizers make shutdown structural. 4.1.3 fixed NodeHttpServer shutdown hanging while WebSocket clients were connected [This Week in Effect 144]. That fix is in the Node adapter; I did not verify Bun behavior, so test drain with live sockets on Bun.

**Verdict: adopt.** This is where Effect is most mature and most useful: Schedule retries, scoped resources, typed SQL errors. It matches the v9 split.

## 7. Observability and failure handling vs hand-written code

- HTTP, SQL, RPC and AI spans and metrics follow OpenTelemetry semantic conventions as of 4.0.1 and 4.0.2 [effect.website/blog/effect-4-first-week].
- The RC fixed log annotations overwriting active span correlation identifiers, and fixed disabled-tracer timing still recording span end times [RC August recap].
- Socket failures are typed: SocketError's reason is one of Read, Write, Open, Upgrade or Close [Socket docs].
- Cleanup failures are merged with the original cause, preserving Cause.Done, per the RC [RC August recap].
- Hand-written equivalent: you write span names, error mapping and close-code handling yourself. That is more code but fewer hidden semantics.

## 8. Production evidence, by layer

| Layer | Evidence | Strength |
|---|---|---|
| Core and stable modules | Official stable release, LTS policy, 43.9M weekly npm downloads (vendor and InfoQ) | medium |
| Bundle | CCRTA SvelteKit pilot, Effect 4.1.2 | medium |
| Socket on Bun | Issue #10607 (reported and fixed), #10730 | medium |
| RPC | Issue #7030, production incident described in issue | medium |
| Full-stack Effect | 14.ai talk (2025, promotional, version unknown) | low |
| Room-level actor or sharding at scale | Not found | none |

## 9. The owner's three hypotheses

1. **Decision undervalued control and robustness.** Partly right. Effect gives you typed close and error channels and structural cleanup, and the bake-off's memory bound (2.3 MB vs 7.7 MB) is the strongest robustness datum. But Bun native now documents backpressure, pause and close semantics, so the same guarantees are reachable without Effect's unstable socket layer. Test the claim with the same slow-consumer harness on both.
2. **Decision overvalued latency.** Partly right. The p99 gap is real (3.6x), but it comes from one connection-storm scenario. For planning poker, steady-state per-action latency and reconnect correctness matter more. Ask for the steady-state numbers before deciding.
3. **The team lacks Effect 4 expertise.** Evidence supports this. The v4 docs site has had confusion [github.com/Effect-TS/website/issues/1372], and a community skill warns that models and effect.website default to v3 [github.com/peterpme/skills/.../effect-v4/SKILL.md, snippet]. The language service and migration skill help, but unstable-API churn raises the cost of a team that is still learning. Keep Effect where it is already stable and load-bearing: Postgres, jobs, startup, drain.

## 10. Recommended split

- room-core: plain TypeScript, no Effect, fast-check direct.
- Transport: Bun.serve native, with explicit origin check, maxPayloadLength, backpressureLimit, idle timeout, close-code mapping.
- Room loop: plain queue for now; revisit a per-room Effect scope only if cleanup bugs appear.
- Protocol: Zod 4 (or Zod Mini).
- Browser client: keep hand-written state machine; measure the bundle before adopting Effect.
- Server persistence, jobs, drain: Effect (current v9 design).
- Gate any Effect unstable API (Socket, RPC, cluster) behind a spike with your own slow-consumer and reconnect tests.

## Unverified

- The bake-off figures (853 vs 234 ms p99; 2.3 vs 7.7 MB): internal, single run, unknown Effect version and whether it used the pre-RC run/runRaw API. Not reviewed.
- Effect 4 client bundle for this app: no measurement exists in sources; CCRTA is Svelte and its imported modules are not listed.
- Mailbox v4 API and stability: no v4 reference page found.
- Effect Schema v4 stability tag: not verified.
- Whether BunSocket provides a server-side SocketServer on Bun: the source snippet says it re-exports Node constructors and Bun WebSocket client layers; server path inferred.
- Which release contains the #10607 fix (closed 2026-11-19 via #10628): release not verified.
- Bun ws.pause availability across versions: documented in current Bun docs, disputed by #10607 on Bun 1.4.2.
- Drain on Bun with live WebSockets under Effect: not verified.
- Bun config option names (maxPayloadLength, backpressureLimit, idleTimeout): taken from the docs' backpressure section; the full options list was truncated in my read.
- Effect's queue and fork API names for the room loop: not verified in the v4 reference this run.
- 14.ai production claims: a 2025 talk summary with unknown version.
- Steady-state load for 300 rooms: derived from stated assumptions, not measured.

## Sources

- https://effect.website/docs/v4/api/effect/socket/Socket
- https://www.infoq.com/news/2026/11/effect-4-0-release/
- https://effect.website/blog/effect-v4-rc-august-recap
- https://effect.website/docs/v4/api/effect/socket/SocketServer
- https://bun.com/docs/runtime/http/websockets
- https://effect.website/blog/this-week-in-effect/144
- https://effect.website/blog/effect-4-first-week
- https://effect.website/blog/releases/effect/40
- https://effect.website/blog/releases/effect/40-beta
- https://zod.dev/v4
- https://effect.website/docs/v4/api/platform-bun
- https://effect.website/docs/v4/api/atom-react/Hooks
- https://effect.website/docs/v4/api/sql-pg
- https://github.com/Effect-TS/effect/issues/10607
- https://effect.website/docs/v4/api/effect/testing/TestClock
- https://github.com/Effect-TS/effect/issues/7030
- https://www.lightningjar.com/findings/keep-effect-out-of-layout
- https://effect.website/docs/v4/api/effect/cluster/ClusterWorkflowEngine
- https://www.zenml.io/llmops-database/building-reliable-ai-agent-systems-with-effect-typescript-framework
- https://effect.website/blog/effect-v4-rc-september-recap
- https://github.com/Effect-TS/effect/blob/main/packages/platform/bun/src/BunSocket.ts
- https://github.com/Effect-TS/effect/commit/b246e246554c4ae6700ae36583a3695a45d80f81
- https://github.com/Effect-TS/effect/blob/main/packages/vitest/README.md
- https://zod.dev/packages/mini
- https://github.com/mmurakaru/meli-turbo/issues/154
- https://github.com/peterpme/skills/blob/2031f6eaa3fc97d56f29a6fe47d7f5303a7e0c24/effect-v4/SKILL.md
- https://github.com/Effect-TS/website/issues/1372
- https://www.npmjs.com/package/effect
