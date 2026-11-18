# Sync engines and multiplayer backends

Research run of 2026-11-18 (`agw research`, depth deep). Run status: ok. Citations grounded against fetched pages: 44/44. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line

- **Recommendation:** keep a hand-written, server-authoritative room server on Bun and Elysia. One server function builds a separate view of the room for each socket, so votes stay hidden until reveal. Presence and reconnect are written in the same server. At 2 to 30 people holding a few small values, the features that frameworks sell (offline use, multi-device sync, large datasets) do not apply, and each framework adds a runtime, lock-in and an upgrade path you do not need. On the client, start with plain React state; adopt TanStack DB only after its 1.0 final ships.
- **Runner-up:** Colyseus 0.18 (MIT). It is the only candidate that models a room, per-client hidden fields (StateView) and the room lifecycle directly. The cost is that it replaces your Elysia room server with a Node-centred framework, and I did not verify that it runs on Bun.
- **Ruled out for this product:** InstantDB (sunsetting; services end 31 Aug 2027). PartyServer (runs only on Cloudflare Workers and Durable Objects; the hosted PartyKit platform shut down on 23 Oct 2026). LiveStore (beta; its event log reaches every client, so hidden votes would leak). Yjs and Automerge (every replica holds the whole document). Jazz (2.0 is alpha, with ten alpha releases in about eight weeks, several with upgrade steps).
- **Strong but mismatched:** SpacetimeDB has the best hidden-state model of the rest, but it brings its own storage engine instead of Postgres and a source-available licence. Zero and ElectricSQL are Postgres-native but are built for persistent multi-user data; they need wal_level=logical and extra services, and I found no presence primitive in either.

## What the requirements force

Three problems decide the choice.

1. **Hidden votes.** Before reveal, no socket may receive another player's vote, not even inside a payload the UI hides. This needs one server-side rule that builds each viewer's copy of the room. Sync engines that replicate rows or events to every client cannot express this without a per-client filter.
2. **Presence.** Who is in the room, who has voted, who dropped. Presence is connection-level and short-lived, so it should not depend on a database write.
3. **Reconnect.** A phone that sleeps for a minute must rejoin the same seat and receive the current view. A server deploy must not lose a room in progress.

Scale (my own arithmetic, not sourced): a 30-seat view with a few hundred bytes per seat is roughly 5 to 10 KB, and a vote round produces about 30 such messages. A single Bun process on one VPS is far above that load. So live state can stay in memory, with Postgres holding snapshots rather than sitting on the hot path.

## Versions, licences and status

| Option | Version (as checked) | Licence | Stability | Self-hosting on one VPS |
|---|---|---|---|---|
| Hand-rolled Bun + Elysia | elysia 1.4.32 (npm) | Not checked | Yours to maintain | Yes; the current setup |
| SpacetimeDB | spacetimedb 2.15.0 (npm); docs say 2.0.0 | BSL 1.1, converting to AGPL v3 with a linking exception | Some features labelled beta; row-level security marked experimental | Yes: spacetime start or Docker; own storage, not Postgres |
| TanStack DB (alone or with a custom WebSocket collection) | @tanstack/db 1.0.0-rc.1.5 (npm); RC1 announced 29 Oct 2026 | Not checked | Release candidate; docs page still says beta | Client library; nothing to host |
| ElectricSQL | @electric-sql/client 1.5.28 (npm); Electric 1.0 GA 17 Mar 2025, 1.1 on 13 Aug 2025 | Apache-2.0 (secondary source only) | GA | Yes: sync service plus Postgres with wal_level=logical |
| Zero (Rocicorp) | @rocicorp/zero 1.12.0 (npm); docs use rocicorp/zero:1.12.0 | Apache-2.0 | Release date not checked | Yes: zero-cache plus Postgres plus your query and mutate API |
| PartyServer / PartyKit | partyserver 0.5.10 (npm) | Not checked | Hosted PartyKit shut down 23 Oct 2026 | No: Cloudflare Workers and Durable Objects only |
| Colyseus | colyseus 0.18.12 (npm); docs say 0.18 is out | MIT | Release date not checked | Yes: a Node process |
| Jazz | jazz-tools 2.0.0-alpha.67 (npm); alpha.66 on 17 Nov 2026 | MIT | Alpha | Yes: inside your own backend, SQLite on disk |
| LiveStore | @livestore/livestore 0.5.0 (GitHub release 15 Oct 2026) | Apache-2.0 | Beta per docs | You build or choose a sync backend; no hosted one |
| Yjs | yjs 13.6.33 (npm) | MIT | Library; no server authority | Any sync server you write |
| Automerge | Not checked | MIT (secondary source) | Not checked | As for Yjs |
| Convex, self-hosted | convex 1.51.0 (npm) | FSL-1.1-Apache-2.0 (converts to Apache-2.0 after two years) | Open-source backend; the docs say self-hosting is 'not for everyone' | Yes: backend and dashboard containers |
| InstantDB | @instantdb/core 1.0.67 (npm) | Apache-2.0 | Sunsetting: services until 31 Aug 2027 | Yes, but the product is being shut down |

## Behaviour against the requirements

| Option | Hidden information | Presence | Reconnect | Ops burden | Client bundle | Lock-in | Testability |
|---|---|---|---|---|---|---|---|
| Hand-rolled | Full control: one function builds each socket's view | You write it (connection set and heartbeats) | You write it (seat token and revision) | One process plus Postgres for snapshots | Only your code | None | Pure reducer tests plus socket tests; high |
| SpacetimeDB | Tables private by default; per-caller views | Not verified; event tables suit transient signals | Not verified | One server, plus a second store | Generated typed SDK; size not measured | High: module runtime, own DB, BSL | Unit-test harness runs module code without a server |
| TanStack DB alone | Whatever the server behind the collection sends | None (not a sync engine) | Your collection code | None (client library) | Not measured | Low | Framework-agnostic |
| TanStack DB with Electric | Electric shapes filtered by a proxy | None | Not verified | Electric plus Postgres logical replication | Not measured | Medium | Not verified |
| ElectricSQL | Proxy sets a where clause per shape | Not found in pages read | Not verified | Electric service plus logical replication; writes go through your API | Not measured | Low to medium | Not verified |
| Zero | Per-query context in your endpoints; no RLS | Not found in pages read | Not verified | zero-cache plus Postgres; SQLite replica needs disk IOPS | Not measured | Medium to high | Not verified |
| PartyServer | Your code, per connection | Connection-level | Not verified | A Cloudflare account, not your VPS | Not measured | High: Cloudflare | Not verified |
| Colyseus | StateView with .view() tags and per-client add | Not verified | Not verified | One Node process; state in memory | Not measured | Medium: Room and Schema model | Not verified |
| Jazz | Declarative permissions | Not verified | Not verified | Alpha; SQLite in your backend | Not measured | High while alpha | Not verified |
| LiveStore | Event log goes to every client: votes leak | Not found in pages read | Not verified | You run a sync backend | Not measured | Medium | Not verified |
| Yjs / Automerge | Every replica holds the document; needs an encryption design | Not verified | Not verified | A sync server you write | Not measured | Low | Not verified |
| Convex, self-hosted | Server functions (not verified in this run) | Not verified | Not verified | Backend and dashboard containers | Not measured | High | Not verified |
| InstantDB | Permissions | Presence in product | Not verified | Moot: sunsetting | Not measured | N/A | N/A |

I did not measure any client bundle size; the bundle-size search returned nothing usable. Every bundle cell is therefore open.

## Option notes

**Hand-rolled (Bun + Elysia).** This is what you already run. The hidden-vote rule lives in one place, and presence and reconnect are small, well-understood problems at 30 users. The cost is that you own the bugs in reconnection and deploy handoff. Mitigate them with a deterministic reducer, a test that proves the projection never leaks, and a reconnect test in CI.

**Colyseus 0.18 (runner-up).** Its docs state that by default the entire state is visible to all clients, and that StateView lets you tag fields with .view() and add instances per client. The docs also advise against relying on StateView for large datasets, which is not your case. Its licence file reads 'Copyright (c) 2015-2026 Endel Dreyer, MIT License'. Open: whether it runs on Bun, its reconnection and presence APIs, and its client bundle size.

**SpacetimeDB.** Its misconceptions page says tables are private by default, views expose exactly the rows each client should see (including per-caller views), event tables broadcast transient rows without storing them, and a unit-test harness runs module code without a server. Against that: Postgres is only a wire protocol for SQL reads, so the state would live in a second store; the licence is BSL 1.1; and several features are labelled beta. A secondary directory says a single production instance is allowed, which I did not check against the licence text. Choose it only if you would drop Postgres.

**TanStack DB.** The 1.0 RC1 post (29 Oct 2026) says the API is production-ready and stable; the docs page still shows a beta label. Its sources can be REST APIs or sync engines, so a custom WebSocket collection is the intended route. It does not enforce anything: hidden votes are safe only if the server never sends them. Its adapters include Neon Realtime and Convex. It is a good client layer, not a server.

**ElectricSQL.** Electric 1.0 went GA on 17 Mar 2025 and 1.1 brought a new storage engine. Its auth guide says the proxy should authorise shape requests and set a where clause. You could serve a votes shape only after reveal, but the reveal state would then be enforced in both the proxy and the UI. Writes still go through your API, and I found no presence feature.

**Zero.** Its auth page says Zero has no first-class RLS-style permission system and that you authenticate in your query and mutate endpoints. That fits hidden votes. But the self-host page requires zero-cache, a replication manager in multi-node setups, a Postgres instance with wal_level=logical, and disk for a SQLite replica. Litestream backups apply only in multi-node. It is built for persistent, offline-capable multi-user data, which this product does not need.

**PartyServer / PartyKit.** The model fits (rooms, connections, hibernation, per-connection sends). But the migration guide says PartyServer 'runs as a plain Cloudflare Worker with Durable Objects in your own Cloudflare account', and the hosted platform was shut down. It is not a VPS option.

**Jazz.** Its changelog calls alpha.60 (7 Nov 2026) 'the first step towards serverless and self-hosting', and the releases since then are alphas with upgrade notes. The licence is MIT. Too early for an unattended product.

**LiveStore.** Its docs say synced events are distributed to all connected clients. A vote event would therefore reach every browser before reveal. You could encrypt votes per round, but then you have built the hard part yourself. The project says it is in beta and has no hosted sync backend.

**Yjs and Automerge.** Both replicate the whole document to every client. Yjs is MIT per its docs. Presence through awareness is their strongest feature. Hidden votes cannot be enforced by a replica that holds them, so this is the wrong tool for hidden state.

**Convex, self-hosted.** The docs say the self-hosted backend contains the same code as the cloud service, under FSL-1.1-Apache-2.0. That licence forbids a competing hosted product and converts to Apache-2.0 after two years. Server functions can return per-user answers, but I did not verify that in this run. It means a second runtime beside Bun and high lock-in to the function model.

**InstantDB.** Its self-hosting page says 'Instant is sunsetting. Services will continue until August 31st, 2027.' The same banner appears on its product and docs pages. Excluded.

## Recommendation

Build the hand-rolled room server on Bun and Elysia, with these parts:

- **Room state as a pure reducer.** The reducer takes (state, command) and returns the next state, and each accepted change increments a room revision.
- **Viewer projection.** A function project(state, seat) returns only what that seat may see. Before reveal, other seats' votes are replaced with a has-voted flag. Every outgoing message passes through it. Add a test that serialises every message type before reveal and asserts no other seat's vote value appears.
- **Seat identity.** On join, the server issues a room-scoped token bound to a seat. Reconnect presents the token and the last revision; the server answers with the full current projection. At this size a full snapshot is simpler than diffs.
- **Presence.** Connections map to seats. A disconnect opens a grace window (30 seconds is a starting point, to be tuned on phones) before the seat shows as offline. Presence writes nothing to Postgres.
- **Persistence.** Snapshot each revision to Postgres (debounced) so that rolling deploys can rehydrate rooms, or accept losing rooms on deploy and say so in the UI. Expire inactive rooms and delete their snapshots, which fits the privacy-first brief.
- **Deploys.** Drain sockets, write snapshots, let the new process load them, and let clients reconnect with their token.
- **Client.** React state with one reconnect hook. Consider TanStack DB with a custom WebSocket collection once 1.0 is final.

The main tradeoff is that you own the bugs in reconnection and deploy handoff. Mitigate them with the reducer and projection tests above and a reconnect test in CI.

## Runner-up: Colyseus 0.18

Choose it if you want room lifecycle, per-client views and reconnection provided by the framework and you accept a Node-centred runtime in place of Bun. Before you commit, verify three things: that it runs on Bun, its reconnection and presence APIs, and its client bundle size. It is MIT-licensed, which removes the licence risk.

## What must be decided now, because it cannot be retrofitted

1. **The projection rule.** Only the server writes to sockets, and every message is a per-seat view. No debug or log payload may carry another seat's vote before reveal. Retrofitting means changing every message shape.
2. **Seat identity.** A client-generated id in localStorage works as a bearer token: anyone who copies it can read that person's vote before reveal. Decide now whether reconnect uses a server-issued room-scoped token; I recommend it, and the cost is that clearing localStorage loses your seat.
3. **Protocol versioning.** Put a version in the WebSocket handshake and a room revision in every message. The SPA is served from the same VPS, so cached old bundles will connect to new servers during rolling deploys.
4. **Room persistence policy.** Memory only, or Postgres snapshots; plus the TTL and deletion rules.
5. **Postgres scope.** Snapshots only, not the live path. Decide this before any table design.
6. **Single-node assumption.** Live state lives in one process. Horizontal scale would need sticky routing or a shared store. Write this down so no one adds Redis under pressure later.
7. **Round and reveal state machine.** Give each round an id so a late vote from the previous round cannot land in the current one.

## Main tradeoffs

- **Own the code versus adopt a framework.** Hand-rolled means you own reconnection and presence bugs; a framework means lock-in and a second runtime. At this scale the first is the smaller risk.
- **TanStack DB is not final.** The RC is recent and the docs still say beta, so the API may still move.
- **Colyseus means changing the server.** It is MIT and fits the model, but it would replace code you already run.
- **SpacetimeDB is the strongest model but not Postgres.** It would bring a second store and a BSL licence.
- **Zero and ElectricSQL solve a different problem.** They are for persistent, multi-user, offline-capable data. This product is ephemeral, so you pay their operational cost without needing their features.

## Not verified

Client bundle sizes for every option. Presence and reconnect APIs for Colyseus, Zero, Electric, SpacetimeDB, Convex and Jazz. Whether Colyseus runs on Bun. Release dates for Zero 1.12.0, Colyseus 0.18 and Convex 1.51.0. The licences of PartyServer, TanStack DB, Jazz (beyond the MIT file read), Elysia and Automerge's current version. Whether self-hosted Convex can use Postgres for storage. Electric's licence comes only from a secondary source. PartyServer is treated as Cloudflare-only because its docs describe only that deployment.

## Not verified in this run

- Client bundle sizes for all options: Bundlephobia search returned nothing usable; no size was measured.
- Presence and reconnect APIs for Colyseus, Zero, Electric, SpacetimeDB, Convex, Jazz: Not in the pages read in this run; marked not verified in the table.
- Whether Colyseus runs on Bun: The pages read describe StateView only; Bun compatibility was not checked.
- Release dates for Zero 1.12.0, Colyseus 0.18 and Convex 1.51.0: Registry pages gave versions without dates, and no release page was read.
- Licences of PartyServer, TanStack DB, Elysia, and the current version of Automerge: Not checked in this run.
- Whether self-hosted Convex can use Postgres for storage: The page read does not say which storage backends are supported.
- Electric licence: Only a secondary source was read; the primary repository licence was not fetched.
- Whether PartyServer can run outside Cloudflare: The docs describe only the Cloudflare deployment; treated as not self-hostable on a VPS.
- Whether the SpacetimeDB single-instance allowance matches the licence text: Secondary directory only; the BSL text was not read.

## Sources

- https://spacetimedb.com/docs/intro/misconceptions/
- https://spacetimedb.com/docs/intro/faq/
- https://spacetimedb.com/docs/how-to/rls/
- https://selfhost.directory/project/spacetimedb
- https://zero.rocicorp.dev/docs/self-host
- https://zero.rocicorp.dev/docs/open-source
- https://zero.rocicorp.dev/docs/auth
- https://tanstack.com/blog/tanstack-db-1.0-rc1-going-all-in-on-oracles
- https://tanstack.com/db/latest
- https://electric.ax/blog/2025/03/17/electricsql-1.0-released
- https://electric.ax/blog/2025/08/13/electricsql-v1.1-released.md
- https://hysenlabs.com/projects/electric-sql-electric
- https://electric.ax/docs/sync/guides/auth
- https://electric.ax/docs/sync/guides/shapes
- https://docs.colyseus.io/state/view
- https://github.com/colyseus/colyseus/blob/master/LICENSE
- https://docs.partykit.io/guides/migrate-to-partyserver/
- https://docs.partykit.io/guides/deploy-to-cloudflare/
- https://jazz.tools/docs/changelog
- https://github.com/garden-co/jazz/blob/main/LICENSE
- https://jazz.tools/docs/setup/deployment/own-server
- https://jazz.tools/blog/jazz-2-alpha-60
- https://github.com/livestorejs/livestore/blob/main/LICENSE
- https://github.com/livestorejs/livestore/releases/tag/v0.5.0
- https://docs.livestore.dev/llms-full.txt
- https://docs.livestore.dev/overview/introduction/
- https://docs.livestore.dev/building-with-livestore/syncing/
- https://docs.convex.dev/self-hosting
- https://github.com/convex/convex-backend/blob/main/LICENSE.md
- https://www.instantdb.com/docs/self-hosting
- https://www.instantdb.com/product/database
- https://github.com/instantdb/instant
- https://docs.yjs.dev/license
- https://www.npmjs.com/package/@tanstack/db
- https://www.npmjs.com/package/@electric-sql/client
- https://www.npmjs.com/package/@rocicorp/zero
- https://www.npmjs.com/package/partyserver
- https://www.npmjs.com/package/colyseus
- https://www.npmjs.com/package/jazz-tools
- https://www.npmjs.com/package/@livestore/livestore
- https://www.npmjs.com/package/convex
- https://www.npmjs.com/package/@instantdb/core
- https://www.npmjs.com/package/spacetimedb
- https://www.npmjs.com/package/yjs
- https://www.npmjs.com/package/elysia
