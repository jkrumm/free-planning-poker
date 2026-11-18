# Game-networking patterns for low-tick rooms

Research run of 2026-11-18 (`agw research`, depth deep). Run status: ok. Citations grounded against fetched pages: 34/34. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line

- **Shared reducer:** Yes. Put one pure, versioned room reducer in a shared package. The Bun server is the only writer and the source of order. The browser runs the same reducer only to predict its own pending action. Figma and Linear both keep the server as the order authority.
- **Wire format:** Send typed events plus a full snapshot on join and on resume. Do not adopt JSON Patch, Immer patch streams or Colyseus Schema binary deltas at this size. The saving is real in ratio terms but small in bytes.
- **Optimistic updates:** Use them only for the user's own vote and emote. Mark them pending until the server's `seq` covers them. While an action is pending, ignore older snapshots (Figma's no-flicker rule).
- **Sequencing and resume:** One monotonically increasing `seq` per room gives a total order, as Linear's `lastSyncId` does. Resume uses a server-minted seat secret plus the last seen `seq`. The server answers with a snapshot, not a replayed log.
- **Heartbeats and presence:** Rely on Bun's built-in ping and `idleTimeout` to find dead sockets. Derive presence from socket state with a grace window (longer for phones). Do not build an application heartbeat loop yet.
- **Ephemeral channel:** Emotes and reactions are non-persisted broadcasts with per-connection caps. There are no cursors to support.
- **Encoding:** JSON text frames now, with the protocol version in the WebSocket subprotocol. Add MessagePack only if measurement asks for it. Protobuf is over-engineering here.
- **permessage-deflate:** Leave it off. Bun compresses `publish()` by default, and dedicated compression costs memory per connection.
- **Bun pub/sub:** Use one topic per room. The published 4.17M msgs/s figure is a vendor broadcast benchmark on 32 clients. It is not a planning number.
- **Rate limiting:** Build a per-connection token bucket, a small payload cap (about 16 KB) and close codes for abuse from day one. This is the one hardening piece worth building now.
- **Room lifecycle:** Rooms live in memory, write a snapshot to the database on change, and are disposed after an empty grace period. Hibernation is a Cloudflare Durable Objects concern and does not apply on the VPS.
- **Versioning:** Make changes additive by default, negotiate a protocol version at connect, and use a distinct close code that makes the client prompt a reload.
- **Reference designs:** Figma and Linear use server-ordered changes with client caching and resend. Colyseus is a full framework built on binary state sync. Liveblocks is hosted and separates presence and events from durable storage. The PartyKit hosted platform is scheduled to shut down on 23 Oct 2026, so do not adopt it.
- **Recommendation:** Build a thin protocol on `Bun.serve`. Borrow ideas (seat reservation, per-connection message caps, presence grace, per-client views) from Colyseus and Liveblocks rather than adopting either.

## Versions, dates and maturity (checked 18 Nov 2026)

| Component | Checked version | Date | Licence and maturity |
|---|---|---|---|
| Bun | 1.4.4 | 'October 2026' per bun.com | Licence not checked. WebSocket API documented on bun.com. |
| Elysia | 1.4.32 (npm latest) | '11 Nov' (year not printed on the page) | Licence not checked. 1.4.x gets security fixes only (1.4.30 notes). Elysia 2 is at 2.0.0-rc.4 per the 1.4.32 notes. |
| colyseus | 0.18.12 | '07 Nov' (year not printed) | @colyseus/core 0.18.28 and @colyseus/bun-websockets 0.18.5 released '10 Nov'. Licence not checked. |
| Immer | 11.2.10 | 2026-11-10 | Patches require `enablePatches()` since v6. Licence not checked. |
| msgpackr | 2.1.4 (npm) | not checked | MIT (repo page). GitHub releases page shows v1.3.2 (18 May) as latest. This mismatch is unresolved. |
| PartyKit hosted platform | n/a | Deploys stop 16 Oct 2026; shutdown 23 Oct 2026 | Scheduled shutdown. PartyServer (Cloudflare Workers) is the maintained successor. |
| Liveblocks | not checked | n/a | Hosted service. Version and licence not checked. |
| RFC 6902 (JSON Patch) | n/a | April 2013 | Proposed Standard. |

## What the reference designs say

**Figma (2019 post, not updated).** Clients talk to a server process per document over WebSockets. On reconnect the client downloads a fresh copy of the document, reapplies offline edits on top, and resumes syncing. The authors say connecting and reconnecting are 'very simple' and that the complexity sits in updates to already-connected documents. The server defines event order, so the design is last-writer-wins per property with no timestamps. Client changes apply immediately. Incoming server changes that conflict with unacknowledged local changes are discarded, to avoid flicker. Figma chose this over OT and CRDTs because the server is the central authority.

**Linear (community reverse engineering; Linear's own 2023 talk page was read but its transcript was not).** The `lastSyncId` is a monotonically increasing sync id that gives a total order. Transactions run on the server and are reversible on the client. The server broadcasts delta packets to every client, including the one that sent the transaction. Unsent transactions are cached in IndexedDB and resent on reconnect. The author argues the model is closer to OT than CRDT because a central server orders the transactions. The repo title says it is endorsed by Linear's CTO; that was not verified.

**Colyseus.** Only the server mutates room state; clients listen for changes. The schema is delta-encoded: only changed properties are sent, and re-assigning the same value sends nothing. Defaults: `patchRate` 50 ms, `autoDispose` true, `seatReservationTimeout` 15 s, `maxMessagesPerSecond` Infinity (so you must set it). Messages are MsgPack by default. Reconnection holds the seat with `allowReconnection`, issues a `reconnectionToken` on every connection, and sends a full state snapshot on reconnect. Application close codes are 4011 to 4999. Its docs say to use messages for transient data and patches for state.

**Liveblocks.** The server has one point where changes are applied in order. 'Last change to reach the server wins' per key. Local changes apply at once and are held as pending. Conflict resolution applies only to Storage, not to Presence, Events or Feeds. Presence resets on disconnect. Defaults: throttle 100 ms, `lostConnectionTimeout` 5000 ms (so presence does not flash on a short drop), background keep-alive disabled.

**PartyKit.** Hibernation keeps client sockets open while the server instance is unloaded. In-memory state must be reloaded on each wake, and handlers attached in `onConnect` are lost. The docs claim up to 32,000 connections per room with hibernation versus 100 without; that is a vendor claim. The hosted platform is shutting down, and the successor is PartyServer on Cloudflare Workers with Durable Objects.

**Cloudflare Durable Objects (hibernation API).** Clients stay connected while the object is evicted. In-memory state resets on wake. Attachments are limited to 16,384 bytes. Ping/pong is handled without waking the object. The docs advise batching small messages.

## Pattern by pattern

**1. Server-authoritative reducer.** Write `reduce(state, action, ctx) => state` in a shared package and use Immer's `produce` for ergonomics. Pass time and randomness in through `ctx` so the server and client reducers agree. The server runs it on every command, assigns `seq`, and publishes the event. The client runs it only to predict its own pending action and rebuilds `snapshot + pending` when the server's view changes. Colyseus has no shared reducer (only the server mutates state), and that is the main thing you would give up by adopting it.

**2. Snapshot, delta and patch.** At 30 players, a snapshot is roughly 2.7 KB (derived estimate, not measured). A typed event such as `vote`, `reveal` or `presence` is about 150 bytes. Use events plus a snapshot on join and on resume. JSON Patch is index- and path-based and needs a base-version check on every apply. Immer patches use array paths rather than RFC 6902 string pointers, and Immer says generated patches are not guaranteed minimal. Colyseus Schema is built for 60 entities at 20 Hz, where its docs show 9.4 to 16.4 KB/s; at one vote per user per round it buys nothing.

**3. Optimistic updates and reconciliation.** Keep a queue of `{clientMsgId, action}`. Remove an entry when a server event carries `seq` at or after it. Ignore incoming snapshots older than the newest pending action. Use `clientMsgId` for idempotent retries after reconnect. This is the Figma and Liveblocks rule, and the Linear cache-and-resend. For votes, the simplest UI is 'vote pending' until acknowledged; no rollback engine is needed. The server rejects a vote after reveal and the client drops it.

**4. Sequence numbers and resume tokens.** Give each room one `seq` that increases on every reduced event. Mint a random per-room seat secret at join, store it on the client next to the anonymous id, and keep only its hash in the database. The client's id is for display; the seat secret is the credential. Without a server-minted secret, anyone who learns a localStorage id can take over that seat. On resume, send `{seatSecret, lastSeq}`. If the seat is still held, send a snapshot and continue from its `seq`. Hold seats 30 to 60 s on desktop and at least 2 min for phones. That grace period is judgement, not sourced. Colyseus's 30 s example and 5 min for turn-based games are the reference points.

**5. Heartbeats and presence.** Bun sends pings and closes idle sockets after `idleTimeout` (default 120 s; `sendPings` defaults to true). That is enough to detect dead connections on the server. Browsers cannot send WebSocket pings, so a client that needs to notice a dead server should use an application-level ping. For planning poker, derive presence from socket state: connected, reconnecting (seat held) or left. Show 'reconnecting' only after a short delay, as Liveblocks does with its 5 s lost-connection timeout. On iOS, backgrounded tabs lose sockets. Reconnect on `visibilitychange` and `online`, and use the seat secret.

**6. Ephemeral channels.** Emotes and reactions are broadcast events that are never written to the snapshot. Cap them per connection (for example one per 2 s). Drop them rather than queue them when a client is slow. Liveblocks treats events and presence as non-conflicting and non-durable, and Colyseus says to use messages for transient data. Cursors are not needed here.

**7. Encoding: JSON, MessagePack, CBOR, protobuf.** Start with JSON text frames. They are debuggable and the messages are small. Put the protocol version in the subprotocol (`pp.v1`) so a binary encoding can be added later without changing the message semantics. msgpackr's README claims it is faster than native JSON on Node and 15 to 50 percent more compact with its record extension. A search snippet from a serialization benchmark (not read in full) shows `JSON.parse` faster than MessagePack for one dataset. The two sources disagree, which fits the advice that the answer depends on payload and library. Colyseus uses MsgPack by default. CBOR and protobuf were not benchmarked in this run; protobuf adds a schema build step that this app does not need.

**8. permessage-deflate and Bun pub/sub numbers.** Bun's docs say `ws.send()` and `ws.publish()` do not compress unless you pass `true`, but `server.publish()` compresses unless you pass `false`. The docs also say compression makes short messages larger. Dedicated per-socket compressors cost their window size per connection (16 KB for `16KB`). Elysia's `perMessageDeflate` defaults to false. Recommendation: keep it off.

Bun's homepage (v1.4, EPYC 9R14, medians of 3, 32 clients broadcasting) reports: Bun publish 4,170,027 msgs/s at 51 MB peak RAM; Bun send 159,379 msgs/s at 37 MB; Deno 124,088 msgs/s at 1.2 GB; ws on Node 123,486 msgs/s at 78 MB. The docs page still shows an older chart (Bun v0.2.1, about 700,000 msgs/s on 16 clients). The publish-versus-send semantics are not fully defined on the page, and the benchmark is the vendor's. Use it only as an upper bound on fan-out capacity.

**9. Rate limiting and abuse control.** Use a per-connection token bucket. The lazy-refill design avoids timers (Real-Time WebSocket guide). Rate-limit both connections per client and messages per connection (websocket.org example: 10 messages/s). Set `maxPayloadLength` to about 16 KB; Bun's default is 16 MB, and oversized frames get close 1009 automatically. Colyseus's `maxMessagesPerSecond` disconnects the client when exceeded. Suggested policy (judgement): burst 10, refill 5/s, one emote per 2 s, joins limited per IP, repeated violations close with 1008. Also check the `Origin` header on upgrade (Bun's docs warn about cross-site WebSocket hijacking). Keep vote values and room payloads out of OpenTelemetry attributes; log counts only.

**10. Room lifecycle, hibernation and rolling deploys.** Create a room on first join. Keep it in memory with a topic. Write a debounced snapshot (about 300 ms) to Postgres on each change using `Bun.sql`. Restore from the snapshot when a room is requested and not in memory. Dispose a room after an empty grace period (Colyseus's `autoDispose` is the reference). Retain snapshots for a fixed period to fit the privacy-first brief. Hibernation solves a billing problem on Cloudflare; on a VPS it adds reload cost without benefit.

Deploys are the risky part. With in-memory rooms, a restart loses votes unless rooms are persisted. The safe drain is: on SIGTERM, stop creating rooms, flush snapshots, close sockets with an application code such as 4011 (reconnect), and let clients reconnect to the new container, which loads rooms from Postgres. During the overlap, the old container must refuse new room work. Only one container should own a room at a time. A database lease is the robust answer, but at this scale a refuse-and-drain rule is probably enough (judgement).

**11. Protocol versioning across deploys.** A web deploy updates the server at once and the client only on reload, so a long-lived socket can speak an old protocol for hours (RTWebSocket). Make changes additive: add fields, do not rename or remove them, and have clients ignore unknown fields and message types. For a breaking change, negotiate a version at connect and store it on the connection. Keep up/downcasters at the edge. Reject unsupported versions with a distinct close code that the client turns into a reload prompt. Measure the share of connections on each version and retire a version only when it is near zero for a week. Colyseus's app close codes (4011 to 4999) are the place for these.

## Scale check: 30 per room, a few hundred rooms (derived, not measured)

- Peak sockets: about 300 rooms times 30 users, which is 9,000.
- Votes: one round with 30 votes sent as events to 30 recipients is about 900 deliveries, roughly 135 KB at 150 bytes each. Sending a full snapshot on every vote is roughly 2.4 MB per room per round, about 18 times more. Both are affordable; the simpler event-plus-join-snapshot design is enough.
- Emote worst case: every user emotes once every 5 s in all 300 rooms. That is about 1,800 emotes/s, each fanned out to 29 others, or about 52,000 deliveries/s. That is roughly a third of Bun's synthetic 'send' figure. A per-connection cap bounds it.
- Permessage-deflate with dedicated contexts: 9,000 connections times 16 KB is about 144 MB worst case. Keeping it off avoids this.
- Memory per Bun WebSocket connection was not measured here.

## Over-engineering at this scale

- CRDTs, OT or Yjs. A central server already gives a total order.
- Hosted real-time services (Liveblocks, PartyKit) for a privacy-first app that already has a VPS.
- Binary state sync (Colyseus Schema), JSON Patch and Immer patch streams on the wire.
- Protobuf, and MessagePack before a measured need.
- Event-log replay for resume. Snapshot on resume is simpler and cheap.
- Client-side prediction and reconciliation engines beyond the pending-queue rule.
- Per-recipient encoding. Hidden votes are a state-level rule (public `hasVoted`, values only after reveal), so one publish per event works.
- Cross-region or multi-node sharding, Durable Objects, and hibernation.
- Cursors and presence beyond who is here and who has voted.

What is not over-engineering: the server-minted seat secret, the per-connection caps and payload limit, the database snapshot, the `seq` and the protocol version in the subprotocol.

## Recommendation

Build a thin protocol on `Bun.serve` (use Elysia only for HTTP if that helps). Elysia 1.4 is in security-only maintenance and Elysia 2 is still at RC, so a thin Bun layer reduces dependence on the framework. The design:

- Shared package: `reduce()`, zod or TypeBox message schemas, and tests that run the same reducer on server and client.
- Server: one `Room` per id with `{seq, state, topic}`. Commands are validated, reduced, given a `seq`, persisted (debounced), and published to the room topic.
- Client: pending queue keyed by `clientMsgId`, snapshot on join and resume, seat secret in sessionStorage or localStorage.
- Transport: JSON text, subprotocol `pp.v1`, `perMessageDeflate` off, `maxPayloadLength` around 16 KB, `idleTimeout` set explicitly.
- Borrow from Colyseus: seat hold with a reconnection token, per-connection message caps, the close-code convention. Borrow from Liveblocks: presence reset on disconnect, delayed 'reconnecting' display, the separation of durable state from events.
- Do not adopt Colyseus, Liveblocks or PartyKit. Colyseus has a Bun transport (0.18.5), so it stays an option if the custom layer grows.

## Tradeoffs

- Own protocol: you own its correctness. The surface is small and the shared reducer is testable, which is the mitigation.
- Colyseus: good reconnection and room model, but a second state model and a framework on top of the server. Its binary sync is more than this app needs.
- Liveblocks: fastest to build, but room data leaves the VPS, which conflicts with the privacy-first brief. Cost and limits were not checked.
- PartyKit: scheduled shutdown; not viable.
- Cloudflare Durable Objects (PartyServer): good scaling and hibernation, but it moves the socket layer off the VPS, against the stated plan.
- Single VPS: a single point of failure, acceptable for 30-person rooms. Rolling deploys need the drain described above.
- Elysia's maintenance status: a thin `Bun.serve` layer reduces dependence.

## Decide now (cannot be retrofitted cheaply)

1. **Seat identity.** Server-minted per-room seat secret. The client id is display only. Adding this later leaves existing rooms open to impersonation.
2. **Envelope.** `{v, type, roomId, seq?, clientMsgId?, payload}`, JSON text frames, unknown fields ignored, protocol version in the subprotocol.
3. **Total order.** A single `seq` per room, present on every server event.
4. **State shape.** Fully serialisable JSON snapshot. The reducer is pure, with time and randomness passed in.
5. **Hidden-vote rule.** Values never leave the server before reveal, including in snapshots, logs and telemetry.
6. **Event classes.** Durable state and ephemeral events are separate. Emotes are never stored.
7. **Caps from day one.** Payload size, per-connection rate limit and join limits at the transport layer.
8. **Persistence and retention.** A room snapshot in Postgres from the first version, with a retention window.
9. **Idempotency.** `clientMsgId` on every command.
10. **Telemetry content policy.** No payloads or votes in traces.

## Uncertain or open

- Bun's published pub/sub numbers are vendor figures and the publish-versus-send metric is not fully defined.
- msgpackr: npm says 2.1.4 and GitHub's latest release is v1.3.2; the date of 2.1.4 was not checked.
- Colyseus and Elysia release years are not printed on their release pages; the year is inferred from page order.
- Linear: the 2023 talk page was read but not its transcript. The description rests on community reverse engineering.
- Figma's post dates from 2019 and may not describe the current system.
- PartyKit: whether the hosted platform has actually shut down after 23 Oct 2026 was not checked.
- Licences for Bun, Elysia, Colyseus, Immer and Liveblocks were not checked in this run; only msgpackr's MIT was seen.
- Protobuf and CBOR were not benchmarked. Memory per Bun connection was not measured.
- The claimed PartyKit hibernation capacity (32,000 per room) is vendor-stated.
- Elysia 2's RC status comes from a release-note line, not from its own docs.
- Recommendations on grace periods, rate-limit values, drain behaviour and the database lease are judgement and are labelled as such above.

## Not verified in this run

- Linear sync engine design from Linear's own talk (transcript and details): Only the landing page was read. The video transcript was not fetched, so Linear's own description rests on a community reverse-engineering repo.
- Licences of Bun, Elysia, Colyseus, Immer and Liveblocks: Not checked in this run. Only msgpackr's MIT licence was seen on its repo page.
- msgpackr current release and date: npm reports 2.1.4 but the GitHub releases page shows v1.3.2 (18 May) as latest. The release date of 2.1.4 was not found.
- Release years for Colyseus, Elysia and Bun 1.4.4 dates: The release pages print day and month without the year. The year was inferred from page order and the bun.com date.
- Bun pub/sub benchmark methodology: The numbers are vendor-published. The publish-versus-send metric is not fully defined and no independent benchmark was run.
- Protobuf and CBOR performance on Bun: Not benchmarked in this run. Only msgpackr's self-reported claims and one low-confidence search snippet were available.
- Memory per Bun WebSocket connection: Not measured. The 16 KB per-connection figure applies only to Bun's dedicated compressor.
- PartyKit shutdown status after 23 Oct 2026: The announced shutdown date was read, but whether it has happened by 18 Nov 2026 was not checked.
- PartyKit hibernation capacity (32,000 connections per room): Vendor claim from a 2025 doc page, not independently checked.
- Elysia 2 status: Only the 2.0.0-rc.4 reference in a release note was seen. Elysia 2 documentation was not read.
- Liveblocks version, pricing and limits: Not checked. Only the client API reference and conflict-resolution guide were read.
- Grace-period, rate-limit and drain-behaviour values: Judgement for this app, not sourced. Colyseus defaults and the sources cited above are the only reference points.
- Cross-check of Figma's current architecture: The only Figma source read is a 2019 post. Later changes to Figma's system were not checked.

## Sources

- https://www.figma.com/blog/how-figmas-multiplayer-technology-works/
- https://linear.app/now/scaling-the-linear-sync-engine
- https://github.com/FredKSchott/reverse-linear-sync-engine/blob/main/SUMMARY.md
- https://docs.colyseus.io/state
- https://docs.colyseus.io/state/optimization
- https://docs.colyseus.io/room/reconnection
- https://docs.colyseus.io/room
- https://docs.colyseus.io/faq
- https://github.com/colyseus/colyseus/releases
- https://liveblocks.io/docs/guides/how-conflict-resolution-works-in-liveblocks-sync
- https://preview.liveblocks.io/docs/api-reference/liveblocks-client
- https://blog.partykit.io/posts/hosted-platform-shutdown
- https://docs.partykit.io/guides/scaling-partykit-servers-with-hibernation
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://bun.com/docs/runtime/http/websockets
- https://bun.com/
- https://github.com/elysiajs/elysia/releases
- https://context7.com/elysiajs/elysia
- https://immerjs.github.io/immer/patches/
- https://github.com/immerjs/immer/releases
- https://www.rfc-editor.org/rfc/rfc6902
- https://github.com/kriszyp/msgpackr
- https://github.com/kriszyp/msgpackr/releases
- https://github.com/p2kr/SerializationBenchmarks/blob/master/docs/QUICK_REFERENCE.md
- https://websocket.org/guides/security
- https://www.real-time-websocket.com/backend-websocket-connection-management/backpressure-and-flow-control/rate-limiting-websocket-messages-per-client/
- https://www.real-time-websocket.com/backend-websocket-connection-management/message-protocol-design/versioning-websocket-message-schemas/
- https://www.npmjs.com/package/colyseus
- https://www.npmjs.com/package/elysia
- https://www.npmjs.com/package/immer
- https://www.rfc-editor.org/info/rfc6902
- https://www.npmjs.com/package/msgpackr
