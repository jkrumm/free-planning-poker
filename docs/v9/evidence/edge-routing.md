# One hostname split by path: the edge of the beta host

Row `v9-edge-routing` (docs/v9/ARCHITECTURE.md, Topology) put the site on `https://next.free-planning-poker.com` as a Cloudflare Worker with static assets and no Worker code. It answers three questions by measurement. Measured on 2026-11-23 from the Mac mini, against deploy `1beecee` (deploy-site.yml run 45131474267, Worker version `61707eb4`). No token, account id or zone id appears below.

| Question | Answer |
|-|-|
| (a) Does the split work without Worker code? | **Yes.** The Worker route `next.free-planning-poker.com/*` and three routes with no Worker (`/room*`, `/_room/*`, `/api/*`) send each path to its server; the WebSocket smoke round passes. The fallback (Worker code that proxies with `fetch`) is not needed and not built. |
| (b) Are asset requests billed on the free plan? | **No.** Cloudflare's pricing says so, read on the day, and a burst of 500 asset requests left the Worker at zero invocations while the zone counted all 500. Nothing moves to an object store. |
| (c) What do the zone's settings do to AI crawlers? | **They blocked training crawlers and rewrote robots.txt**, against UX.md "Being found". The beta zone is aligned now: all 14 user agents get 200, and `/robots.txt` is the build's file byte for byte. The cutover list is below. |

## The setup

| Route on the zone | Worker | Served by |
|-|-|-|
| `next.free-planning-poker.com/*` | `fpp-site-beta` | static assets of `apps/site/dist/beta` |
| `next.free-planning-poker.com/room*` | none | tunnel, Traefik, `fpp-api` |
| `next.free-planning-poker.com/_room/*` | none | tunnel, Traefik, `fpp-api` |
| `next.free-planning-poker.com/api/*` | none | tunnel, Traefik, `fpp-api` |

Which route wins, per Cloudflare's routes page read on 2026-11-22: "When more than one route pattern could match a request URL, the most specific route pattern wins", and "A route can be specified without being associated with a Worker. This will act to negate any less specific patterns." `apps/site/scripts/edge-routes.ts` creates the three before `wrangler deploy` creates `/*`, so `/*` never exists without them. The first run's log:

```
edge-routes: created next.free-planning-poker.com/room* with no Worker
edge-routes: created next.free-planning-poker.com/_room/* with no Worker
edge-routes: created next.free-planning-poker.com/api/* with no Worker
```

The second run (the one that deployed):

```
edge-routes: next.free-planning-poker.com already has its routes with no Worker
Uploaded fpp-site-beta (2.75 sec)
Deployed fpp-site-beta triggers (1.79 sec)
  next.free-planning-poker.com/* (zone name: free-planning-poker.com)
indexnow: skipped on the beta target; the beta host is noindex and submits nothing
beta host healthy: https://next.free-planning-poker.com/api/health, site / /guide noindex
```

The first run failed one step later: the shared token `cf-deploy` could read Workers scripts but not write them ("No access to the specified resource"). The owner corrected its permission, and nothing had changed for visitors in between, because `/*` did not exist yet.

No other way in: `workers_dev` and `preview_urls` are false in `apps/site/wrangler.jsonc`. The script's subdomain settings, read with the tooling token:

```
$ curl .../accounts/<account>/workers/scripts/fpp-site-beta/subdomain
{"result": {"enabled": false, "previews_enabled": false}, "success": true}
$ curl .../accounts/<account>/workers/scripts   # id, has_assets, has_modules, handlers
fpp-site-beta True False ['fetch']
```

## (a) Who serves each path

`curl -sS -o /dev/null -D - https://next.free-planning-poker.com<path>`, headers trimmed to the ones that tell the servers apart. Workers static assets answer with `cf-cache-status` before `cache-control: public, max-age=0, must-revalidate`, then the `_headers` lines in file order. The API answers through Traefik with headers in alphabetical order and `cf-cache-status: DYNAMIC`, and `apps/api/src/http/spa.ts` adds `content-security-policy` to the room shell and `immutable` to hashed files.

| Path | Status | Served by | Evidence |
|-|-|-|-|
| `/` | 200 | Worker | `<title>Free Planning Poker \| Quick &amp; Easy Estimates</title>`, `cache-control: public, max-age=0, must-revalidate` |
| `/guide` | 200 | Worker | `guide.html` at `/guide` with no redirect |
| `/guide.html` | 307 to `/guide` | Worker | `html_handling: auto-trailing-slash` |
| `/no-such-page` | 404 | Worker | the site's 404 page, `<title>Free Planning Poker - 404 - Page Not Found</title>` |
| `/room/313855` (a fresh number) | 200 | API | `content-security-policy: frame-ancestors 'none'`, `cache-control: no-cache`, `cf-cache-status: DYNAMIC`, the shell names `/_room/` |
| `/_room/assets/index-Cz0RUshq.js` | 200 | API | `cache-control: public, max-age=31536000, immutable` |
| `/api/health` | 200 | API | `{"status":"ok"}`, `cf-cache-status: DYNAMIC`; `/api/version` names commit `1beecee` |

```
# /
HTTP/2 200 
content-type: text/html
cf-cache-status: MISS
cache-control: public, max-age=0, must-revalidate
strict-transport-security: max-age=31536000; includeSubDomains; preload
permissions-policy: camera=(), microphone=(), geolocation=(), payment=()
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
x-frame-options: SAMEORIGIN
x-robots-tag: noindex
server: cloudflare

# /room/313855
HTTP/2 200 
content-type: text/html; charset=utf-8
cache-control: no-cache
content-security-policy: frame-ancestors 'none'
permissions-policy: camera=(), microphone=(), geolocation=(), payment=()
referrer-policy: strict-origin-when-cross-origin
strict-transport-security: max-age=31536000; includeSubDomains; preload
x-content-type-options: nosniff
x-frame-options: SAMEORIGIN
x-robots-tag: noindex
cf-cache-status: DYNAMIC
server: cloudflare

# /api/health
HTTP/2 200 
content-type: application/json;charset=utf-8
permissions-policy: camera=(), microphone=(), geolocation=(), payment=()
referrer-policy: strict-origin-when-cross-origin
strict-transport-security: max-age=31536000; includeSubDomains; preload
x-content-type-options: nosniff
x-frame-options: SAMEORIGIN
x-robots-tag: noindex
cf-cache-status: DYNAMIC
server: cloudflare
```

Every path carries the same five security headers and `X-Robots-Tag: noindex`: the site's from its `_headers` (`apps/site/src/lib/headers.ts`), the API's from Traefik's `security-headers` and `fpp-api-noindex` middlewares. The redirect and the 404 page carry them too.

The WebSocket at `/api/ws/<slug>` goes through a route with no Worker. The smoke round drives it with real browsers:

```
$ factory slot run -- make e2e-beta E2E_BASE_URL=https://next.free-planning-poker.com
Running 2 tests using 2 workers
  ✓  2 [chromium] › e2e/suite/votes.e2e.ts:24:1 › three seats vote: nobody sees a card before the reveal, then everybody sees all @smoke (1.7s)
  ✓  1 [chromium] › e2e/suite/locked.e2e.ts:4:1 › a locked room seats the invite link and asks everyone else for the password @smoke (2.4s)
  2 passed (3.2s)
```

## (b) Asset requests and the free plan

Cloudflare's documentation, read on 2026-11-22 and 2026-11-23:

- Workers pricing, footnote 3: "Requests to static assets are free and unlimited." Fine print: "Only requests that hit a Worker will count against your limits and your bill."
- Static assets, billing: "Requests to static assets are free and unlimited. Requests to the Worker script (for example, in the case of SSR content) are billed according to Workers pricing." For the free plan: "When using run_worker_first, requests matching the specified patterns will always invoke your Worker script. If you exceed your free tier request limits, these requests will receive a 429."
- Workers pricing, footnote 4: "When Workers Caching is enabled, requests served from the Worker's cache are billed at the same per-request rate as requests that invoke the Worker. This includes requests to static assets." Workers Caching is opt-in (`cache.enabled` in the wrangler config); `apps/site/wrangler.jsonc` does not set it.
- Limits: the free plan allows 100,000 Worker requests a day ("When a Worker exceeds this limit, Cloudflare returns Error 1027"), 20,000 asset files per version, 25 MiB per file. The beta build has 106 files.

The burst: 100 rounds over five assets, each URL with a unique query so no cache answered for the Worker.

```
$ for i in $(seq 1 100); do for p in / /guide /robots.txt /og/index.png /sitemap-0.xml; do
    curl -s -o /dev/null -w '%{http_code}\n' "https://next.free-planning-poker.com$p?b=$i"; done; done | sort | uniq -c
 500 200
```

The account's analytics (GraphQL, tooling token with Account Analytics read). Eight minutes after the burst, the Worker's invocations since the deploy (2026-11-23T07:30:00Z to 2026-11-23T07:41:39Z) were:

```
workersInvocationsAdaptive(filter: {scriptName: "fpp-site-beta", datetime_geq: "2026-11-23T07:30:00Z", datetime_leq: "2026-11-23T07:41:39Z"})
{"errors": null, "rows": []}
```

The zone's own count for the beta host in the burst window (2026-11-23T07:32:36Z to 2026-11-23T07:33:05Z) shows the requests arrived:

```
httpRequestsAdaptiveGroups(filter: {clientRequestHTTPHost: "next.free-planning-poker.com", ...})
{"errors": null, "rows": [{"count": 101, "dimensions": {"clientRequestPath": "/robots.txt", "edgeResponseStatus": 200}}, {"count": 101, "dimensions": {"clientRequestPath": "/sitemap-0.xml", "edgeResponseStatus": 200}}, {"count": 100, "dimensions": {"clientRequestPath": "/guide", "edgeResponseStatus": 200}}, {"count": 99, "dimensions": {"clientRequestPath": "/", "edgeResponseStatus": 200}}, {"count": 99, "dimensions": {"clientRequestPath": "/og/index.png", "edgeResponseStatus": 200}}]}
```

The zone counted 500 asset requests, and the Worker counted none, neither from the burst nor from the deploy's own `verify-next`, the e2e round or the probes above. Asset requests are not Worker requests: they are not billed and do not count toward the 100,000 a day. One limitation: the invocation query gave no positive control, because this Worker has no code to invoke. What would change the answer is any of `main`, `run_worker_first` or `cache.enabled` in `wrangler.jsonc` (`apps/site/AGENTS.md`, The edge).

## (c) AI crawlers

The policy (docs/v9/UX.md, Being found; STRATEGY.md, Rulings of gate 1) lets search, user-triggered and training crawlers in, and `apps/site/src/lib/robots.ts` says so by name. The zone's bot settings before this row, read with the tooling token (`GET /zones/<zone>/bot_management`):

```
fight_mode: false, ai_bots_protection: disabled, crawler_protection: disabled, content_bots_protection: disabled,
ai_training: disallow, ai_search: disabled, ai_user: only_on_ad_pages,
ai_agents: {anthropic_agent, google_agent, instinct, muse, openai_agent: disabled},
is_robots_txt_managed: true, bot_preference_sync_enabled: true, cf_robots_variant: off
```

Their effect, measured by fetching `/` with each crawler's user agent (`curl -A <agent> -w '%{http_code}'`). This tests the user-agent rules only: a real crawler also comes from its own addresses, which Cloudflare's verified-bot check reads.

| User agent | Before | After |
|-|-|-|
| `OAI-SearchBot` | 200 | 200 |
| `ChatGPT-User` | 200 | 200 |
| `GPTBot` | 403 | 200 |
| `Claude-SearchBot` | 200 | 200 |
| `Claude-User` | 200 | 200 |
| `ClaudeBot` | 403 | 200 |
| `PerplexityBot` | 403 | 200 |
| `Perplexity-User` | 200 | 200 |
| `Googlebot` | 200 | 200 |
| `Applebot` | 200 | 200 |
| `bingbot` | 200 | 200 |
| `CCBot` | 403 | 200 |
| `Bytespider` | 403 | 200 |
| `curl (control)` | 200 | 200 |

Before, `/robots.txt` was 3908 bytes, against the build's 1233: Cloudflare prepended its Content Signals text and a managed block ahead of our file.

```
# BEGIN Cloudflare Managed content
User-agent: *
Content-Signal: search=yes,ai-train=no,use=reference
Allow: /

# Training crawlers
User-agent: Amazonbot
Disallow: /
... (Applebot-Extended, Bytespider, CCBot, ClaudeBot, Diffbot, Google-Extended, GPTBot and 26 more, each Disallow: /)
# END Cloudflare Managed Content
```

Cloudflare's managed robots.txt page explains why: "Cloudflare prepends managed directives and the Content Signals Policy to your robots.txt only when Enable Bot Preference Sync is turned on and at least one of your Search, Agent, or Training policies is set to Block, Block on pages with ads, or, for Training, Disallow. With every policy set to allow, there is nothing to prepend and your robots.txt is served unchanged." Training on Disallow "adds managed directives and enables edge blocking for AI training crawlers", which accounts for the 403s.

**Aligned on 2026-11-23 07:32 UTC** with the tooling token (`PUT /zones/<zone>/bot_management` with the current object and three fields changed): `ai_training: disabled`, `ai_user: disabled` (both mean "do not block"; `ai_search` was already `disabled`) and `is_robots_txt_managed: false`. Twenty seconds later, every agent in the table answered 200, and `/robots.txt` equalled `apps/site/dist/beta/robots.txt` byte for byte. Rollback is the same call with `ai_training: disallow`, `ai_user: only_on_ad_pages` and `is_robots_txt_managed: true`.

Markdown for Agents is off on the zone: `curl -H 'Accept: text/markdown' https://next.free-planning-poker.com/` answers `content-type: text/html` with the HTML page and no `Content-Signal` header. So Cloudflare grants no implicit `ai-train=yes, search=yes, ai-input=yes` signal (research r20, section 2).

The bot settings belong to the zone, not to a hostname, so they already hold for `free-planning-poker.com`. Today they reach only proxied hosts: the apex and `www` are DNS-only records that point at Vercel.

## What the production hostname needs at the cutover

1. **Proxy the apex.** It is a DNS-only A record to Vercel today; a Workers route needs a proxied record. Decide `www` too: it is a DNS-only CNAME, and the canonical host is the apex, so `www` redirects to it.
2. **Routes.** `bun apps/site/scripts/edge-routes.ts --host free-planning-poker.com` with the deploy token, before the Worker route, then a production Worker with `dist/production` on `free-planning-poker.com/*`. Its `_headers` carries no noindex (`test/headers.site.test.ts`).
3. **Bot settings.** Re-read `GET /zones/<zone>/bot_management`: training, search and user policies on "do not block", `is_robots_txt_managed` false, `fight_mode` false (Bot Fight Mode cannot be skipped by a WAF rule). Then repeat the user-agent table above against the apex, and compare `/robots.txt` with `dist/production/robots.txt`.
4. **Markdown for Agents.** It stays off. If it is ever turned on, send our own `Content-Signal` header so Cloudflare adds none.
5. **Billing.** No change: the production Worker has no code either. Re-read the pricing page on the day and repeat the burst once.
