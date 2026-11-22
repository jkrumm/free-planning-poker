# The transport bake-off

Which WebSocket path carries the rooms, decided by measurement in `v9-api-ws` (docs/v9/ARCHITECTURE.md, Server). **Winner: `Bun.serve`'s native WebSocket handler**, beside Elysia's fetch for every HTTP route. It had the lowest 99th percentile, and Elysia 2's `websocket()` plugin was not within 10 % of it, so the tie rule for Elysia did not apply. Effect's socket server passed every case but was three to seven times slower at the 99th percentile.

All three adapters are in the commit "feat: three adapters of the room socket and their contract suite"; the next commit deleted the two that lost. Find it with `git log --diff-filter=D --format=%H -1 -- apps/api/src/ws/effect.transport.ts` (that prints the deleting commit; its parent holds all three), check the parent out in a worktree, run `bun install --frozen-lockfile` there, then `bun apps/api/scripts/bake-off.ts [elysia bun effect] [--runs n]`. The `--phase burst|slow` flag and the alternating order came with the deleting commit; copy its `bake-off.ts` over to rerun the paired set.

## Results

| | Elysia 2 `websocket()` | Bun.serve native handler | Effect 4 socket server on Bun |
|-|-|-|-|
| Contract suite (11 cases at the time; three cases that send the protocol fixtures came after and pass on the winner) | 11 pass | 11 pass | 11 pass |
| Burst, 12 runs: median of p50 / p99 | 232 / 322 ms | 161 / 234 ms | 388 / 853 ms |
| Burst, 20 paired runs (Elysia and Bun only): median of p50 / p99 | 88 / 138 ms | 72 / 117 ms | not run |
| Frames lost (sockets with a gap in `seq`), all runs | 0 | 0 | 0 |
| Peak memory of the server process, burst | 133 MB (idle 74) | 118 MB (idle 69) | 148 MB (idle 70) |
| Slow consumer closed at the limit | yes, every run, after 48 to 49 of 1,000 frames | yes, every run, after 48 to 69 | yes, every run, after 48 to 49 |
| Reading seat got all 1,000 frames | yes, every run | yes, every run | yes, every run |
| Reading seat, flood with / without the slow one (median) | 2,122 / 2,668 ms | 2,176 / 2,420 ms | 2,216 / 2,439 ms |
| Server memory growth during the slow flood, worst run | 8.0 MB | 7.7 MB | 2.3 MB |
| Lines of adapter code (no comments, no blank lines) | 90 | 73 | 121 |
| Upstream reports hit | #1911 | none | none of #10607; no topic API |

Shared by all three and kept: `apps/api/src/ws/edge.ts` (77 lines: the upgrade check, the socket options, outgoing validation) and `apps/api/src/ws/clock.ts` (117 lines: the clock port on one timer).

The reading seat's flood takes about two seconds in every case because the flood is paced at one event per millisecond; a paused seat beside it delayed it in no run (the paused runs were as fast as or faster than the baselines).

## How it was measured

- **Host:** the Mac mini (macOS, arm64) with other factory leads running beside it: load averages between 21 and 94 during the runs, so single runs swing by a factor of ten. Local Bun is 1.4.2; `package.json` pins 1.4.4, which CI runs the suite on. The server ran in a process of its own (`apps/api/scripts/bake-off-server.ts`), the clients in another; the second and third sets ran inside a factory test slot.
- **Burst:** 2,000 sockets in 200 rooms of 10 seats (T-shirt deck, no reveal countdown). Every seat votes at once (2,000 commands), then one seat per room reveals (200). A command's latency runs from its send to the moment the last of its room's 10 sockets holds the `evt`; p50 and p99 are over those 2,200 commands. Because every command leaves at once, the p99 is mostly the time to drain the whole burst. Every socket's events are checked to run in `seq` without a gap after its `welcome`. Peak memory is the operating system's maximum resident set of the server process.
- **Sets:** 5 runs of all three adapters without a slot, then 7 in a slot (together "12 runs"); then 20 runs of Elysia and Bun alone, in a slot, the order flipped every run so drifting load favours neither. In the 12 runs the medians favoured Bun (p99 234 against 322 ms) while the run-by-run ratio favoured Elysia (median 0.90), which is noise at that load; the 20 paired runs settled it: Elysia's p99 over Bun's had a median of 1.21, and Bun was faster in 13 of 20.
- **Slow consumer:** two seats; events of 12,222 bytes (a `topic.added` of five long topics); 1,000 published through the adapter's `publish`, one per millisecond, first with both seats reading, then with one paused (`WebSocket.pause()`, Bun 1.4.1).

## What the measurement found

- **Bun ends a frame above `maxPayloadLength` without a close frame:** the client reads 1006, not 1009, so `docs/v9/research/r02-netcode-patterns.md` and `r10-deploy-topology.md` were wrong on this. Bun's ceiling is therefore 64 KB and the runtime's own 16 KB check sends the 1009 (`RUNTIME_LIMITS.maxFrame`); a frame above 64 KB still ends with 1006.
- **A consumer closed at the backpressure limit also reads 1006**, in every adapter: Bun drops it without a close frame. The client treats it as a lost connection and reconnects, which is what a slow consumer should do.
- **The limit counts per socket, and a synchronous burst fills a reader's buffer too:** publishing 10 MB in one turn of the event loop closed a seat that was reading. The runtime publishes one event per command, so this needs no guard today; a future batch publish must yield between frames.
- **Elysia:** a JSON-shaped text frame is parsed before the handler (#1911), so the adapter serialised it again for the runtime, which parses it a third time. `beforeHandle` runs at the upgrade and before every message, so the Origin check had to go into a `derive`. A socket with more than 256 frames in flight is closed with 1013. #1716, #1933 and #2017 were avoided by design (an id minted at the upgrade, no response schema, the address from the path) and not reproduced.
- **Effect:** the socket has no topic, so publish is a loop over the room's sockets; its writer discards the return code of Bun's `send()`, so only Bun's `closeOnBackpressureLimit` bounds a slow consumer, which it did. #10607 did not show: the reader pulls without pause, so frames wait only between two pulls. `BunHttpServer` and `Socket` sit under stable import paths in 4.1.4 (`effect/socket/Socket`, `effect/http/*`) while their documentation marks them `@stability unstable`.

## The decision

Kept: `apps/api/src/ws/bun.transport.ts`, `edge.ts`, `clock.ts`. Deleted: `elysia.transport.ts`, `effect.transport.ts`, and the `effect` and `@effect/platform-bun` pins they needed. Elysia serves every HTTP route through `Bun.serve`'s fetch. A bump of Bun or Elysia passes `apps/api/test/contract/transport.server.test.ts` before it merges; a candidate for a later bake-off joins `ADAPTERS` in `apps/api/test/contract/harness.ts` and runs the same suite and script.

## The stop after server-side closes (Bun issue 36223)

Bun issue 36223 reported that `server.stop()` never resolves once the server closed a WebSocket itself (Bun 1.3.14); it was closed on 28 July 2026 as fixed on main, in the 1.4.0 canary, with no release named. `apps/api/scripts/stop-after-close.ts` checked the pinned Bun on 22 November 2026: on 1.4.4 (and on 1.4.2), `stop()` and `stop(true)` resolve in under 1 ms after `close(4002)` and after `terminate()`, whether or not the clients had answered. The pin needs no bump. The drain still races every step against its deadline (`DRAIN_DEADLINE_MS`), and the script runs again with each Bun bump.
