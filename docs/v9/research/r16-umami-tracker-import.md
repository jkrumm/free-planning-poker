# Umami browser tracker and importing history

Research run of 2026-11-19 (`agw research`, depth deep). Run status: ok. Citations grounded against fetched pages: 39/39. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line

- **Part A (browser tracker):** Umami 3.5.0 (published 12 Nov 2026, MIT) ships a small cookieless script. The docs publish no size. A third-party measurement from 3 Nov 2026 puts Umami's `script.js` at 3,913 bytes gzip -9, and 4,099 bytes as sent with brotli. It reads the page URL, title, referrer, screen, language and hostname. Visitors are identified server-side by a hash of website, IP, user agent, a salt that rotates monthly by default, and any distinct ID. Server-sent events join a browser session only when the distinct ID, IP and user agent all match. Otherwise they are linked in the visitor profile, not merged into one session.
- **Part B (backfill):** Self-hosted v3 has no import feature. The maintainer's answer is that you write a script. The supported route is `POST /api/send` or `/api/batch` with `payload.timestamp` in Unix seconds, which the code accepts. Writing straight into `session` and `website_event` is possible but unsupported, and it depends on an internal schema that has changed across releases.
- **Recommendation:** keep the three-year history in your own store (raw events in Parquet, which the existing FastAPI service already reads). Start Umami at the switch with a new website ID. If a pre-switch series must appear in Umami, backfill a bounded window into a separate website, and only after a dry run on a staging copy.

## Versions and maturity (as of 19 Nov 2026)

- Umami v3.0.0 was released 7 Nov 2025 and dropped MySQL, so v3 is PostgreSQL-only (discussion #3685). The latest release is v3.5.0, published 12 Nov 2026. Licence: MIT, 'Copyright (c) 2022 Umami Software, Inc.'
- v3.5.0 requires `APP_SECRET` and refuses to start without it. Source installs need Node.js 20.19+, with 22 LTS recommended (Getting updates page).
- Maturity: the v3 line has had a steady run of post-release regressions (section B lists them). Test every minor release on staging before upgrading production.
- Tracker script: Last-Modified 2 Nov 2026 according to the invisit measurement.
- ClickHouse: an optional event store via `CLICKHOUSE_URL`. One user reported it working on 3.2.0, but this is a community answer (#4537), not something the official docs describe.

## A. Browser tracker

### Script size and what it reads

- **Size.** The docs give none. invisit measured on 3 Nov 2026: `script.js` raw 8,575 B, gzip -9 3,913 B, brotli 11 3,533 B, sent 4,099 B (brotli), Cache-Control 4 hours. The optional `recorder.js` is 58,422 B raw (37,764 B brotli), and every visitor downloads it if you add the tag. A Pearpages article (Sept 2026, search snippet) says about 2.3 kB gzip as served by Umami Cloud. That does not reconcile with 3.9 kB, so re-measure before quoting either figure.
- **Reads (default properties).** Per the docs: hostname, language, referrer, screen (WxH), title, url, and the website ID. Auto-tracking also covers click tracking (`data-umami-event`) and path change detection.
- **Server side.** The IP comes from the request headers (or `payload.ip`). Country, region and city come from Cloudflare, Vercel, CloudFront or EdgeOne headers, or else from a GeoLite2 MMDB file. The user agent drives browser, OS and device. Bots are dropped unless `DISABLE_BOT_CHECK` is set.
- **No cookies** according to the docs. Caveat: the v3 tracker source path returned 404, so the no-storage claim rests on the docs alone.

### Script attributes (tracker-configuration docs)

- `data-host-url` (v2.0.0): send data to another host.
- `data-auto-track` (v2.0.0): `false` disables the tracker entirely.
- `data-auto-pageview` (v3.2.0): disables only automatic pageviews, keeping the rest.
- `data-domains` (v2.0.0): comma list matched against `location.hostname`. Watch www versus non-www.
- `data-tag` (v2.11.0): tag string (50-character column limit in the schema).
- `data-distinct-id` (v3.4.0): read once at load and sent with every request, including the first pageview. 50-character limit.
- `data-salt` and `data-salt-rotation` (hourly, daily, weekly, monthly; both v3.5.0): work only when the server sets `ENABLE_CLIENT_SALT`. They can split sessions but never merge them.
- `data-performance` (v3.1.0): Core Web Vitals.
- `data-errors`, `data-release`, `data-environment` (v3.5.0): error tracking.
- `data-exclude-search` (v2.11.0), `data-exclude-hash` (v2.16.0).
- `data-do-not-track` (v2.17.0): honours only the browser's DNT signal. The docs say it is not a consent solution.
- `data-before-send` (v2.18.0): a function on `window`, defined before the script loads. It receives `(type, payload)`. Return the payload to send, or a falsy value to cancel. It is also called for error events, with type `error`.
- `data-fetch-credentials` (v3.0.1): default `omit`. Use `include` if a proxy needs cookies.
- `window.umamiConfig` (v3.5.0): the same keys in camelCase. Data attributes take precedence.

### Server env vars and first-party serving

- `TRACKER_SCRIPT_NAME` (v1.26.0): renames the script, e.g. `x.js` or `/path/to/tracker`.
- `COLLECT_API_ENDPOINT` (v1.34.0): renames `/api/send`. The tracker follows automatically.
- `CLIENT_IP_HEADER` (v1.24.0): the header that carries the client IP.
- `TRUSTED_PROXIES` (v3.5.0): without it, Umami uses the leftmost `X-Forwarded-For` value, which a client can set. With it, Umami walks the header from the right and skips listed proxies.
- Also relevant: `APP_SECRET` (session IDs derive from it), `SALT_ROTATION` (default `month`; `day`, `week` and `month` aliases, and any other string gives a fixed salt; v3.5.0), `ENABLE_CLIENT_SALT`, `IGNORE_IP`, `DISABLE_BOT_CHECK`, and `BASE_PATH` (build time).
- **Serving under your own path.** The docs describe two methods. (1) Proxy: your domain serves the script and forwards `/api/send` with `X-Forwarded-For`, and you set `data-host-url` to your domain. They give an Express example and mention Next.js rewrites. (2) Rename with the two env vars. The docs call hosting a copy of the script less reliable. A third-party Cloudflare Worker proxy (doedja/umami-cloudflare-proxy, May 2026, search snippet) claims same-origin serving with edge caching. I did not read its code.
- **Engineering consequence.** The Worker or Traefik hop must pass the visitor's IP. If it forwards with its own IP and visitors share a user agent, many people merge into one session per month. This is inferred from the session hash in `collection-session.ts` and is untested.

### SPA route tracking

- The docs say auto-track includes path change detection. The SPA guide URL returned 404, and the tracker source was not readable, so the mechanism (for example, a History API hook) is not verified.
- The path goes into `url_path` (varchar 500). A room path such as `/room/<code>` would create one 'page' per room. Use `data-before-send` to rewrite the URL to `/room/:id`, and `data-exclude-search` so join tokens stay out of `url_query`.

### umami.track payload limits

- Event name: 50 characters (docs; `event_name` is varchar(50)).
- Event data (docs): numbers have a max precision of 4. Strings max 500. Arrays are converted to a string of max 500. Objects max 50 properties, with an array counting as one.
- The server (`request-schema.ts`) rejects nesting deeper than 32 levels, standalone numbers with absolute value at or above 1e15, and revenue at or above 1e14.
- Event names and tags are rejected if they start with `=`, `+`, `-`, `@`, a tab or a carriage return (a CSV-injection guard). So a name beginning with `-` fails.
- Timestamp override: docs say to add a Unix timestamp in seconds to the payload.
- Column limits: `url_path`, `referrer_path`, `referrer_query`, `url_query` and `page_title` are 500 characters; `hostname` is 100.
- I found no overall payload size cap in the pages I read.

### identify and session data without a distinct ID

- `umami.identify(data)` with no ID stores session data on the current anonymous session (`session_data`, unique on session plus key). No `session_link` row is written, so nothing links that session to another one.
- The anonymous session is a hash of website, IP, UA and the monthly salt. A visitor gets a new session each UTC month by default, so session properties do not follow them across months.
- `identify(id)` or `identify(id, data)` sets a distinct ID and writes a `session_link` row. A session can be claimed by only one identity (the claim is atomic in `collection-session.ts`).
- A distinct ID does not merge sessions. The profile view combines linked sessions and shows a 'Linked IDs' count.
- **Privacy.** An ID kept in localStorage is a persistent identifier that outlives the monthly salt. Sending it changes the 'cookieless' story. Decide this before wiring it.

### Funnels, journeys, retention, goals

- **Funnel (docs).** A window in minutes, with order enforced. Steps are a URL, an event name, or a trailing wildcard such as `/docs*`. The schema allows 2 to 8 steps.
- **Journey.** The schema allows 2 to 7 steps, with optional start and end steps. The journey docs page was not read.
- **Retention (docs).** One month and year per insight. The chart shows daily cohorts and Day-N return percentages. A three-year view therefore needs about 36 separate runs.
- **Goals.** The schema defines a goal as a path or event type with a value. The goals docs were not read.
- All four are computed from `website_event` and `session`. Whether retention keys on session or on distinct ID is not verified. With a monthly salt, a return visit in the next month links only if a distinct ID is set. Test this on a staging website before relying on it.

### Combining browser and server events (POST /api/send)

- `/api/send` needs no auth token but requires a valid User-Agent header (docs). `/api/batch` takes an array and forwards each item. The response reports failures by index.
- **Session identity for server events.** The session ID hashes website, IP, UA, salt and distinct ID. If `payload.ip` and `payload.userAgent` are absent, Umami uses the IP and UA of the incoming request (the Elysia server's own address or proxy header). All server events from one backend then collapse into one session per IP and UA.
- **How to join a browser session.** Use the same distinct ID in both places, and the same IP, UA and salt. Pass the visitor's IP and user agent in `payload.ip` and `payload.userAgent`, taken from the WebSocket handshake or request. Then the server event computes the same session ID.
- **Otherwise** the events join through the distinct ID link (the profile combines them), not in the same session row.
- **Open endpoint.** The server accepts `payload.ip` and `payload.userAgent` from any caller. Anyone who reads the website ID from your HTML can post events with any IP. Plan rate limits, or keep server-side events off the public endpoint.
- The Node client `@umami/node` exists. I did not check whether it sets the IP.

## B. Backfill from a custom store

### Is there an import feature in self-hosted v3?

- **Umami Cloud:** the official import is for the Pro plan and is run by the Umami team, from self-hosted PostgreSQL exports or CSV. It runs in one direction only, into Cloud.
- **Self-hosted:** no import feature. The maintainer (29 Jan 2025) wrote: 'You'll have to write a script to parse the CSV data and insert it into your database. There is no automatic tool for doing it.' (discussion #2199, open since Aug 2023).
- **Community tool:** RoversX/umami-csv-import-script, written for Cloud exports into the v2-era schema. A duplicate-`session_id` bug was reported and fixed in March 2025 (discussion #2381).
- The server-side docs list 'Importing historical data: backfill events from another analytics platform' as a use case.

### Does POST /api/send accept a past timestamp?

- **Yes.** `payload.timestamp` in Unix seconds sets `createdAt = timestamp * 1000` (`route.ts`). The schema accepts 0 to 2,147,483,647, which is 1970 to 2038.
- **Historical flag.** A past timestamp skips the 30-minute visit reset. The visit ID is then built from the hour of the historical timestamp.
- **Session creation.** Without a cache token and without ClickHouse, each item calls `createSession` with the historical `createdAt`. I did not read the `createSession` SQL, so duplicate handling is unknown.
- **Silent drops.** A bot-like UA returns HTTP 200 with `{'beep':'boop'}` and writes nothing, unless `DISABLE_BOT_CHECK` is set. Counts taken from responses can mislead.
- **No idempotency.** The payload has no event-level ID. Re-running a load writes duplicates unless you delete the window first.
- **Country.** The payload schema has no country field. Country comes from headers, or from GeoIP on `payload.ip`. Set `session.country` by SQL afterwards, or accept none.
- **Referrer, UTM and click IDs.** Parsed from `payload.referrer` and the query string of `url`. Self-referrals are dropped.
- **Throughput.** Not documented. Measure it on staging.

### The v3 Postgres schema for a direct SQL backfill

From the Prisma model on master (fetched 19 Nov 2026). The model is not the migration history, so check the migrations for the deployed version.

- Datasource: PostgreSQL with `relationMode = 'prisma'`, so Prisma emulates relations. Check the migrations for DB-level foreign keys.
- **session:** `session_id` uuid PK; `website_id` uuid; `browser` varchar(20); `os` varchar(20); `device` varchar(20); `screen` varchar(11); `language` varchar(35); `country` char(2); `region` varchar(20); `city` varchar(50); `distinct_id` varchar(50); `created_at` timestamptz(6) default now().
- **session_link:** PK (`website_id`, `distinct_id`, `session_id`); `created_at`.
- **website_event:** `event_id` uuid PK; `website_id`, `session_id`, `visit_id` uuid; `created_at` timestamptz(6) default now; `url_path` varchar(500) required; `url_query` varchar(500); `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` varchar(255); `referrer_path`, `referrer_query`, `referrer_domain` varchar(500); `page_title` varchar(500); `gclid`, `fbclid`, `msclkid`, `ttclid`, `li_fat_id`, `twclid` varchar(255); `event_type` int default 1; `event_name` varchar(50); `tag` varchar(50); `hostname` varchar(100); `lcp`, `inp`, `fcp`, `ttfb` numeric(10,1); `cls` numeric(10,4). There are 14 secondary indexes, so every insert pays for all of them. The event row has no country, region or city.
- **event_data:** `event_data_id`, `website_id`, `website_event_id`; `data_key` varchar(500); `string_value` varchar(500); `number_value` decimal(19,4); `date_value` timestamptz(6); `data_type` int; `created_at`.
- **session_data:** `session_data_id`, `website_id`, `session_id`; `data_key` varchar(500); `string_value`, `number_value`, `date_value`; `data_type` int; `distinct_id` varchar(50); `created_at`; unique on (`session_id`, `data_key`).
- `website.reset_at` exists. Check its effect before reusing a website ID.
- The integer codes for `event_type` and `data_type` live in constants files I did not read.

### Synthesising sessions and visitor IDs

- **Umami's own IDs.** `session_id` is UUIDv5 of a hash over website, IP, UA, salt and distinct ID, keyed with `APP_SECRET`. `visit_id` is UUIDv5 over the session and the hour. Reproducing them needs the IP and UA you do not have, plus `APP_SECRET`. Not worth it.
- **A practical scheme.** `session_id` = UUIDv5 over (website_id, visitor_id, UTC month), to mirror the default monthly session. Start a new visit after a gap of more than 30 minutes. `visit_id` = UUIDv5 over (session, UTC hour). Store the visitor ID, HMAC-hashed if you prefer, in `session.distinct_id` (50 characters max) and in `session_link`, so the profile links months together.
- Load events oldest-first, so the first insert sets `session.created_at` if the code keeps the first row. This is unverified.
- Use UUIDv7 for event IDs (`USE_UUIDV7`), which keeps them time-ordered.
- Sessions per visitor per month will then match live data only if the live visitor identity also matches. Live sessions key on IP and UA, so the counts will not line up at the switch.

### Reports of backfills and what broke on upgrade

- I found no public account of a direct-SQL backfill surviving several v3 upgrades.
- **#4537 (Sep 2026, v3.2.0).** A user with millions of `website_event` rows saw dashboard queries time out at 45 to 300 seconds. They copied the data to ClickHouse with a custom Python script and validated the row counts (about 100% match). They then set `CLICKHOUSE_URL` while `DATABASE_URL` stayed on Postgres. Writes made between export and cutover had to be re-synced.
- **#1926 (2023, older 2.x era).** A 19-million-row `website_event` table took over two minutes to load the first dashboard screen.
- **#3685 (Nov 2025).** A pgloader MySQL-to-Postgres migration created tables in a non-public schema. Login worked after manual fixes, but events were missing and UUID errors followed. Another user saw `check-db` fail on Postgres 18. The suggested workaround was the Postgres 15 compose default.
- **#3685 comments (Nov 2025).** Reports of a unique-visitor drop after 2.19 to 3.0, and CPU at 100% after login. Neither was answered in the thread.
- **Release-page snippets (not read in full).** Geo country showing 'Unknown' (#3701); first and last seen broken since 3.0.1 (#3775); event-data raw query failure (#3732); PostgreSQL 12/13 syntax errors in Journeys (#3970).
- **#4176 (Apr 2026, v3.1.0).** Raw SQL failed with 'column reference created_at is ambiguous' and 'invalid reference to FROM-clause entry for table session' in the Replays and Performance views, on Postgres 15. Fixed in a commit that closed the issue on 24 Jun 2026.
- **#4352 (Jun 2026, v3.2).** Local login broke for usernames that were not lowercase.
- **#4459 (Aug 2026, v3.2 to v3.3).** Prisma P1000 despite valid credentials (search snippet only).
- **#4526 (Sep 2026).** The session-activity query ran for minutes and used about two CPU cores (search snippet only).
- **Docker tags** dropped the `v` prefix from v3 (discussion #3685 comment, Nov 2025).
- **v3.5.0.** `APP_SECRET` is required and the `DATABASE_URL` fallback is gone. Changing `APP_SECRET` resets logins and counts visitors as new sessions. Run `ANALYZE` after major upgrades.

## Recommendation

### Option 1: backfill about three years into Umami

Benefits: one continuous series and one interface.

Risks:
- No import tooling and no idempotency, so every re-run needs a delete-and-reload of the window.
- Synthesised sessions will not match live sessions (live keys on IP and UA), so session and visitor counts will jump at the switch.
- Country is lost unless you write it by SQL. Bot-like traffic is dropped silently.
- Scale: roughly one write per event into a table with 14 secondary indexes. Reported dashboards slow at a few million rows, and the #4537 user needed ClickHouse.
- Upgrade fragility: direct SQL binds to tables and columns that changed across the 3.x releases above.
- Contention: an import on the same VPS as the live WebSocket server competes for CPU and disk.
- Privacy: importing visitor IDs as distinct IDs creates persistent identifiers that did not exist in Umami before.

### Option 2: keep history in your own store; Umami starts at the switch

Benefits: no new identifiers, no import risk, and exact definitions kept in your own store. The FastAPI service over Parquet already exists to query it.

Risks:
- A visible break in the series at the switch. Year-over-year and pre/post comparisons must be made outside Umami.
- Two definitions of 'session' and 'visitor' (your own versus Umami's monthly-salted sessions). Each needs documenting.
- Umami cannot run funnels, journeys or retention across the switch.
- Daily rollups alone cannot rebuild sequences for funnels and journeys, so keep the raw events in Parquet as well.

### Recommendation

Choose **Option 2**: keep the history in your own store (raw events in Parquet, plus rollups), and start Umami with a fresh website ID at the switch. My suggestion, not from a source: run both trackers for two to four weeks to measure the gap between the two definitions. If a pre-switch series is genuinely needed in Umami, backfill only a bounded window (for example the last 90 days) into a separate website. Do it only after a dry run on a staging copy with a reconciliation against the rollups.

## Decide now (these cannot be retrofitted cleanly)

1. **`APP_SECRET`.** Set it and back it up with the database. Changing it later resets sessions and visitor counts.
2. **Persistent identifiers.** Decide whether the localStorage client ID is ever sent as `data-distinct-id` or `identify`. Once it is, every session linked to it stays linked. Prefer a hashed or rotated ID, and get a legal view on whether a localStorage ID needs consent.
3. **Event taxonomy.** Names at most 50 characters, no leading `-`, `=`, `+` or `@`. Strings at most 500. Decide now which properties exist. Keep vote values, names and room codes out of event data.
4. **URL policy.** Normalise room paths with `data-before-send` before the first release, and exclude query strings that carry join tokens.
5. **First-party topology.** Choose the script and collect paths, the proxy (Cloudflare Worker or Traefik), `TRUSTED_PROXIES` and `CLIENT_IP_HEADER`. The proxy must forward the visitor's IP. Script URLs are cached (4 hours on the Umami script), so changing the path later leaves old clients on the old one.
6. **Website IDs.** One website per environment and per product surface, with `data-domains` set. Decide whether marketing pages and the app share a website. Cross-domain linking needs distinct IDs.
7. **Server-side path.** Decide now how the Elysia server sends events. It must send `payload.ip` and `payload.userAgent`, and the public `/api/send` must be rate-limited or kept private.
8. **Cut-over date and website ID.** These define the series. Decide them with the backfill question, not after.
9. **Postgres version.** Pick a supported version and test the Prisma 7 stack in use (client versions 7.6.0 and 7.8.0 appear in user logs). PG 12/13 broke Journeys (#3970).

## Main tradeoffs

- **Cookieless versus continuity.** The monthly salt gives privacy and a fresh identity each month. Continuity then needs a distinct ID, which is itself a persistent identifier. You cannot have both without a decision.
- **Umami's dashboards versus your own store.** Umami gives one UI but a schema you do not control and a Postgres-only core that slows at scale. Your own store gives control, at the cost of building the reports.
- **Import fidelity versus effort.** A backfill that reproduces live session semantics needs data you may not have (IP, UA, geo). Without it, the history is approximate.
- **Scale.** Three years of raw events in one Postgres table with 14 indexes is the main performance risk. ClickHouse is an option, but it is community-documented, not official.

## Open items and what I could not verify

- Umami's official script size (not published) and the gap between 2.3 kB and 3.9 kB gzip.
- The tracker source (404), so SPA mechanics, the storage claim and event-type constants are unverified.
- The `createSession` SQL and its duplicate handling in batch backfills.
- Whether retention keys on session or distinct ID, and what happens across a monthly salt boundary.
- The Node client's IP handling, and the Cloudflare Worker proxy's code.
- Journey, goal and error-tracking docs (only the schema was checked for limits).
- Several release-page and issue items (#3701, #3775, #3732, #3970, #4459, #4526) are from search snippets only.
- The `website.reset_at` effect and the migration-level foreign-key question.
- Legal classification of a localStorage ID under GDPR and ePrivacy: not researched; needs review.

## Not verified

- Umami v3 tracker source: SPA mechanics, whether it uses storage, event-type constants: Returned 404 (source moved). SPA guide URL https://docs.umami.is/docs/guides/track-a-single-page-application also returned 404. Only docs support the 'no cookies' and path-change claims.
- Official published script size: The docs give no size. The 3.9 kB (invisit, Nov 2026) and 2.3 kB (Pearpages) figures conflict and were not reconciled.
- createSession duplicate handling for many events from one visitor in a batch: Not read; the route calls createSession per item without a cache token. Behaviour under repeated IDs in a backfill is unknown; needs a staging test.
- Whether retention and funnels key on session ID or distinct ID across the monthly salt boundary: Retention docs do not say; the query code was not read. Test on a staging website.
- Journey and goal definitions and limits beyond the schema: Journey and goals docs pages were not read; limits come from the Zod schema only.
- Node client @umami/node and whether it sets the visitor IP: Client source was not read; the docs show raw HTTP examples only.
- Cloudflare Worker proxy implementation and CF-Connecting-IP handling: Only a search snippet was seen. The Cloudflare header behaviour is not verified in this run.
- Release-note items (#3701, #3775, #3732, #3970, #4459, #4526): Known only from search snippets; the issue pages were not read in full.
- Migration-level foreign keys and the website.reset_at effect: The Prisma model says relationMode 'prisma' and was read, but migrations were not. Whether DB-level foreign keys exist and how reset_at affects queries is unverified.
- Historic revenue rows and the populate-revenue-table migration: Only a model-written lead was seen in web_ask; no source was read, so not cited.
- Published account of a direct-SQL backfill surviving several v3 upgrades: None found in the searches. The absence is not proof that none exists.
- Legal classification of a localStorage client ID under GDPR and ePrivacy: Not researched in this run. This is a planning question for legal review, not a sourced claim.
- Cloud-proxy and throughput numbers for a 3-year backfill: No throughput figures are documented. The write cost depends on the store's volume and must be measured on staging.

## Sources

- https://docs.umami.is/docs/tracker-configuration
- https://docs.umami.is/docs/tracker-functions
- https://docs.umami.is/docs/track-events
- https://docs.umami.is/docs/distinct-ids
- https://docs.umami.is/docs/api/sending-stats
- https://docs.umami.is/docs/environment-variables
- https://docs.umami.is/docs/bypass-ad-blockers
- https://docs.umami.is/docs/cloud/import-data
- https://docs.umami.is/docs/guides/send-server-side-events
- https://docs.umami.is/docs/guides/migrate-mysql-postgresql
- https://docs.umami.is/docs/updates
- https://docs.umami.is/docs/funnel
- https://docs.umami.is/docs/retention
- https://raw.githubusercontent.com/umami-software/umami/master/src/app/api/send/route.ts
- https://raw.githubusercontent.com/umami-software/umami/master/src/app/api/send/request-schema.ts
- https://raw.githubusercontent.com/umami-software/umami/master/src/lib/collection-session.ts
- https://raw.githubusercontent.com/umami-software/umami/master/src/lib/crypto.ts
- https://raw.githubusercontent.com/umami-software/umami/master/src/lib/schema.ts
- https://raw.githubusercontent.com/umami-software/umami/master/src/lib/detect.ts
- https://raw.githubusercontent.com/umami-software/umami/master/prisma/schema.prisma
- https://raw.githubusercontent.com/umami-software/umami/master/LICENSE
- https://github.com/umami-software/umami/discussions/3685
- https://github.com/umami-software/umami/issues/4176
- https://github.com/umami-software/umami/discussions/2199
- https://github.com/umami-software/umami/discussions/2381
- https://github.com/umami-software/umami/discussions/4537
- https://github.com/umami-software/umami/discussions/1926
- https://invisit.dev/blog/analytics-script-size
- https://pearpages.com/blog/2026/09/08/umami-explained-what-the-open-source-analytics-tool-does-and-what-it-doesnt
- https://github.com/doedja/umami-cloudflare-proxy
- https://github.com/umami-software/umami/releases
- https://github.com/umami-software/umami/releases?after=v1.14.0&page=2
- https://github.com/umami-software/umami/issues/4352
- https://github.com/umami-software/umami/issues/4459
- https://github.com/umami-software/umami/issues/4526
- https://github.com/umami-software/umami/releases/tag/v3.5.0
- https://umami.is/docs/tracker-configuration
