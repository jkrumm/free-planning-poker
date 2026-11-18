# Umami and consent law

Research run of 2026-11-18 (`agw research`, depth deep). Run status: ok. Citations grounded against fetched pages: 30/31. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line

- **Umami:** v3.5.0 is the current release (GitHub, 12 Nov 2026). It is self-hostable on PostgreSQL and covers everything in the brief: custom events with properties, funnels, journeys, retention, goals, property filters, UTM, links, pixels, a server-side send API, SPA path tracking and a first-party proxy option. The structural limit for a room tool: Umami is cookieless and session-based. Cross-person funnels and true return visits need a Distinct ID, and a Distinct ID is personal data that needs consent.
- **Germany, no banner:** Umami's script is probably not banner-free. The BfDI says Matomo needs consent even when configured for data minimisation, and that its reasoning carries over to similar services. Umami's script reads screen, language, referrer and title in the browser, which is a device access under §25(1) TDDDG. What can run without a banner: storage the user explicitly asked for, and measurement that never touches the device (server-side events, and analysis of server logs used only for that), under GDPR with a documented legitimate-interest assessment and purpose limitation.
- **France (CNIL):** the audience-measurement exemption is narrow: anonymous statistics only, no cross-site identifiers, no vendor reuse, cookies of at most 13 months, retention of at most 25 months. A self-hosted Umami without Distinct IDs could fit it. I found no CNIL self-assessment for Umami, and the German position is stricter.
- **Session replay:** consent. The CNIL draft recommendation says replay is not strictly necessary and needs consent, with no exemption. Reports say the final recommendation was adopted in October 2026; I could not read the final text.
- **Umami Distinct ID:** consent. It links visits across time, so it fails the CNIL anonymity condition and is personal data under GDPR.
- **Error telemetry and RUM:** full RUM with persistent IDs or device attributes needs consent. Error-only telemetry with no storage, no device attributes, a first-party endpoint and short retention is a defensible grey zone without a banner. No DSK text I read settles it.
- **Legal change ahead:** the Council's Digital Omnibus mandate (21 Oct 2026) would add consent-free cases, including audience measurement. Parliament has not voted; entry into force is not expected before 2027.

## 1. Umami as of November 2026

**Version and maturity.** The latest GitHub release is v3.5.0, published 12 Nov 2026. The 3.x line: v3.3.0 (12 Aug 2026), v3.3.1 (20 Aug), v3.4.0 (17 Sep), v3.4.1 (23 Oct, a security hotfix upgrading Next.js to 16.4.2 and React to 19.3.1), v3.5.0 (12 Nov). That is roughly monthly, and several releases were security-driven. v3.5.0 requires an explicit APP_SECRET (the fallback to DATABASE_URL was removed), Node.js 20.19 or later (22 LTS recommended), and includes the PostgreSQL migration 27_add_error_tracking. Plan upgrades as routine maintenance. The licence was not verified in this run.

**Self-hosting on Postgres.** DATABASE_URL is the only required environment variable. DATABASE_TYPE='postgresql' is needed for Docker builds. DIRECT_DATABASE_URL is used for Prisma migrations when DATABASE_URL points at a pooler. The v3.4.0 notes cover fixes and API test coverage for both PostgreSQL and ClickHouse, so ClickHouse is a supported alternative analytics backend. The installation requirements page was not retrievable, so minimum Postgres versions and sizing are unverified.

**Custom events and properties.** Call umami.track(name) or umami.track(name, data). Limits on event data: numbers keep a maximum precision of 4; strings are capped at 500 characters; arrays are stringified and capped at 500; objects hold at most 50 properties. A Unix timestamp in seconds can override the event time. Event names are free text with no schema registry, so renaming splits a series.

**Funnels.** Each funnel has a window in minutes between consecutive steps and at least two steps. Steps are a Viewed page or a Triggered event. URL wildcards work only at the end of a value (/docs*). Steps must occur in order, but other pages may occur between them.

**Journeys.** Three to seven steps, with optional start and end steps. The report shows the most common paths and drop-offs.

**Retention.** A daily cohort grid for one chosen month. Rows are first-visit days; columns are Day 1, Day 2 and so on; a cell is the share of that cohort returning. Since v3.5.0 shading is relative to the highest visible value. Retention depends on visitor identity, so without a Distinct ID it measures only what the cookieless session model links.

**Goals.** One action, either a viewed page or a triggered event, and its conversion rate across users in the date range. There is no multi-step goal.

**Segments and cohorts.** v3.3.0 added session and event property filters; v3.4.0 added saved session-property filters in segments. The Filtering page returned 404, so the segment definition is unverified. The cohort view in the docs I read is the Retention grid; I found no separate cohort object.

**Sessions and Distinct IDs.** Umami does not use cookies. Each device or browser gets its own session, identified by IP address, user agent and website ID. Setting a Distinct ID does not merge sessions; it links them to the ID, and the profile combines linked sessions. Set it at load with the data-distinct-id attribute, which sends it on the first request, or later with umami.identify(id, data). An ID is limited to 50 characters and is visible in page HTML. The docs warn that users sharing an IP and browser (office, school, VPN) are otherwise merged. Versions differ between pages: the Distinct IDs page says 'available since v2.18.0', while the tracker configuration page dates data-distinct-id to v3.4.0 and identify() to v2.13.0.

**Session salt.** SALT_ROTATION defaults to 'month' (UTC). Day, week and fixed-value options arrived in v3.5.0, and ENABLE_CLIENT_SALT lets the tracker add a salt, which can only split sessions further. When the salt rotates a returning visitor gets a new session ID. So linkage across rotation periods is limited by design. This setting is a legal and metric decision, not only an operational one.

**UTM, links and pixels.** A UTM report exists. Links (v3.0.0) are short redirects of the form /q/<id> that record clicks and can append utm_source, utm_medium, utm_campaign, utm_term and utm_content to the destination. Pixels (v3.0.0) are tiny invisible images for HTML email and pages without JavaScript; loading the image records a visit.

**HTTP send API for server-side events.** The collection endpoint is POST /api/send. The payload requires website and accepts hostname, language, referrer, screen, title, url, name, data, session and id (the Distinct ID), with type 'event' or 'identify'. The @umami/node client wraps this as send(payload, 'event' or 'identify'). A server-side send is attributed to the sender's IP and user agent unless you forward the visitor's. The docs' proxy example sets X-Forwarded-For and User-Agent from the incoming request; with several proxies, TRUSTED_PROXIES (v3.5.0) controls which addresses are trusted. This is an inference from the example, not a stated rule.

**SPA route tracking.** By default the tracker initialises pageview tracking, click tracking and path-change detection. To send pageviews yourself, set data-auto-pageview='false' and call umami.track(). data-auto-track='false' disables initialisation entirely.

**First-party proxying.** Proxy the script and /api/send through your own domain (Nginx and Apache tutorials; Next.js rewrites). Alternatively self-host and rename with TRACKER_SCRIPT_NAME and COLLECT_API_ENDPOINT, or point the tracker at your domain with data-host-url. Proxying defeats blocklists; it does not change the legal status. A first-party script that reads the device is still under §25 TDDDG.

**Replays and error tracking.** Replays (v3.1.0) need a second script, recorder.js, with the same website ID. Defaults: sample rate 0.15, mask level 'moderate' (inputs masked; 'strict' masks all text), maximum 5 minutes, stored 30 days, only sessions starting after enabling. Error tracking (v3.5.0) uses data-errors to capture uncaught exceptions and unhandled rejections, and umami.captureException() for caught ones. Errors go to the same collection endpoint and link to the session and any replay.

**Limits.** Event data: see above. Distinct ID: 50 characters. Replay: sample 0.15 by default, 5-minute maximum, 30-day storage. Error tracking: 20 errors per minute per page; 120 requests per minute per website (ERRORS_PER_MINUTE, default 120, range 1 to 100000); message 2,000 characters; stack trace 16,000; 20 tags; payload 48,000 bytes; release 100 characters; environment 50 characters; page URLs stored without query or hash. Funnel: at least two steps. Journey: three to seven steps. Goal: one step.

## 2. Event taxonomy and activation funnel for a room tool

**Principles.** (1) No personal or secret data in events: no names, no vote values, no room codes in paths or query strings. (2) Buckets, not raw counts, for participant numbers. (3) Room lifecycle events come from the authoritative server, where no browser device data is needed. (4) Umami's script runs only where the legal analysis allows it (Germany: after consent).

**Proposed events.**

| Event | Source | Properties (all buckets or booleans) | Stage |
|---|---|---|---|
| landing_cta_click | Umami script (consent-gated) | location: hero, footer, pricing | Landing |
| room_created | server | none | Create room |
| invite_link_copied | Umami script (consent-gated) | none | Invite |
| room_joined | server | participant_no: 2, 3-5, 6+ | Invite (second person) |
| vote_cast | server | first_in_room: true or false | First vote |
| reveal_triggered | server | first_in_room; votes_bucket: 1-2, 3-5, 6-10, 11+ | First reveal |
| round_started | server | round_no: 1, 2-3, 4+ | Repeat use (return proxy) |
| room_expired | server | reason: idle, closed | Retention |

**Funnels in Umami.** Umami funnels are per session, and a server event is not attached to the creator's browser session unless you pass a session ID. So do not build one cross-channel funnel in Umami. Two funnels are realistic. (a) In Umami, a creator-path funnel of client steps: '/' viewed, then /room* viewed, then invite_link_copied, with a window of around 60 minutes. (b) In the room server's telemetry store (OpenTelemetry into ClickStack, or a small first-party sink), a per-room funnel: room_created, then room_joined with at least two participants, then vote_cast with first_in_room, then reveal_triggered with first_in_room, with timings. This is the only place where the second participant's activation is visible.

**Return visit.** Umami Retention needs a Distinct ID, so it needs consent. Without consent, use round_started and room re-use as a proxy, and do not try to recognise people across visits. Under the default monthly salt, Umami's own linkage ends at each month boundary anyway.

**URL hygiene.** Umami stores the page URL by default. A path such as /room/<code> stores the room code on every pageview. Use data-before-send to normalise room paths to /room/:id (the handler can also drop payloads), data-exclude-search, and data-exclude-hash. If the join secret must travel in the URL, put it in the fragment: fragments are not sent to servers and data-exclude-hash keeps them out of Umami. This is a standard HTTP property, not something the Umami docs state.

## 3. German and EU law

**Framework.**
- §25(1) TDDDG: storing information in the end device, or accessing information already stored there, requires consent given on the basis of clear and comprehensive information under the GDPR. §25(2) has two exceptions: (1) transmitting a message over a public network; (2) access that is strictly necessary for the provider to deliver a digital service the user has explicitly asked for.
- DSK Orientierungshilfe 'Digitale Dienste', Version 1.2, Stand November 2024. It replaces the 2021 OH Telemedien (v1.1, 2022). Positions I read in the text: web storage (localStorage, sessionStorage) counts as storage (Rz. 21); JavaScript that reads device properties and sends them to a server is access, and browser fingerprinting is covered (Rz. 23-24); §25 applies whether or not personal data is involved (Rz. 26-28); consent must be given before access (Rz. 36); a browser that accepts storage is not consent, and neither are scrolling or pre-ticked boxes (Rz. 44-45). The guidance has a section on Art. 6(1)(f) GDPR (overriding legitimate interests) at page 29. A search snippet of the reach-measurement passage reads that a reach measurement under §25(2) No. 2 is generally not allowed without consent, but the exact wording could not be read, so treat it as unverified.
- BfDI page on Matomo: 'Matomo ... dessen Einsatz auf digitalen Diensten im Ergebnis aber dennoch grundsätzlich einer Einwilligung der Nutzenden bedarf' (its use on digital services generally requires consent, even if configured for data minimisation). The page says that using analytics tools is not strictly necessary to display the site, and that the conclusions 'sind analog auch auf andere gleichartige Dienste übertragbar' (apply by analogy to other similar services). Its route without device access: if only data necessarily produced by the request is analysed (server logs), the TDDDG is not engaged. Using those logs for reach measurement is a change of purpose under Art. 6(4) GDPR and §23 BDSG, needs its own legal basis, and must be deleted once the purpose is served.
- CNIL, 4 July 2025, 'Cookies: solutions pour les outils de mesure d'audience'. The exemption from consent under Art. 82 of the French Data Protection Act applies only if the tracker (a) serves a purpose strictly limited to audience measurement (performance, detecting navigation problems, technical optimisation, server sizing, analysis of content viewed), for the publisher alone, and (b) produces anonymous statistics only. It must not (c) lead to cross-matching with other processing or pass non-anonymous data to third parties, nor (d) enable global tracking across sites or apps; a shared identifier across sites for reach is excluded. Recommended: inform users; cookie life of 13 months, not automatically extended; retention of at most 25 months; periodic review. Vendors that reuse data for their own purposes are outside the exemption. Watch for transfers outside the EU. Providers may use the CNIL self-assessment tool but may not call their product 'certified'.
- CNIL draft recommendation on session replay (consultation to 22 April 2026). Session replay involves trackers, and reading and writing for it 'are not strictly necessary for the provision of the services offered by publishers'; therefore consent is required 'unless exempted'. It notes that replay tools reconstruct sessions and collect data that identifies users 'regardless of their configuration'. Purposes listed: detecting errors, UX improvement, support. Secondary reports (search snippets, not read in full) say a final recommendation was adopted on 8 Oct 2026 (deliberation 2026-114), published 5 Nov 2026, with prior consent and no exemption.
- Digital Omnibus: the Council agreed its negotiating mandate on 21 Oct 2026. Per the Heuking summary I read, Parliament has not adopted its position and entry into force is not expected before 2027. Reported content (search snippets, Council text not read): audience measurement without consent when the result is anonymous aggregated information that is not reused, shared or combined with third-party data; six purposes for device access without consent; a four-month wait before re-asking after a refusal.

**Item by item.**

| Item | Germany (TDDDG, DSK, BfDI) | France (CNIL) | Banner-free? |
|---|---|---|---|
| Cookieless analytics via the Umami script | Device access under §25(1): the script reads screen, language, referrer and title. Reach measurement is not strictly necessary, so consent is required. A narrower reading (access only where a fingerprint is built, DSK Rz. 24) is arguable but not the conservative view. | Exempt only if all conditions hold: anonymous statistics, no cross-site ID, no vendor reuse, cookie life and retention limits, self-assessment documented. Umami's own compliance statement for the CNIL tool was not found. | No in Germany. Possibly yes in France if configured as above. |
| Server-side analytics from server events and logs (no browser access) | No §25 access if nothing is read from or written to the device; GDPR applies: Art. 6(1)(f) with a documented balancing test, purpose limitation, deletion. BfDI: logs used for reach are a purpose change needing a legal basis. | Not a tracker issue if nothing is placed or read on the device. | Yes, under GDPR with documentation. |
| localStorage: settings the user asked for (theme, name, language) | Strictly necessary for a service explicitly requested (§25(2) No. 2). Heuking lists language settings, shopping carts and logins as examples. | Strictly-necessary exemption. | Yes, if scoped to the requested setting. |
| localStorage: anonymous participant ID | Access. Exempt only if strictly necessary for the room the user asked for. Rejoin after reload is arguable; a persistent ID across visits is harder to justify, since the service works without it. | Same logic as Germany. | Yes if room-scoped and deleted on leave; uncertain if persistent. |
| Error telemetry (client error capture) | Storage or device attributes (user agent, screen, language) are access. Error reporting as strictly necessary is arguable; no DSK text read settles it. | Audience purposes include 'detecting navigation problems', but only anonymous statistics qualify. | Grey zone. Yes only with no storage, no device attributes, a first-party endpoint, sampling and short retention. |
| RUM via OpenTelemetry in the browser (timings, web vitals, session ID, user agent) | Consent. Persistent session IDs and device attributes are access, and RUM is not strictly necessary. | Consent unless the anonymous-only exemption fits. | No. |
| Session replay | Consent (the CNIL draft says so explicitly; the German reasoning is the same). | Consent, no exemption in the draft. | No. |
| Umami Distinct ID | Storage or access if set client-side; personal data in any case, because it links visits. | Outside the exemption: not anonymous, and cross-visit. | No. |

**What would force a banner (any one of these):**
- an analytics script that reads device properties (screen, language, user agent, timezone, fingerprint) or writes storage, used for reach measurement, in Germany;
- any persistent identifier used for analytics, including a Distinct ID, a localStorage analytics ID, or a cross-visit ID;
- session replay or heatmaps;
- error or RUM capture that uses persistent IDs or device attributes;
- a vendor that reuses the data or sends it outside the EU, or a retention beyond 25 months;
- a shared identifier across domains (for example room app and marketing site) or any cross-site linkage;
- combining analytics with account data;
- storage written before consent (Rz. 36), or a refuse path harder than accept (Rz. 44);
- analytics collection that the user did not ask for, put into the same storage as a requested setting.

## 4. Recommendation

Build a two-tier design.

1. **Tier 0, no consent needed.** The room app runs on essential state only: settings the user sets, and a room-scoped participant token that is deleted on leave. Room lifecycle metrics come from the authoritative server as OpenTelemetry or a first-party event sink, with no browser device data and no persistent ID. Document a legitimate-interest assessment, set short retention (the exact window is a decision for the controller) and keep the data out of any cross-site or vendor context.
2. **Tier 1, consent.** The Umami script (pageviews, route changes, clicks, invite-link clicks) loads only after consent. Refuse must be as easy as accept, with no pre-ticked boxes. Do not enable Umami replays, and do not use Distinct IDs unless the consent wording covers them.
3. **Client error capture and RUM.** Keep them outside Umami. Use server-side error logging by default. Client error capture only if it has no storage, no device attributes and no persistent ID, and is sampled.

Suggested Umami settings for a self-hosted EU instance: PRIVATE_MODE=1 (disables external calls, including the DuckDuckGo favicon service; check it does not affect the admin UI you need); DISABLE_TELEMETRY=1 (Umami's own anonymous telemetry, a judgement call); SALT_ROTATION set to day or week, which reduces linkage but also reduces return-visit measurement (a metric tradeoff); ENABLE_CLIENT_SALT off; data-exclude-search and data-exclude-hash on; data-before-send to normalise room URLs; replays and error capture off; TRUSTED_PROXIES set to the actual proxy addresses; a retention or pruning job for raw events (the Umami retention default was not found).

If Germany needs no banner at all, drop Tier 1 and measure only with Tier 0. You lose page-level and click-level insight, which is the price of avoiding consent.

## 5. What must be decided now (cannot be retrofitted cleanly)

1. **Consent architecture:** which scripts load before consent. The room SPA must boot with zero non-essential scripts. Retrofitting changes load order and the data already collected.
2. **Identifier model:** scope and lifetime of the participant ID (room-scoped or persistent), and whether any persistent analytics ID exists at all. A persistent ID, once written, persists in history.
3. **Event taxonomy and property allowlist:** names are free text in Umami and history splits on rename. Fix names and bucket rules before launch.
4. **Room URL and join-secret placement:** path or fragment. It determines what ends up in server logs and analytics permanently.
5. **Processor and location:** self-host in the EU, no vendor reuse. Choose the analytics store (Postgres or ClickHouse) now, because migrating Umami data later is painful.
6. **Retention for each store:** Umami raw events, server events, logs, and replays if any. Stay under 25 months, and prefer short windows.
7. **SALT_ROTATION:** it sets session continuity and defines how metrics are computed. Changing it later changes the series.
8. **Which metrics come from client and which from server:** this decides which funnels are possible (see section 2).

## Tradeoffs

- Umami is simple and has useful funnels, but it is session-based and cookieless. It cannot follow a person across months without consent, and it cannot join the creator's browser session to the second participant's activity.
- Server-side events are the cleanest legal route for room lifecycle, but they give no page-level insight and need a documented legitimate-interest assessment.
- A banner is needed in Germany only if you want the Umami script. Adding it means a consent UI, a refuse path, and a loss of data from refusers.
- ClickStack is already in place and could hold room lifecycle events, which avoids a second analytics store for server events.
- The Digital Omnibus could later permit consent-free audience measurement in the EU. Design the consent gate as one switch so that you can move later without rewiring.

## Unverified and not checked

Not checked in this run: versions, release dates and licences for Bun, Elysia, Postgres, React 19, the React Compiler, Base UI, Tailwind 4, TanStack, Drizzle, Mantine, oxlint and oxfmt, Cloudflare Workers, and the OpenTelemetry browser SDK. The Umami licence was not verified. Umami Cloud's data-use and location terms were not read. Several Umami pages were unavailable (Filtering, Installation). The exact DSK wording on reach measurement and the full CNIL FAQ were not read. The CNIL final session-replay text was not read. The Council's Digital Omnibus text was not read. Whether the OpenTelemetry browser SDK stores a session ID or collects user-agent or screen attributes by default was not checked, and neither was whether the HyperDX browser SDK enables replay by default. The legal status of Cloudflare analytics on the marketing pages was not assessed.

## Not verified in this run

- Exact DSK wording on reach measurement under §25(2) No. 2 (OH Digitale Dienste, around Rz. 66-90): Only search snippets were available; the first 40,000 characters of the PDF were read, which stop around Rz. 45. The snippet is cut mid-sentence.
- Final CNIL session-replay recommendation (deliberation 2026-114): Only the draft (consultation to 22 April 2026) was read; the final text and its date rest on search snippets.
- Council text of the Digital Omnibus cookie provisions (six purposes, four-month wait): Secondary reporting only; Council text and Parliament position not read.
- CNIL FAQ on cookies (updated November 2026) and CNIL self-assessment tool: Not fetched within the budget.
- EDPB Guidelines 2/2023 on the technical scope of Art. 5(3) ePrivacy: Referenced by the DSK guidance but not read.
- Umami licence: Not checked in this run.
- Umami Filtering (segments and cohorts) and Installation requirements pages: Both returned 404 (docs.umami.is/docs/installation also). Segment definition, cohort model and minimum Postgres or ClickHouse versions are unverified.
- Umami retention defaults for raw events and pruning: No retention or pruning setting was found in the environment-variable reference.
- Umami Cloud data-use, processing location and transfer terms: Not read; relevant only if Umami Cloud is considered.
- OpenTelemetry browser SDK defaults (session storage, user agent and screen attributes) and HyperDX browser SDK replay defaults: Not checked; the legal grey-zone assessment for client error telemetry depends on these defaults.
- Legal status of Cloudflare analytics on static marketing pages: Not researched.
- Versions, release dates, licences and maturity of the rest of the stack (Bun, Elysia, Postgres, React 19, React Compiler, Base UI, Tailwind 4, TanStack, Drizzle, Mantine, oxlint, oxfmt, Cloudflare Workers, OpenTelemetry JS): Outside the research budget; the question's ecosystem comparison for these items is not answered.
- BfDI OH Digitale Dienste PDF on bfdi.bund.de: Fetch returned no text (saved to a file that could not be read); the ldi.nrw.de copy was used instead.
- Send API payload fields (website, session, hostname, language, referrer, screen, title, url, name, data) and the send(payload, 'event' or 'identify') method of @umami/node.: cited, but the page was never retrieved this run

## Sources

- https://github.com/umami-software/umami/releases
- https://www.gesetze-im-internet.de/ttdsg/__25.html
- https://www.cnil.fr/fr/cookies-solutions-pour-les-outils-de-mesure-daudience
- https://www.ldi.nrw.de/system/files/media/document/file/oh_digitale_dienste-2.pdf
- https://www.datenschutzkonferenz-online.de/orientierungshilfen.html
- https://docs.umami.is/docs/tracker-functions
- https://docs.umami.is/docs/distinct-ids
- https://docs.umami.is/docs/tracker-configuration
- https://docs.umami.is/docs/environment-variables
- https://www.bfdi.bund.de/DE/Fachthemen/Inhalte/Telemedien/Matomo.html
- https://docs.umami.is/docs/replays
- https://docs.umami.is/docs/error-tracking
- https://www.cnil.fr/sites/default/files/2026-02/recommendation_draft_session_replay.pdf
- https://www.heuking.de/en/news-events/newsletter-articles/detail/cookie-consent-under-the-digital-omnibus-planned-changes-and-technical-implementation.html
- https://docs.umami.is/docs/funnel
- https://docs.umami.is/docs/journey
- https://docs.umami.is/docs/bypass-ad-blockers
- https://docs.umami.is/docs/retention
- https://docs.umami.is/docs/goals
- https://docs.umami.is/docs/links
- https://docs.umami.is/docs/pixels
- https://github.com/umami-software/umami/releases/tag/v3.5.0
- https://www.bfdi.bund.de/SharedDocs/Downloads/DE/DSK/Orientierungshilfen/OH_Digitale-Dienste.pdf?__blob=publicationFile
- https://www.datenschutzkonferenz-online.de/media/oh/OH_Digitale_Dienste.pdf
- https://umami.is/docs/tracker-functions
- https://context7.com/umami-software/node
