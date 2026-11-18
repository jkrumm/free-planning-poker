# Rewrite strategy and cutover

Research run of 2026-11-18 (`agw research`, depth standard). Run status: ok. Citations grounded against fetched pages: 13/13. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line

- **Rewrite location:** Build the rewrite on the default branch, in new directories (for example `apps/web-v2` and `apps/room-server`), with path-filtered CI and no production traffic routed to them until each route is cut over. A long-lived rewrite branch, or a worktree on one, is the option the sources warn against. Use a worktree only as a local checkout of trunk.
- **Scope:** Change one thing at a time. The planned rewrite changes framework, database, UI kit, hosting, and the real-time protocol together, which is the second-system risk. Phase 1 should move the existing behaviour into the monorepo unchanged.
- **Migration method:** Use a strangler-fig migration, route by route, with the old app serving everything not yet moved. Move the URL-changing SEO step for the small marketing site in one go, and keep the app's URLs unchanged so the Cloudflare move is a hosting change.
- **Real-time cutover:** Do not migrate in-memory room state. New rooms go to the new server, and existing rooms drain on the old one.
- **Identity:** localStorage is per origin, so any change of host, scheme or port (including a beta subdomain) gives users a new client id unless a deliberate handoff runs while the old origin still serves a page. Keeping the production app on its current origin avoids this.
- **Rollback:** Keep the old deployment and the route table reversible for a fixed window. A Cloudflare rollback restores an earlier Worker version at 100% of traffic but does not revert bound resources, and open pages can request assets that the older version lacks.
- **Deleting old code:** Delete it after every route has run on the new app for a fixed window with no rollback. Keep the redirect table, which needs no old code and should stay at least a year.

## Rewrite strategy: branch, worktree, or trunk

Joel Spolsky's 2000 essay on Netscape 6.0 is the classic warning against rewriting from scratch. His argument is that the old code embeds bug fixes that took weeks of real use to find, and that a rewrite gives competitors a multi-year head start while the team ships an old version and cannot make strategic changes. He also cites Borland's rewrite of Quattro Pro and Microsoft's abandoned Pyramid project, and names the case where a rewrite is safe: Microsoft kept the old Word code base shipping while Pyramid ran. The essay is opinion, so treat it as a strong practitioner view rather than measured data. Its own remedy is refactoring in place, one piece at a time.

Martin Fowler's strangler-fig description (2024 bliki) makes the same point from the other side. Replacement is hard because existing behaviour is hard to specify and much of it is not wanted. The alternative is to add new pieces beside the legacy code, find seams, and move behaviour across gradually. Fowler notes that this needs transitional architecture, which is code that is removed once the migration is done, and that the organisation must change too.

Trunk-based development (trunkbaseddevelopment.com) says shared long-lived branches are bad at any release cadence. It recommends short-lived branches, feature flags and branch by abstraction, and says a build server is needed once more than a couple of developers commit. A rewrite branch that lives for months is exactly the long-lived branch it argues against.

| Option | Strength | Weakness |
|---|---|---|
| Long-lived rewrite branch or worktree | Isolated; no half-built code on trunk | Drifts from production; every production fix has to be ported; big-bang merge or none; Spolsky's failure mode |
| Trunk, new directories, path-filtered CI, no production routing | Every commit is releasable; fixes go to the old app and the new app is shipped as previews; old and new coexist | Needs a route table or flags; discipline to keep new code out of production routing; CI needs one workflow per app |
| Strangler fig, route by route | Value arrives per route; can stop midway; the old app is the fallback | Two stacks run at once; transitional code and shared state to remove later (Fowler) |

Recommendation: combine the second and third rows. Trunk holds both apps. The old app keeps taking production fixes. Each route moves when its new version is complete and has been checked against the old behaviour.

### Lessons on second-system effect and scope

- Spolsky separates old-code problems into three kinds: architecture (fixable by moving code and creating sharp interfaces), speed (fix the hot spot), and ugliness (fix with tooling). None requires a rewrite. For planning poker, the hidden behaviour is probably in reconnect rules, reveal edge cases, late votes and phone layouts. Those should be listed as acceptance tests before anything is rewritten.
- Google's site-move guidance (developers.google.com) says to change only one thing at a time, for example move domain first and change the layout later. The same rule applies here.
- The stack change in the plan (MariaDB to Postgres, Next.js to static, a new UI kit, new hosting, new WebSocket code) is five simultaneous changes. Stage them so each step has one visible effect and one rollback path.

## Cutover of a real-time app with ephemeral state

Rooms are held in memory on one VPS and are short-lived (the request says 2 to 30 people; the lifetime is an assumption to confirm). The safe pattern is drain, not migrate:

1. Run the new room server beside the old one, in its own container, on the same VPS.
2. Decide at room creation which server owns the room. Encode that in the room id or a routing prefix, so Traefik can route WebSocket connections by path without a lookup table. Existing rooms stay with the server that created them.
3. Stop creating rooms on the old server. Let existing rooms finish. Set a maximum age, announce it, and stop the old container when it is empty or the limit is reached.
4. Put a protocol version in the WebSocket handshake. A client on an old build can join only old rooms, and the new client refuses old protocols with a clear message.

The only state loss happens if the old server is killed while rooms are open. The rolling-deploy mechanism must not do that. This is engineering reasoning, not a sourced pattern; see unverified.

## SEO-safe move: Next.js on Vercel to static pages on Cloudflare

Google's site-move guide (developers.google.com) gives the steps:

- **Inventory URLs.** Start from sitemaps, the most-visited URLs in logs or analytics, the Links report in Search Console, and images and PDFs, which need the same treatment.
- **Map old to new.** Prefer identical paths. Google advises against redirecting many old URLs to one irrelevant page such as the home page, which can be read as a soft 404.
- **Canonical and sitemap.** Each new page needs a self-referencing `rel="canonical"` on the final host, and the sitemap should list the new URLs. Update hreflang if any is used.
- **Redirect type and chains.** Google recommends 301 or 308. Cloudflare's `_redirects` file defaults to 302, so write the code explicitly. Googlebot follows up to 10 hops but Google advises keeping chains to at most 3 and fewer than 5. Redirect directly to the final URL, which matters if Vercel and Cloudflare both redirect.
- **Cloudflare specifics.** The `_redirects` file sits in the static asset directory. It allows 2,000 static and 100 dynamic redirects, a combined 2,100, with 1,000 characters per line. The first matching line wins, and static lines must come before dynamic ones. Redirects in `_redirects` are not applied to requests served by Worker code, so any redirect logic in code will not run for matching asset requests. Proxying (a 200 rewrite) can hurt SEO; Cloudflare suggests a `Link: <...>; rel="canonical"` header if you use it.
- **Search Console.** Verify old and new sites and all variants (www, apex, http, https), and check each property separately. A change of host (for example a subdomain change) needs a Change of Address for the old property. A move within one domain does not. Submit the new sitemap; Google says the old sitemap can be removed afterwards, and redirect warnings in its report are expected.
- **Keep 404 or 410** for pages that are not moving. Carry over robots.txt and verification files. Remove any noindex that was used during development. Google says to prepare the list of noindex URLs before the move.
- **Timing.** Google says a small or medium site should move all URLs at once. For a site with few URLs, that is the marketing site. Expect a few weeks, possibly longer, before most URLs settle. Keep redirects for at least a year.

App routes (room pages) are not part of the SEO move unless their URLs change. Keep their URLs stable, and the strangler migration becomes invisible to search.

## Keeping per-origin identity and settings

MDN states that `localStorage` returns the storage for the document's origin, and that a site loaded over HTTP gets a different object from the same site over HTTPS. Consequences:

- The marketing site and the room app on different hosts do not share the client id or settings.
- A beta on `beta.example.com` starts users with a new id.
- Moving the room app from its Vercel host to a new host resets identity.

Options:

1. **Keep the production app on its current origin.** Put Cloudflare or Traefik in front so that the same hostname serves the static app and proxies the API and WebSocket paths to the VPS. Identity is untouched. This is the cheapest choice and it must be decided before launch.
2. **If the origin must change, run a one-time handoff.** The old origin keeps a small page for a fixed window. It reads the old keys and navigates (first-party) to the new origin, with the payload in the URL fragment. The new app stores it, then removes the fragment with `history.replaceState`. This is reasoning (fragments are not sent to servers); it has not been checked against browser storage-partitioning rules, which make cross-site iframe handoffs unreliable.
3. **Accept a reset** and say so in the release notes. Users who never return to the old origin lose their id either way.

Whatever the choice, keep the same key names and value shapes, put a schema version inside each stored value, and generate the client id the same way. Ids of anonymous users must survive the cutover, because the room server uses them to rejoin people to rooms.

## Public beta on a subdomain

A beta subdomain is a separate origin: separate localStorage, separate room server if it has its own, and no shared rooms with production. Use it to test the new app with real users and to test the handoff. Mark the beta host noindex, and do not block it in robots.txt, because a blocked crawler cannot see the noindex (general practice; not checked in this run). Tell beta users when identity resets.

## Rollback

- **Cloudflare Workers.** `wrangler rollback` or the dashboard creates a new deployment at 100% of traffic for the chosen version. You can roll back to the 100 most recent versions. The change takes time to reach every location, and pages loaded before the rollback can still request newer assets, so keep old asset files in the older version. A rollback does not change connected resources, and it is refused if the target version binds a resource (R2, KV or queue) that no longer exists, or if a Durable Object class lifecycle changed in between.
- **Route-level.** Keep the old Vercel deployment and the route table reversible for a fixed window (decide the length now). A route rollback is a routing change, not a code change.
- **VPS.** Keep the previous container image and the Traefik configuration for the previous route. This is reasoning, not sourced.
- **Data.** Do not dual-write MariaDB and Postgres. The rollback window needs the old database to stay writable, or the new writes must be copied back before rollback.

## When to delete old code

Delete the old application code when all of these hold: every route has run on the new app for the agreed window with no rollback; logs show no non-bot traffic to paths that exist only in the old app; and the old sitemap's indexed count has dropped to zero in Search Console, as Google describes. Tag the last commit that had the old code so it can be revived. Keep the redirect table, which is independent of the old code and should remain at least a year.

## Versions as of 18 November 2026

From the npm registry, the latest versions were: `next` 16.4.6, `elysia` 1.4.32, `react` 19.3.1, `tailwindcss` 4.3.5, `@base-ui/react` 1.9.0. Release dates, licences and maturity were not checked in this run and are listed as unverified. The Cloudflare redirects page was last updated 25 August 2026 and the rollbacks page 12 November 2026.

## Recommendation

Run the rewrite in trunk, in new directories, with path-filtered CI and no production routing. Move the marketing pages first, with URLs unchanged and the redirect table in place, which keeps the SEO risk small. Then move room routes behind a feature flag or beta host. Cut the real-time server over by drain. Keep the production app on its current origin if possible. Decide the rollback window and the deletion criteria before the first route moves.

## Trade-offs

- Same-origin production (identity safe) versus a clean new host (simpler infrastructure but needs a handoff).
- A long rewrite gives a clean design but delays value and reintroduces the bug fixes the old code already has.
- Drain-based real-time cutover is simple but keeps the old server alive as long as the longest room.
- Cloudflare for static pages is cheap and fast, but redirects, rollbacks and asset skew need explicit handling.

## Must decide now (cannot be retrofitted)

1. The production origin: host, scheme, and whether the app stays on its current host. This decides identity for every user.
2. The room URL scheme and room-id format, including any routing prefix. Shared room links cannot change later.
3. The localStorage key names, value shapes, schema versioning and client-id format.
4. A WebSocket protocol version in the handshake, so old and new clients and servers can coexist.
5. Trailing-slash, canonical-host (www or apex, HTTPS) and redirect policy, plus the URL inventory and redirect map, taken before the Vercel project is touched.
6. The rollback window and the deletion criteria.
7. Analytics continuity: Umami site ids and OpenTelemetry service names, since changing them splits the data.

## Not verified in this run

- Release dates, licences and maturity of next, elysia, react, tailwindcss and @base-ui/react: The registry lookup returned only the latest version number; release dates and licences were not read from a source.
- Second-system effect as described by Brooks (The Mythical Man-Month): Not read in this run; the report relies only on Spolsky's essay for the rewrite argument.
- Path-filtered CI (GitHub Actions paths filter) behaviour and limits: Not checked against GitHub documentation in this run.
- Cloudflare Workers proxying /api and /ws to a VPS origin under the same hostname, including WebSocket support: Not checked; the Cloudflare docs listing shows a Vercel migration guide, which was not read.
- Browser storage partitioning and cross-site iframe handoff of localStorage: Not checked; the fragment-based handoff is engineering reasoning from MDN's origin rule.
- Drain-based cutover of an in-memory WebSocket room server with Traefik routing by room-id prefix: No source read for this pattern; it is reasoning from the stated architecture.
- Pages Router trailing-slash and static-export behaviour on Next.js 16: Not checked; the URL parity advice assumes the policy must be matched to the old app and not verified against Next.js docs.
- Umami and OpenTelemetry continuity across a host or service-name change: Not checked in this run.

## Sources

- https://martinfowler.com/bliki/StranglerFigApplication.html
- https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes
- https://www.joelonsoftware.com/2000/04/06/things-you-should-never-do-part-i/
- https://developers.cloudflare.com/workers/static-assets/redirects/
- https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
- https://trunkbaseddevelopment.com/
- https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
- https://www.npmjs.com/package/next
- https://www.npmjs.com/package/elysia
- https://www.npmjs.com/package/@base-ui/react
- https://www.npmjs.com/package/react
- https://www.npmjs.com/package/tailwindcss
- https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks
