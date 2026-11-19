# v9 architecture

The technical contract of the rewrite that ships as release 9.0.0. It binds every file under the new directories listed in "Repo map". The directories of the current app (`apps/web`, `apps/server`, `packages/db`, `packages/shared`, `fpp-analytics`) are v1: they stay in production until the cutover and take fixes only. For v1 the root `AGENTS.md` governs; for v9 this file governs, `UX.md` says what the product does and `ENGINEERING.md` how code is written, checked and run. Why each choice was made, and what was rejected: `STRATEGY.md`. Evidence: `research/`.

## Invariants

These cannot be retrofitted. A change to one is a plan change with the owner's verdict, never a side effect of a row.

1. **One origin.** Marketing pages, the room app, the API and the WebSocket are served under `https://free-planning-poker.com`. Storage is per origin, so a second origin would split settings, seat tokens and the service worker.
2. **Room URLs are `/room/<slug>`**, as in v1. Shared links and bookmarks keep working without a redirect.
3. **The server is the only writer of room state.** Clients send commands; one pure reducer on the server decides.
4. **A vote value leaves the server only after the reveal**, and before it only to the seat that cast it. This holds for every message, snapshot, log line, span and analytics event. One function builds each seat's view; nothing writes to a socket around it.
5. **A seat is proven by a server-minted secret**, scoped to one room. It is the only credential a participant has. The anonymous device id that v1 already keeps is carried on for counting only: it reaches Postgres as a keyed hash in `visitor_day`, is never stored with a room, a round or a vote, never sent to another seat and never used to authorise anything.
6. **Every server event carries the room's `seq`**; every command carries a client message id. Reconnect is "send my last `seq`, receive a snapshot".
7. **The protocol version is negotiated at connect.** Changes are additive; clients ignore unknown fields and event types. A breaking change raises the version and old clients are told to reload.
8. **Durable state and ephemeral events are separate classes.** Reactions and typing-like signals are never stored and never get a `seq`.
9. **The reducer is pure.** Time, randomness and ids come in through its context argument. Nothing in `packages/room-core` reads a clock, a socket or the network.
10. **Measurement sets no cookie and shows no banner.** Umami's cookieless script runs in the browser by the owner's ruling of 2026-11-19 and receives no identifier from us. Apart from the device id of invariant 5, nothing is stored on the device that the user did not ask for.
11. **Telemetry carries no vote value, display name or room slug.** A room appears as its numeric id; a seat as its index.
12. **One process owns a room at a time**, enforced by an epoch column in Postgres, not by routing.
13. **The topic is the unit of estimation.** A round is one attempt at a topic, and the agreed value belongs to the topic. Topics and rounds carry ids minted by the reducer (UUID v7), so an event is published before it is stored and can be referenced from outside.
14. **Access is decided when a seat is minted.** A room password is checked there, once; afterwards the seat secret is the credential. What outlives a session (the password, later webhooks and connectors) changes only with the room key, a second secret that is never a seat secret.
15. **One result contract.** A revealed round and a decided topic each have one JSON shape, defined in `packages/room-core`. History rows, exports, embed messages and later webhooks carry that shape and no other.

## Topology

![One origin, split at the edge: marketing on a Cloudflare Worker, the room app, API and WebSocket in one container on the VPS](diagrams/topology.svg)

| Path | Served by | Notes |
|-|-|-|
| `/`, `/guide`, `/analytics`, `/roadmap`, `/contact`, `/imprint`, new content pages | Cloudflare Worker with static assets (`apps/site`) | Astro static output, served as static assets. No Worker code runs in front of it. |
| `/room`, `/room/<slug>` | `apps/api` on the VPS | Returns the SPA shell. Hashed assets under `/_room/*`. |
| `/api/*` | `apps/api` | HTTP API, and the WebSocket at `/api/ws/<slug>`. |
| `/api/u/*` | Umami on the VPS, through Traefik | The tracker script and its collect endpoint on our own origin (`TRACKER_SCRIPT_NAME`, `COLLECT_API_ENDPOINT`), so the browser contacts no second host. |

The split is made at the Cloudflare edge: a Worker route on `/*`, and narrower routes with no Worker for `/room*`, `/_room/*` and `/api/*` that fall through to the tunnel and Traefik. This is proven on the beta host before anything depends on it (stage 3, row `v9-edge-routing` in `PLAN.md`); the fallback is the Worker proxying those paths with `fetch`, which also carries WebSocket upgrades. Until cutover the whole of v9 runs on `https://next.free-planning-poker.com` with `X-Robots-Tag: noindex`.

The API container serves the SPA it was built with, so client and server ship as one image and one version. The same image with a Postgres container is the self-hosting story and the system under test in E2E.

## Repo map

Eight modules. The dependency arrows only point down this table.

| Path | Package | Holds | May import |
|-|-|-|-|
| `apps/site` | `@fpp/site` | Astro marketing site, content collections, the landing demo island | `@fpp/table`, `@fpp/room-core`, `@fpp/telemetry` |
| `apps/room` | `@fpp/room` | Vite SPA: routes, room shell, settings, insights, PWA, embed mode | `@fpp/table`, `@fpp/room-client`, `@fpp/room-core`, `@fpp/telemetry` |
| `apps/api` | `@fpp/api` | Elysia HTTP API, WebSocket room server, Postgres access, jobs, static serving of the SPA | `@fpp/room-core`, `@fpp/telemetry` |
| `packages/table` | `@fpp/table` | The game surface as React components: seats, cards, reveal, results, motion, sound. Takes a room view and callbacks; knows no transport | `@fpp/room-core` (types) |
| `packages/room-client` | `@fpp/room-client` | Headless client: connection state machine, pending commands, resume, storage of seat tokens. No React, no DOM beyond `WebSocket` and storage ports | `@fpp/room-core` |
| `packages/room-core` | `@fpp/room-core` | Protocol schemas and types, the reducer, the per-seat projection, decks, the room runtime (handshake, seat tokens, resume, presence, limits) behind ports, and the deterministic simulator with bots (`@fpp/room-core/sim`) | nothing in the workspace |
| `packages/telemetry` | `@fpp/telemetry` | Attribute, event and metric names; the `recordError` and `recordEvent` facades for server and browser | nothing in the workspace |
| `e2e` | `@fpp/e2e` | Playwright suite and fixtures against the built image | none at runtime |

Database access lives in `apps/api/src/db` and is not a package: only the API touches Postgres. `@fpp/room-core` is the deep module of the system; every other module is an adapter around it.

## Stack

Versions as read on 2026-11-18; a row that installs one checks it with `agw web package` and pins it exactly.

| Concern | Choice | Version line |
|-|-|-|
| Runtime, package manager, unit test runner | Bun | 1.4.x, one exact pin for local, CI and image |
| HTTP and WebSocket server | Elysia 2 with Eden Treaty for the typed HTTP client | `2.0.0-rc.3` exact, by the owner's ruling of 2026-11-19: 1.4 takes security fixes only, and a later move would touch every route and hook. Of the official plugins only `@elysia/eden` and `@elysia/opentelemetry`, at their `rc` tags. See "Server" for how the release candidate is contained |
| Validation | Zod 4 for protocol frames in `packages/room-core`, Elysia's `t` (TypeBox 1.x) for HTTP routes. The SPA imports protocol types only and ships no validator | Zod 4.x |
| Database | PostgreSQL on the shared VPS instance, schema `fpp` | 18 |
| ORM and migrations | Drizzle | 0.45.x; the 1.0 line is a release candidate |
| Room app | React with the React Compiler, Vite, TanStack Router (file routes, client only) | React 19.3, Vite 8, Router 1.170 |
| Design system | basalt-ui, profile `app` in `apps/room`, profile `tokens` in `apps/site` | 3.x, see "basalt-ui" |
| Marketing site | Astro, static output, MDX content collections | 7.4 |
| PWA | vite-plugin-pwa, precache and update prompt only | 2.0 |
| Lint, format, types | oxlint, oxfmt and tsconfig from basalt-ui's presets once 3.x is installed; before that the same tools with the repo's own minimal config | as basalt pins |
| Component tests | Vitest browser mode in Chromium | 5.x |
| End to end | Playwright | 1.65 |
| Property tests | fast-check | 4.10 |
| Load | k6 with `k6/websockets` | 2.x |

Not used, with the reason in one clause: Preact (Base UI and Motion run on it only through an unofficial compat path); TanStack Start (the room app has no server rendering to do and the marketing site needs content tooling Astro has); TanStack DB, Zero, ElectricSQL, SpacetimeDB, Yjs (they replicate rows or documents to clients, which is the opposite of invariant 4, or bring a second store); Turborepo (the whole fast tier of a repo this size is planned under 60 s without a task graph; revisit when `budgets.fast` is breached); Valkey for room snapshots (Postgres already gives the compare-and-set invariant 12 needs); a Python analytics service (rollup tables in Postgres replace it); `@hyperdx/browser` (it persists a session and offers replay, see "Measurement").

### basalt-ui

basalt-ui 3.0.0 is not published on 2026-11-18 and its plan forbids installing an unpublished build. Stage 1 therefore builds everything that has no look: core, server, client, a plain HTML room, E2E, deploy. The first row of stage 2 installs basalt 3.x and starts only when npm serves it.

basalt covers the chrome: dialogs, sheets, menus, forms, toasts, the settings and insights screens, charts through `basalt-ui/charts`. The game surface in `packages/table` is bespoke: it positions seats and cards from room state, which basalt's `primitive-bypass` lint denies outside its geometry seam. The table prototype row establishes how `packages/table` passes basalt's lint (an app composite, or a seam basalt adds) and files a signal to basalt-ui if it needs a change there. Colours come from basalt tokens through a small set of game tokens (felt, card face, card back, glow); no colour literal appears in a component.

## Room model

A room has an id (bigint), a slug (2 to 30 characters of `a-z`, `0-9` and `-`; v1's 2 to 15 character names are valid slugs), a name, settings, an access mode, at most 30 players and at most 20 spectators. A player who finds the table full is offered a spectator seat.

| Term | Meaning |
|-|-|
| Seat | One participant in one room: index, display name, avatar seed, role, presence, and in the current round either no vote, a hidden vote or a revealed value |
| Role | `player`, `spectator`, plus the flags `facilitator` and `admin` |
| Presence | `active`, `away` (tab hidden for 30 s), `reconnecting` (socket lost, seat held), `gone` (120 s after the socket was lost; the seat leaves the table but its token stays valid until the room expires) |
| Topic | What is being estimated: a title, an optional link, an optional reference into a tracker (source, id, key, site), a place in the room's queue, a state (`queued`, `active`, `done`, `skipped`) and, once decided, the final value |
| Round | One attempt at the active topic: `voting` → `revealed`. A re-vote starts the topic's next round; the next topic starts its own first round. A room that never names a topic still has one, untitled, per estimate |
| Final value | The card the team settles on for a topic: a label and its number. A unanimous reveal sets it by itself; otherwise a player picks it from the result. It can be corrected for as long as the room is live |
| Deck | Data, not code: an id and ordered cards, each with a label and a number or none (`?`, break). T-shirt sizes map onto the Fibonacci numbers (XS 1, S 2, M 3, L 5, XL 8, XXL 13), so the results of every deck compare |
| Settings | deck, auto reveal, reveal countdown, facilitator lock, timer |
| Access | `open` or `password`. The password is stored as an argon2id hash and checked when a seat is minted |
| Room key | A secret minted with the room and shown to its creator once, as a link. Presenting it gives a seat the `admin` flag. Stored as a hash |

Rules the reducer enforces:

- A vote counts for the round id it names and is rejected for any other. It can change until the reveal and never after.
- A reveal needs one vote. Auto reveal fires when every `active` player has voted and waits out the countdown, which any player can cancel.
- With the facilitator lock off, every player may reveal, decide, move on, edit the queue, kick and change settings (v1's behaviour). With it on, only facilitators may. The seat that creates a room is its first facilitator and can pass the flag on.
- `decide` is accepted for a topic whose latest round is revealed. A unanimous reveal carries the decision in the same step.
- Moving on marks an undecided topic `done` without a value, or `skipped` if it never had a reveal. The queue holds at most 200 topics.

**Admin is not the same as running a round.** The `admin` flag comes only from the room key and gates what outlives a session: the password, deleting the room, and later webhooks and connectors. In a default room nothing changes against v1: everyone runs the round, and the creator additionally sees the access settings. A room imported from v1 has no key; the first seated player who asks for one in the room's settings gets it, and the room says who did. An embedding host can keep the key for its users.

**A lost seat is taken back by name.** A cleared browser loses the seat secret, and Safari empties an embedded frame's storage between launches. Joining with the name of a seat that is `reconnecting` or `gone` gets that seat's place back: its index and its name. It does not get the seat's hidden vote of the running round or its `facilitator` and `admin` flags, and it receives a new secret. The seat secret stays the only proof of who someone is (invariant 5); a name returns a place at the table and nothing that was private or privileged.

## Protocol

JSON text frames over one WebSocket at `/api/ws/<slug>`. Every frame is a JSON object, never a bare string or number, because Elysia parses JSON-shaped text before validation. The protocol version travels in `hello` and not in a subprotocol: Elysia 2 documents no subprotocol negotiation (`research/r15-elysia-2.md`). Maximum payload 16 KB; per-message deflate off; the server checks `Origin` before the upgrade.

| Direction | Frame | Fields |
|-|-|-|
| client → server | `hello` | `v`, `build`, `name`, `avatar`, `seatToken?`, `lastSeq?`, `password?`, `roomKey?`, `device?`, `embed?` |
| server → client | `welcome` | `v`, `build`, `seat`, `seatToken`, `seq`, `view` (the full projection for this seat) |
| client → server | `cmd` | `id` (client message id), `type`, `payload`, `traceparent?` |
| server → client | `ack` / `nack` | `id`, and for `nack` a reason from a fixed enum |
| server → client | `evt` | `seq`, `type`, `payload` |
| both | `fx` | ephemeral: reactions and the like; no `seq`, never stored, dropped for slow consumers |
| both | `ping` / `pong` | application heartbeat every 25 s, under the edge's idle timeout |

Commands: `vote`, `clearVote`, `reveal`, `cancelReveal`, `revote`, `decide`, `nextTopic`, `addTopics`, `updateTopic`, `moveTopic`, `removeTopic`, `setRole`, `setFacilitator`, `rename`, `setPresence`, `kick`, `leave`, `setSettings`, `renameRoom`. Access and the room key are not commands: hashing a password is I/O, so they change through the HTTP API and reach the room as an event. The server applies a command through the reducer, assigns the next `seq`, persists, and publishes one `evt` to the room topic. Every event is identical for all seats, so one publish serves the room: `voted` names the seat and never the value, and a seat reads its own hidden vote only from its own `welcome` view. A full `view` is sent only in `welcome`.

Close codes (application range):

| Code | Meaning | Client does |
|-|-|-|
| 4001 | protocol version not supported | prompt a reload |
| 4002 | server draining, room moves | reconnect after a uniform 0 to 2 s delay |
| 4003 | kicked | show the notice, do not reconnect |
| 4004 | room expired or seat token unknown | rejoin as a new seat |
| 4005 | password required or wrong | ask for the password, connect again with it |
| 4008 | rate limit exceeded | back off, reconnect |

Limits from the first version: a token bucket per connection (burst 10, refill 5 per second), one `fx` per 2 s per seat, joins limited per IP at the proxy, five password attempts per minute per address and room. A password check costs an argon2id hash of 64 MiB, so checks run one at a time per room. Reconnect backoff is full jitter, base 500 ms, cap 30 s. The client resends an unacknowledged `vote` with the same `id` after resume, and re-asserts its own vote when the `welcome` view of the same round lacks it (a snapshot can trail an acknowledgement by the debounce window); the reducer treats a repeated `id` as a no-op.

`docs/v9/protocol.md` is written by the row that builds `packages/room-core` and from then on is the exact reference; golden fixtures of every frame live beside the schemas, and the fixtures of the last released protocol version keep passing forever.

## Server

`apps/api` is built as ports and adapters, so the room logic runs unchanged against real and fake infrastructure.

| Port | Production adapter | Test adapter |
|-|-|-|
| Transport (accept, send, publish to room, close) | Elysia 2's `websocket()` plugin on Bun, one pub/sub topic per room | in-memory transport from `@fpp/room-core/sim` |
| Room store (claim, snapshot, release) | Postgres | in-memory map |
| History (topics, rounds, estimating days, rollups) | Postgres | in-memory |
| Clock, id source | system | seeded |
| Telemetry | OpenTelemetry | recorder |

**Elysia 2 is a release candidate**, pinned at `2.0.0-rc.3`. Its WebSocket path has open reports: outgoing schema validation inverted (#1933), `ws.query` undefined (#2017), the socket object not stable across callbacks (#1716). The room server therefore keys a connection by `ws.id`, validates outgoing frames in its own code, takes the slug from the path, and keeps every Elysia import in `apps/api/src/http` and `apps/api/src/ws`. The row that builds the transport runs the frame fixtures, the close codes and the drain test against Elysia's `.ws`. If they do not pass on the pinned version, the same port is implemented on Bun's native WebSocket handler and Elysia keeps the HTTP routes. A version bump reruns that suite before it merges; `latest` on npm is the 1.4 line and tags have moved before, so nothing installs by tag.

**Ownership and handoff.** A room is loaded on first join with `UPDATE room_snapshot SET epoch = epoch + 1, owner = $me … RETURNING`; every later snapshot write is conditional on that epoch. A write that updates no row means another process owns the room: this process closes that room's sockets with 4002 and forgets it. Snapshots are written debounced (250 ms) after each event and flushed on drain. RollHook starts the new container, waits for health, then sends the old one SIGTERM with a three-minute grace period, so two processes overlap on every deploy. On SIGTERM the old process answers `/api/health` with 503, stops claiming rooms, flushes snapshots, closes sockets with 4002 and exits when empty or after 20 s; clients reconnect, the new process claims the room, and `welcome` restores each seat. `server.stop` is always raced against a timeout.

![A round survives a deploy: drain, resume and epoch fencing between the old and the new API container](diagrams/handoff.svg)

**Expiry.** A room's live snapshot expires after 6 hours without an event (v1's rule). The room row, its slug, its settings and its open topics stay, so a room opened again starts from them; rounds are kept 12 months; a room unused for 12 months is deleted with its history and its slug is free again. A job in the API process sweeps hourly.

**Scale target.** One process, 500 concurrent rooms, 5,000 sockets, p99 command-to-fan-out under 100 ms on the VPS. Horizontal scale is out of scope and invariant 12 is what would make it possible later.

## Data model

Schema `fpp` in the shared Postgres, migrations by drizzle-kit, journal in the same schema.

![The v9 data model: room, topic, round and vote, and the two tables behind the numbers](diagrams/datamodel.svg)

| Table | Columns that matter | Purpose |
|-|-|-|
| `room` | `id`, `slug` unique, `name`, `settings` jsonb, `access`, `password_hash`, `access_epoch`, `room_key_hash`, `origin`, `created_at`, `last_active_at` | registry, slug reservation, and everything about a room that outlives a session |
| `room_snapshot` (UNLOGGED) | `room_id` pk, `state` jsonb, `seq`, `epoch`, `owner`, `updated_at`, `expires_at` | live state for restore and handoff; holds hidden votes and seat-token hashes, never read by anything but the owner process |
| `topic` | `id` (UUID v7), `room_id`, `position`, `title`, `url`, `source`, `external_id`, `external_key`, `external_site`, `state`, `final_label`, `final_value`, `decided_by`, `decided_at`, `created_at` | the queue and the agreed values. Unique on room, source, site and the tracker's id (its key where no id is known), so the same import can run twice |
| `round` | `id` (UUID v7), `room_id`, `topic_id`, `no` (per room), `attempt` (per topic), `deck` jsonb, `started_at`, `revealed_at`, `players`, `spectators`, `distribution` jsonb, `consensus`, `auto_reveal` | one row per reveal; source of insights and exports |
| `round_vote` | `round_id`, `seat` (index in the room), `label`, `value` | per-seat result for the room's own history; no name, no key that crosses rooms |
| `visitor_day` | `day`, `visitor` (keyed hash of the device id) | one row per device per day with a vote. Gives daily, weekly and monthly estimators, new against returning, and retention. Rows older than 13 months are deleted |
| `stat_daily` | `day`, `metric`, `dimension`, `value` | rollups behind the public statistics page, continuous with v1's history |

What the shape decides:

- **Topics are written through.** Queue changes, reveals and decisions are stored when they happen, one transaction per event. A backlog prepared on Friday is there on Monday although the live snapshot has expired: a cold room starts from `room` and its open topics.
- **A value is a label and a number.** `round_vote.value` and `topic.final_value` hold the card's number, null for `?` and break; the label is what was shown. Statistics use the number, screens the label, and a tracker gets whichever its field takes.
- **A tracker reference is complete from the first row:** the provider (`source`), the tracker's stable id, the display key (which changes when an issue moves) and the site or workspace. A pasted line such as "SHOP-123 Checkout redesign" fills the key; a tracker link also fills the provider and the site. The stable id arrives when a host, the topics route or a connector supplies it.
- **No participant names in history.** History names a seat by its index. Who sat there is live state and expires with it.
- **The device id never meets a room.** `visitor_day` holds a keyed hash and a date. The key is a server secret, so a copy of the database cannot be matched to a browser.
- **Not created yet:** `webhook`, `outbox` and `connector`. Their shape is in "Built for what comes next"; the rows that build those features create them.

There is no user table, no page-view table and no event table: visits are measured in Umami, product numbers come from the tables above.

**What comes over from v1.** The importer (stage 3) carries: every room, so each existing name keeps working (`origin = 'v1'`, no room key); one untitled `topic` and one `round` per v1 `votes` row, with what v1 recorded of it; the days on which each v1 user id voted, as `visitor_day` rows under the same hash a returning browser will produce; and daily aggregates of v1's traffic and event tables in `stat_daily`. v1's per-visitor rows with location and device are not imported. The final MariaDB dump is archived together with its Parquet export.

## HTTP API

Routes under `/api`, typed end to end with Eden.

| Route | Does | Proof |
|-|-|-|
| `POST /rooms` | creates a room, optional slug; returns the room key once | none |
| `GET /rooms/:slug` | exists and access mode; name, seat count and settings only for an open room | none |
| `PUT /rooms/:slug/access` | sets or removes the password; on request raises `access_epoch`, which voids every seat | room key |
| `POST /rooms/:slug/key` | mints the key of a room that has none | a seat of that room |
| `DELETE /rooms/:slug` | removes the room and its history | room key |
| `GET /rooms/:slug/topics`, `/summary` | history and results as JSON, CSV and Markdown | a seat of that room, or the room key |
| `GET /stats` | public rollups, cached | none |
| `POST /contact`, `POST /feedback` | email-gateway; factory door with v1's limits | none |
| `GET /health`, `GET /version` | liveness; the running build | none |

Seat secrets and the room key travel in the `Authorization` header. A key shared as a link sits in the URL fragment, which no server sees. Business errors are typed responses; nothing below a route throws for a user mistake.

## Client

`@fpp/room-client` exposes one object per room: `state` (a store with the seat's view, connection status and pending commands), `send(command)`, `dispose()`. Status is one of `connecting`, `locked` (the room wants a password), `live`, `reconnecting`, `draining`, `reload-required`, `kicked`, `gone`. It reconnects on `online` and on `visibilitychange`, shows `reconnecting` only after 3 s, and marks the own vote as pending until acknowledged; no other optimism exists.

![A seat's connection states and the close codes that move between them](diagrams/connection.svg)

Not drawn: close 4005 moves `connecting` to `locked`, and the password moves it back.

Storage keys, all under the prefix `fpp:v9:` with a schema version inside each value: `profile` (name, avatar seed), `prefs` (sound, calm mode, view, theme), `seat:<slug>` (seat token), `key:<slug>` (the room key, on a device that holds one), `recent` (rooms visited, each removable, dropped after six months without a visit), `device` (the device id), `stats` (the local-only personal record). On first run the client reads v1's keys `username`, `isPlaySound`, `isNotificationsEnabled`, `preferCardView`, `recentRoom` and `userId` once and writes them into the new shape. v1's `userId` becomes the device id, so the count of returning estimators continues across the cutover. localStorage stays the store: both apps share one origin, and nothing here is worth a cookie or IndexedDB.

**PWA.** The service worker is served from `/_room/sw.js` with `Service-Worker-Allowed: /room` and registered with scope `/room`, so marketing pages are never intercepted. It precaches the shell and assets and shows an update prompt; it queues nothing, because a vote sent after a reveal is wrong. Close code 4001 forces the update path.

**Embed.** `/room/<slug>?embed=1` renders without site chrome and speaks a versioned message protocol with its host over `postMessage`. The envelope is `{ fpp: 1, type, id, payload }`. The host's origin is checked on every message and named as `targetOrigin` on every reply; unknown types are ignored; no message carries a seat secret.

| Direction | Message | Carries |
|-|-|-|
| host → room | `init` | display name, theme, locale, and the room key if the host keeps it |
| host → room | `topics.set`, `topics.add` | titles, links and tracker references |
| room → host | `ready` | protocol version and capabilities |
| room → host | `round.revealed`, `topic.decided` | the result contract |
| room → host | `resize` | the height the room wants |

A host can therefore fill the queue and write the estimate back with its own permissions, and the room holds no tracker credential. The API sends `Content-Security-Policy: frame-ancestors` with an allowlist on the embed variant and `'none'` elsewhere. Browsers partition a frame's storage by the embedding site, and Safari empties it between launches, so an embedded seat is separate from a direct visit and can lose its secret. The reclaim rule in "Room model" covers that; the password prompt works inside the frame.

## Measurement

Three channels, each with one job.

| Question | Channel | How |
|-|-|-|
| Is the system healthy? | OpenTelemetry → ClickStack | `apps/api`: a span per command, metrics below, structured logs with trace ids. Service names `fpp-api`, `fpp-room` (browser), `fpp-site`, registered in the vps repo's `observability/services.yaml` in the same change that first emits them |
| What do people do? | Umami, with its own cookieless script | One script of about 4 kB on every page of the site and the room app, served with its collect endpoint under `/api/u/` on our origin. No cookie, no banner, no identifier from us |
| How do rooms behave? | Postgres | `topic`, `round`, `visitor_day` and `stat_daily` |

Server metrics: `fpp.ws.connections.active`, `fpp.room.active`, `fpp.room.seats` (histogram), `fpp.command.duration`, `fpp.fanout.duration`, `fpp.ws.closed` by code, `fpp.ws.resumed`, `fpp.deploy.handoff.duration`, `fpp.command.rejected` by reason. Labels are `build` and fixed enums only.

Browser telemetry is errors and connection state only: uncaught exceptions, rejected promises and the connection state changes of `@fpp/room-client`, sent as OTLP logs to `/api/otel` with a session id that lives in memory for one page load. No replay, no field web vitals; performance is held by lab budgets in CI.

**Umami.** Events are named in `@fpp/telemetry` and nowhere else, and sent with `umami.track` by the client that caused them: `landing_cta`, `room_created`, `room_joined` (seat bucket), `invite_copied`, `vote_cast` (first in room), `round_revealed` (votes bucket, consensus), `topic_decided` (how), `password_set`, `summary_exported`, `pwa_installed`, `embed_loaded`. For the person who creates a room, page views and events come from one browser session, so Umami's own funnel shows landing → room created → invite copied → first vote → first reveal without a join of ours. A person who joins by link enters at `room_joined`. Three rules keep it clean:

- A `before-send` hook rewrites room paths to `/room/:slug` and drops query strings, so no room name reaches Umami.
- Event data never holds a vote value, a display name or a slug. A test over the event registry checks it.
- The device id is not given to Umami as a distinct id. Returning estimators are counted in `visitor_day`; Umami keeps its session that rotates monthly.

The hop in front of Umami must hand it the visitor's address (`CLIENT_IP_HEADER`, `TRUSTED_PROXIES`), or every visitor with the same browser merges into one session. That is checked on the beta host before the event names are frozen.

**History.** Self-hosted Umami has no import, and sessions synthesised from v1's tables would not match live ones (`research/r16-umami-tracker-import.md`), so v1's traffic history is not pushed into Umami. The product numbers come over with the importer ("Data model") and the API counts on in the same tables; nothing else replaces the Python analytics service. Umami's own series starts early instead: its script goes onto v1 as soon as the concept is accepted (row `v9-umami-on-v1`) and continues under the same website id after the cutover.

**The ruling.** The owner ruled on 2026-11-19 that this runs without a consent banner. `research/r08-umami-privacy.md` holds the stricter reading German regulators publish, under which a script that reads screen size and language needs consent even without a cookie. The privacy page says in plain words what is measured. If the ruling ever changes, the script tag is the one thing to remove: no product number depends on Umami.

## Built for what comes next

Password protection and the final value ship with 9.0.0. Webhooks, tracker import and write-back come after it. What they need from the model is fixed now, so none of them migrates an existing table or breaks the protocol.

**The result contract** is one versioned shape for every way a result leaves the room:

```json
{
  "type": "topic.decided",
  "v": 1,
  "id": "<uuid v7, the same on every retry>",
  "at": "2026-11-19T10:12:03Z",
  "room": { "slug": "team-alpha", "name": "Team Alpha" },
  "topic": { "id": "<uuid>", "title": "Checkout redesign", "url": "<link>", "source": "jira", "externalId": "10042", "externalKey": "SHOP-123", "externalSite": "<site id>" },
  "round": { "no": 14, "attempt": 2, "deck": "fibonacci", "voters": 7, "consensus": false,
             "distribution": [{ "label": "5", "value": 5, "count": 6 }, { "label": "8", "value": 8, "count": 1 }] },
  "final": { "label": "5", "value": 5, "decidedBy": "agreed" }
}
```

`round.revealed` is the same without `final`. Neither carries a participant's name or one person's vote.

| Feature | Fixed now | Added by its own row |
|-|-|-|
| Room password (9.0.0) | invariant 14, `room.access`, `password_hash`, `access_epoch`, close code 4005, the room key | nothing |
| Final value (9.0.0) | invariant 13, `decide`, the `final_*` columns, the result contract | nothing |
| Embedding in Jira, Teams, Miro or a wiki | the embed messages, `frame-ancestors`, seat reclaim | one host shell per platform. For Jira that is a small Forge app that frames the room and writes story points with Forge's own token. Atlassian Connect ends support on 2027-01-31 and is not used. Whether Forge passes `postMessage` to a nested frame is a spike in that row |
| Webhooks with results | the result contract with a stable event id; the room key as the right to configure | tables `webhook` and `outbox`, a relay and three formatters; see below |
| Tickets from a tracker | the tracker reference on `topic`, the idempotent import, the paste parser | `POST /api/rooms/:slug/topics` with the room key, so any automation can fill a queue. OAuth connectors (Linear, GitHub, Azure DevOps, Jira) only when demand shows, in a table `connector` with encrypted tokens |
| Writing the estimate back | `topic.decided` with the tracker reference | the host shell, the user's own automation behind a webhook, or a connector |
| A wheel that picks someone, asynchronous rounds | chance and time are injected into the reducer | their commands and events, additive under invariant 7 |

Webhook delivery, when it is built:

- `webhook` holds an address and a secret, both encrypted, and a kind: `generic`, `slack` or `teams`, because Slack and Teams take their own message formats.
- `outbox` gets its row in the transaction that stores the result. A relay claims rows with `FOR UPDATE SKIP LOCKED` and a lease, so no transaction stays open across a request.
- Requests are signed per Standard Webhooks 1.0 and retried ten times over three days.
- Only https addresses are called; private addresses are refused and redirects are not followed.

The order after launch: webhooks first, because they reach every tracker at once and need no third-party credential; then the topics route; then the Forge shell. Linear has no embed surface and its directory does not list hobby projects, so Linear is served by the webhook and the topics route (`research/r17-integrations-embed-webhooks.md`).

## Testing

| Tier | Runs | Tool | Covers |
|-|-|-|-|
| Core | every `make check-fast` | `bun test`, fast-check | reducer rules, including topics, decisions and access; the projection property "no other seat's value before reveal" over generated command sequences; model-based sequences; frame fixtures, current and last released |
| Simulation | nightly, 10,000 seeds | `@fpp/room-core/sim` | whole rooms with bots over a transport that drops, delays, duplicates and disconnects; invariants checked after every step; a failing seed is printed and replayable |
| Server | `make check` | `bun test` with real sockets and real Postgres | handshake, resume, limits, close codes, epoch fencing, the two-process handoff with a kill mid-round |
| Component | `make check` from stage 2 | Vitest browser mode, axe | table states, hand, reveal, reduced motion, keyboard |
| End to end | CI on pull requests that touch v9 paths | Playwright against the built image plus Postgres | multi-user flows with one browser context per seat, container restart mid-round, phone viewport, axe on the main states, about 15 screenshots in a pinned container from stage 2 |
| Load | nightly and before the cutover | k6 | the scale target above, never against production |
| Budgets | CI | size-limit, Lighthouse CI | room entry JavaScript at most 180 kB gzip; landing page ships no JavaScript but the analytics script before the demo is opened; lab LCP at most 2.0 s on the landing page and the room shell |

The simulator is also the engine of the landing page's demo table and of the UI playground the owner reviews, so the three never drift apart.

## Checks, CI and deploy

- `make check-fast`: format check, lint, types and the core tier for v9 paths. Budget 60 s. This is what a lead runs before each push.
- `make check`: everything a pull request must pass, v1's existing gate included for as long as v1 exists. CI runs it on the pull request head on hosted runners (the repo is public); `project.yaml` declares `checks: { fast: make check-fast, full: make check, ci: true }`.
- CI is one workflow with lanes chosen by changed paths and one required gate job: a change under v9 paths does not build v1, and the reverse. The pipeline, its timings and the local loop are in `ENGINEERING.md`.
- v1 keeps deploying, but only when a v1 path changes. Today `deploy.yml` and the Vercel build run on every push to `master`, which restarts v1's server and interrupts rooms in progress; the foundation row gives both a path filter, so the many merges of this plan leave production alone.
- Every push to `master` that touches v9 paths builds the API image and rolls it out to the beta host through RollHook, and deploys `apps/site` with wrangler. `make verify` probes production and the beta host.
- Local development: `bun run dev:v9` starts site, room app and API against the mini's Postgres (database `fpp`, declared in dotfiles `config/postgres/cluster.yaml`). One host, `https://fpp-next.test`, splits paths the way production does: `/room*` and `/_room/*` to the Vite dev server on 7739, `/api/*` to the API on 7740, everything else to Astro on 7738. Agents never start dev servers.

## Cutover

One switch on a weekend, when no room is in use, by the owner's ruling of 2026-11-19. In order:

1. Announce a short maintenance window on v1 and stop its writes.
2. Run the importer against a fresh production dump. It has run once before on the beta host with a real dump.
3. Point the apex at the Worker and the tunnel.
4. Verify with `make verify` and one real round.

Live rooms are not carried over, because none is running; rooms, history and counts are. v1's server and its `*.vercel.app` deployment keep running for 14 days, so rollback is the DNS and route change in reverse. After 14 days without a rollback the v1 directories, containers and the MariaDB instance go, the last behind an owner gate because it deletes data. The runbook is `docs/v9/CUTOVER.md`, written in the launch stage.
