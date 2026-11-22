# plan-site: the rows of stage 3 corrected from what was built

Row `v9-plan-site`, 2026-11-22. Only merged code and `master` at f067cad were read: the pull requests of v9-db-schema (#342), v9-site-scaffold (#343), v9-site-legal (#345), v9-site-crawl (#348), v9-room-client (#355), v9-api-ws (#356), v9-table-arena (#358), v9-api-telemetry (#359) and v9-api-persistence (#361), plus v9-foundation (#337) and v9-room-core (#344) where a file began there. Line numbers are those of `master` at f067cad.

No row, seat, checkpoint, lane or `after` edge was added, removed or changed. `docs/v9/PLAN.md` section Stage 3 is unchanged: no row's title, and so no draft line, changed.

## Facts as built

| Area | Built fact | Source |
|-|-|-|
| Schema | `room`, `room_slug` (kind `number` or `name`, `is_primary`, `release_at`), `room_snapshot`, `topic`, `round`, `round_vote`, `visitor_day`, `stat_daily` in schema `fpp` | apps/api/src/db/schema.ts |
| `stat_daily` | primary key (day, metric, dimension); dimension `''` when none; `value` double precision; `upsertDailyStat` writes one value | schema.ts:192, db/visitors.ts:51 |
| `round` | `deck`, `distribution`, `consensus` NOT NULL; `deck` stores `{id}`; `distribution` is the result contract's own | schema.ts:149-155, db/history.ts:111 |
| Device hash | `hashVisitor({key, deviceId})`, HMAC-SHA256, 16 bytes; key `VISITOR_KEY` (at least 32 characters) | db/visitors.ts:15, env.ts:19 |
| Holds | `NUMBER_HOLD` '3 months', `NAME_HOLD` '6 months', `VISITOR_DAY_RETENTION` '13 months', in `db/holds.ts` | holds.ts:2-3 |
| Routes | `POST /api/rooms`, `GET /api/rooms/:slug`, `PUT /api/rooms/:slug/access`, `PUT /api/rooms/:slug/name`; seat proof `Authorization: Bearer <token>` read by `bearer()`; errors `{error: '<code>'}`: 400, 403 `not_seated` or `not_player`, 404 `unknown_room`, 409, 503; no 401; Eden type `App` exported as `@fpp/api/app` | http/rooms.ts:95,127-205, http/app.ts:32, package.json:7 |
| Edge | client address from the header `CLIENT_IP_HEADER` names, origins from `ALLOWED_ORIGINS` | env.ts:12,30,47, ws/edge.ts:122 |
| Jobs | `expiryJob`, hourly, forked in `app/compose.ts` | jobs/expiry.ts:36, compose.ts:51 |
| Telemetry | `UMAMI` registry and `track` built; `landing_cta` has `location` only | telemetry/src/umami.ts:20, facade.browser.ts:10 |
| Site collections | `pillar`, `guides`, `glossary`, `vs`, `blog`, `docs` in `src/content.config.ts`; sections list in `src/lib/sections.ts` | content.config.ts, sections.ts:1 |
| Site draft rule | `FPP_SITE_TARGET` (`beta`, else production), `visibleEntries` in `src/lib/drafts.ts`, collection entries only | lib/target.ts, lib/drafts.ts:6 |
| Site scripts | `apps/site/test/script-allowlist.ts`, enforced by `scripts.site.test.ts`; page budget `budget.site.test.ts` caps each .html file at 12 kB gzip | test/script-allowlist.ts:6, budget.site.test.ts:6 |
| Site strings | navigation and footer text in `src/strings.en.ts`; sitemap is `/sitemap-index.xml` | strings.en.ts:1, lib/robots.ts:41 |

## Edits to docs/plan.yaml

### v9-api-read

- Old: Each round and each decided topic is built by packages/room-core's builders for poker.revealed and topic.decided, never by hand.
- New: Each round and each decided topic takes the shape of packages/room-core's result contract, built by buildRevealedResult and buildDecidedResult (packages/room-core/src/result.ts, exported from @fpp/room-core/server), never by hand. The stored history is the builders' own output: round.distribution is the contract's distribution (apps/api/src/db/history.ts) and round.deck holds only {id}, so serve the stored distribution instead of rebuilding it from round_vote, and a custom deck's cards are not recoverable.
- Source: #344 packages/room-core/src/result.ts:76,97; #344 packages/room-core/src/server.entry.ts:10; #361 apps/api/src/db/history.ts:111; #342 apps/api/src/db/schema.ts:149,154

- Old: consistent with what v9-importer stores; record.
- New: consistent with what v9-importer stores; record. round.deck, round.distribution and round.consensus are NOT NULL columns of apps/api/src/db/schema.ts today.
- Source: #342 apps/api/src/db/schema.ts:149,154,155

- Old: apps/api/src/http (the two routes and their serializers, Eden types exported), apps/api/src/db (read queries as plain functions beside v9-db-schema's repositories), apps/api/test.
- New: apps/api/src/http (the two routes beside roomRoutes in rooms.ts and their serializers; Eden's App type is already exported as @fpp/api/app from src/http/app.ts, so the routes join createApp behind a port that apps/api/src/app implements, as RoomsApi is), apps/api/src/db (read queries as plain functions beside the repositories: listTopics in rounds.ts already returns a room's topics with their rounds and per-seat votes), apps/api/test.
- Source: #342 apps/api/src/db/rounds.ts:62; #337 apps/api/src/http/app.ts:13,32,28; #337 apps/api/package.json:7; #361 apps/api/src/http/rooms.ts:37,100

- Old: Without it a typed 401; another room's seat, a kicked seat, or a seat voided by a raised access_epoch a typed 403.
- New: As the PUT routes built it (apps/api/src/http/rooms.ts): bearer() reads Authorization: Bearer <token>; a missing, malformed, other room's or voided token answers 403 {error: 'not_seated'}, a seat that is not a player 403 {error: 'not_player'} (decide whether a spectator may read, and record), an unknown slug 404 {error: 'unknown_room'}, a malformed slug 400 {error: 'invalid_slug'}. No route answers 401.
- Source: #361 apps/api/src/http/rooms.ts:35,63,65,95,127; #361 apps/api/src/app/rooms.ts:126

- Old: A test: no header gives a typed 401; another room's seat and a voided seat a typed 403.
- New: A test: no header, another room's seat and a voided seat give a typed 403 not_seated; an unknown slug gives a typed 404 unknown_room.
- Source: #361 apps/api/src/http/rooms.ts:35,65,95 (no 401 status in the file)

### v9-api-contact

- Old: the client key from the first X-Forwarded-For hop;
- New: the client key from the first X-Forwarded-For hop, which v9 does not trust: it reads the one header that CLIENT_IP_HEADER names, set by the edge (env.clientIpHeader in apps/api/src/env.ts, clientIp() in apps/api/src/ws/edge.ts), and the peer address without it;
- Source: #356 apps/api/src/env.ts:12,68; #356 apps/api/src/ws/edge.ts:122

- Old: check the Origin header against that origin instead of answering CORS, and record the rule for local hosts.
- New: check the Origin header against that origin instead of answering CORS: ALLOWED_ORIGINS (env.origins in apps/api/src/env.ts) is the allowlist the socket already checks, with the development hosts as its default; record the rule for local hosts.
- Source: #337 apps/api/src/env.ts:6,30,47

- Old: 4. Business errors are typed: 400 per field, 429 with retry-after, 503 when off, 502 when the upstream fails.
- New: 4. Business errors are typed, as the room routes type them ({error: '<code>'} bodies from the Err helper in apps/api/src/http/rooms.ts): 400 per field, 429 with retry-after, 503 when off, 502 when the upstream fails. The site's form reads only the status (answerFor in apps/site/src/lib/contact.ts: 2xx sent, 400 or 422 invalid, 429 busy, anything else unavailable).
- Source: #361 apps/api/src/http/rooms.ts:63; #345 apps/site/src/lib/contact.ts:19

- Old: apps/api/src/app (their configuration), apps/api/.env.tpl
- New: apps/api/src/env.ts (the new variables, parsed once with the others) and apps/api/src/app (their wiring), apps/api/.env.tpl
- Source: #337 apps/api/src/env.ts:42; #356 apps/api/src/app/compose.ts:51

### v9-stats-rollups

- Old: Days are UTC dates.
- New: Days are UTC dates (utcDay in apps/api/src/db/visitors.ts). stat_daily is keyed by (day, metric, dimension), dimension is '' for a metric without one, value is a double precision, and upsertDailyStat in the same file writes one value (apps/api/src/db/schema.ts).
- Source: #342 apps/api/src/db/visitors.ts:9,51; #342 apps/api/src/db/schema.ts:192

- Old: apps/api/src/jobs (the rollup job, Effect)
- New: apps/api/src/jobs (the rollup job, Effect, beside expiry.ts, whose expiryJob compose.ts forks at start)
- Source: #361 apps/api/src/jobs/expiry.ts:36; #356 apps/api/src/app/compose.ts:51

### v9-importer

- Old: plus the hold of the constants file of v9-api-persistence (three months for a number, six for a name), imported from that file, never copied.
- New: plus the hold constants of apps/api/src/db/holds.ts (NUMBER_HOLD, three months, and NAME_HOLD, six: SQL interval strings), imported from that file, never copied.
- Source: #342 apps/api/src/db/holds.ts:2,3

- Old: A v1 name that breaks v9's rule (3 to 30 of a-z, 0-9 and the hyphen, at least one letter)
- New: A v1 name that breaks v9's rule (3 to 30 of a-z, 0-9 and the hyphen, at least one letter: parseName in apps/api/src/app/rooms.ts over parseSlug of @fpp/room-core/types)
- Source: #361 apps/api/src/app/rooms.ts:35

- Old: no distribution and no round_vote rows.
- New: no distribution and no round_vote rows. round.deck, round.distribution and round.consensus are NOT NULL columns (apps/api/src/db/schema.ts): settle with v9-api-read what an imported round stores in them (an empty distribution with consensus derived from lowest equal to highest, or an expand migration that makes them nullable, rule migrations.md) and record.
- Source: #342 apps/api/src/db/schema.ts:149,154,155

- Old: hashed by the API's own function (HMAC-SHA256 with the server secret, 16 bytes), imported, never re-implemented,
- New: hashed by hashVisitor in apps/api/src/db/visitors.ts (HMAC-SHA256 under the server secret VISITOR_KEY, 16 bytes) and written as recordEstimatingDay does, imported, never re-implemented,
- Source: #342 apps/api/src/db/visitors.ts:15,24; #337 apps/api/src/env.ts:19,60

### v9-site-stats

- Old: apps/site/src/pages/analytics (replacing the scaffold's placeholder)
- New: apps/site/src/pages/analytics.astro (replacing the scaffold's placeholder; the site builds one file per page, not a directory)
- Source: #343 apps/site/src/pages/analytics.astro:1; apps/site/AGENTS.md, Facts, URLs

### v9-site-data

- Old: Dataset data (name, description, temporal coverage, creator, licence, the figures file as its distribution) and Article; draft: true.
- New: Dataset data (name, description, temporal coverage, creator, licence, the figures file as its distribution) and Article; draft: true. Today only a collection entry has a draft flag (visibleEntries in apps/site/src/lib/drafts.ts, read through sectionEntries in src/lib/entries.ts), and src/lib/sitemap.ts keeps any path it has no entry for, so a page file under src/pages has no draft: make /data an entry of a collection (src/lib/sections.ts, src/content.config.ts) or gate the page on target (src/lib/target.ts) and keep it out of the sitemap; decide and record.
- Source: #343 apps/site/src/lib/drafts.ts:6; #348 apps/site/src/lib/sitemap.ts:31; #348 apps/site/src/lib/sections.ts:1

### v9-site-landing

- Old: landing_cta through the track facade of @fpp/telemetry, with the way in (start, join or back) as its one property;
- New: landing_cta through track from @fpp/telemetry/browser; the registry (packages/telemetry/src/umami.ts) gives landing_cta one property, location (hero, header or footer), and no way in, so add a closed way property (start, join or back) to that entry in this pull request, registry first;
- Source: #359 packages/telemetry/src/umami.ts:20

- Old: the top three of localStorage fpp:v9:recent (address, display name, creation time, the code of a locked room, pinned; a schema version inside the value), in the order the room's own list uses,
- New: the top three of localStorage fpp:v9:recent (the value is {v: 1, rooms: [{slug, name, createdAt, code, pinned, visitedAt}]}, written by createLocalStore in packages/room-client/src/storage.ts), in the order its recent.list() uses (pinned first, then the latest visit),
- Source: #355 packages/room-client/src/storage.ts:15,45,186

### v9-umami-events

- Old: packages/telemetry (the browser event registry and the track facade), apps/site (the script in the base layout, its allowlist entry)
- New: packages/telemetry (the registry in src/umami.ts and the track facade in src/facade.browser.ts, both built), apps/site (the script in src/layouts/base.astro, its entry in test/script-allowlist.ts)
- Source: #359 packages/telemetry/src/umami.ts:19; #359 packages/telemetry/src/facade.browser.ts:10; #343 apps/site/test/script-allowlist.ts:6

- Old: Decide the bucket edges and record them. If the track facade is not there yet, add track(name, data), typed by the registry, which calls window.umami.track when it exists and does nothing otherwise.
- New: The registry and the facade are built: UMAMI in packages/telemetry/src/umami.ts, COUNT_BUCKETS (1, 2-4, 5-9, 10+) with bucketOf as the bucket edges, and track(event, data) in src/facade.browser.ts (imported as @fpp/telemetry/umami and @fpp/telemetry/browser), which calls window.umami.track when it exists and does nothing otherwise. Check the registry against section Measurement and add what is missing, registry first (packages/telemetry/AGENTS.md); the edges stand unless a reason is recorded.
- Source: #359 packages/telemetry/src/umami.ts:12,45; #359 packages/telemetry/src/facade.browser.ts:10

- Old: 4. The registry test: every property is a closed enum or a boolean, so a free string fails it.
- New: 4. The registry test exists (packages/telemetry/test/umami.test.ts: every property is a closed list or a boolean, so a free string fails it); the content test below is new.
- Source: #359 packages/telemetry/test/umami.test.ts:51

- Old: 5. The site's script allowlist grows by exactly
- New: 5. The site's script allowlist (apps/site/test/script-allowlist.ts) grows by exactly
- Source: #343 apps/site/test/script-allowlist.ts:6

### v9-site-look

- Old: apps/site/src/config (the donation constant)
- New: apps/site/src/lib/site.ts (the donation constant, beside siteOrigin)
- Source: #348 apps/site/src/lib/site.ts:2

- Old: an empty constant hides the link.
- New: an empty constant hides the link. The footer carries v1's PayPal link today as a string in footerLegal of apps/site/src/strings.en.ts: it moves into the constant, and the nav, footerPages and footerLegal lists there are what the header and footer extend.
- Source: #343 apps/site/src/strings.en.ts:26,32,39,43

- Old: The room keeps the theme in prefs under fpp:v9: on the same origin
- New: The room keeps the theme in prefs under fpp:v9 (key fpp:v9:prefs, field theme: system, light or dark; packages/room-client/src/storage.ts): on the same origin
- Source: #355 packages/room-client/src/storage.ts:15,31

- Old: come from the site's content file or the message catalogue, never a literal in a component (invariant 18).
- New: come from apps/site/src/strings.en.ts (navigation and footer text) or the message catalogue, never a literal in a component (invariant 18).
- Source: #343 apps/site/src/strings.en.ts:1

- Old: a test sums the executable scripts of each built page, islands excluded. Each script the profile adds goes on the allowlist with its reason.
- New: a test sums the executable scripts of each built page, islands excluded (apps/site/test/budget.site.test.ts today caps each built .html file at 12 kB gzip: extend it or add a test beside it). Each script the profile adds goes on apps/site/test/script-allowlist.ts with its reason; scripts.site.test.ts fails on any other.
- Source: #343 apps/site/test/budget.site.test.ts:6; apps/site/AGENTS.md, Facts, Zero JavaScript

### v9-site-landing-i18n

- Old: the hreflang part of the base layout, the sitemap settings, tests.
- New: the hreflang part of the base layout (apps/site/src/layouts/base.astro, which has none today), the sitemap settings (apps/site/src/lib/sitemap.ts, apps/site/astro.config.ts), tests.
- Source: #343 apps/site/astro.config.ts:26; #348 apps/site/src/lib/sitemap.ts:31

- Old: decide how a page declares it and record.
- New: decide how a page declares it and record. Today only a collection entry has a draft flag (visibleEntries in apps/site/src/lib/drafts.ts), and src/lib/sitemap.ts keeps any path it has no entry for, so a draft page is dropped from the production sitemap by hand.
- Source: #343 apps/site/src/lib/drafts.ts:6; #348 apps/site/src/lib/sitemap.ts:31

### v9-site-parity

- Old: robots.txt, the sitemap and llms.txt are served.
- New: robots.txt, the sitemap (/sitemap-index.xml, the address robots.txt names) and llms.txt are served.
- Source: #348 apps/site/src/lib/robots.ts:41

### v9-readme

- Old: (make arena-score ENTRY=table writes the split reveal at 9 and at 30 seats under arena/scores/table/)
- New: (make arena-score ENTRY=<name> writes the split reveal at 9 and at 30 seats under arena/scores/<name>/, not committed; arena/entries holds only reference until the owner's entries arrive, docs/v9/ARENA.md)
- Source: #358 Makefile:77; #358 docs/v9/ARENA.md:45; arena/entries holds only reference

### v9-selfhost

- Old: Read the settings from apps/api's own environment schema on the day.
- New: Read the settings from apps/api/src/env.ts (parseEnv) on the day: DATABASE_URL and VISITOR_KEY (at least 32 characters, the key behind visitor_day's hash) are required, and ALLOWED_ORIGINS defaults to the development hosts, so a self-hosted file sets it to its own origin or the room socket refuses every browser.
- Source: #337 apps/api/src/env.ts:6,19,30,42

### v9-edge-routing

- Old: Then make indexnow if v9-site-crawl has shipped (it does nothing on beta).
- New: Then make indexnow (v9-site-crawl shipped it: apps/site/scripts/indexnow.ts, which skips a beta build; DRY_RUN=1 lists the URLs).
- Source: #348 Makefile:114; #348 apps/site/scripts/indexnow.ts:22

- Old: HTML handling that serves v1's paths as the scaffold chose;
- New: HTML handling that serves v1's paths as the scaffold chose (build.format file writes guide.html, which static assets serve at /guide with no redirect; apps/site/AGENTS.md, URLs);
- Source: #343 apps/site/AGENTS.md, Facts, URLs

## Rows checked, no change

Rows with no Issue yet and nothing to change: `v9-umami-proxy`, `v9-vps-observability` (every metric name it lists exists in packages/telemetry/src/names.ts) and `v9-site-docs` (the `docs` section and its collection exist). `v9-budgets` is stage 4 and was not read for edits.

Rows that gain a script or an island (`v9-site-stats`, `v9-site-landing`, `v9-site-docs`) are not given an allowlist line where they are silent about it: a missing line is not a fact that stopped holding, and `scripts.site.test.ts` names the file when it fails.

## Open Issues

No stage 3 row other than this one has an Issue that is open (`factory project plan free-planning-poker`), so no note was put on an Issue.
