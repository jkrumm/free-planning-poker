# Room SPA stack, PWA and embedding

Research run of 2026-11-18 (`agw research`, depth deep). Run status: ok. Citations grounded against fetched pages: 41/42. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line

- **Build tooling:** Use Vite 8. Rolldown is its only bundler since Vite 8.0 (stable 12 March 2026). Vite 8.1 followed on 23 June 2026. npm's latest at check time was vite 8.3.8. Do not start on `rolldown-vite`, the older technical-preview package (npm latest 7.3.1).
- **UI runtime:** React 19.3 with React Compiler 1.0 is the lower-risk choice for this stack. Base UI, Motion and TanStack Router are all built for React. Preact 11 would save roughly 49 KB gzip of framework code, but it puts Base UI and Motion on an unofficial compat path with known bugs. Switch only if a measured JS budget on phones fails.
- **Routing:** Use TanStack Router as a client-only SPA with its Vite plugin for file-based routes. TanStack Start's SPA mode is a separate framework and is not needed.
- **PWA:** Use vite-plugin-pwa 2.0.0 (released 3 October 2026) for precaching and updates. Pick Serwist (9.5.x) only if you need custom runtime caching. Workbox 7.4.x is maintenance-only. Offline, a realtime room can offer the app shell and a read-only last-known state. It must not queue votes.
- **Embedding:** Use an iframe with a versioned, origin-checked postMessage protocol. Every host platform reviewed (Teams, Miro, Slack Work Objects, Atlassian Forge Custom UI) runs apps in iframes, so a web component buys nothing here. Set `frame-ancestors` explicitly per host. Do not rely on iframe-local localStorage for the anonymous identity, because browsers partition it by top-level site.
- **Decide now (hard to retrofit):** the canonical app origin and path; the frame-ancestors allowlist; where the anonymous identity lives and whether it is server-issued; the postMessage handshake and its versioning; the React-versus-Preact choice (it shapes the design-system package); and the service-worker scope.

## Versions and maturity (as of 18 November 2026)

| Package | Latest seen (npm, at check time) | Dated evidence | Maturity note |
|---|---|---|---|
| vite | 8.3.8 | 8.0 stable 12 Mar 2026; 8.1 on 23 Jun 2026 | Stable. 8.1 reports 41.6M weekly downloads |
| rolldown | 1.0 stable (blog) | 7 May 2026 | Semver-locked API. Output (DCE, chunking) may still change between minors |
| rolldown-vite | 7.3.1 | Preview package | Superseded by Vite 8 |
| react | 19.3.1 | 19.3.0 on 9 Sep 2026 (react.dev). 19.3.1 dated 14 Oct 2026 in a dependency-bot quote (secondary) | View Transitions and Fragment Refs stable in 19.3 |
| babel-plugin-react-compiler | 1.0.0 | React Compiler 1.0 on 7 Oct 2025 | Stable. Lint rules ship in eslint-plugin-react-hooks recommended preset |
| preact | 11.2.0 | Redact measured 11.0.2 (Oct 2026). Preact calls v11 a minimally breaking upgrade from 10.x | Mature, MIT. Compat layer is the React bridge |
| @base-ui/react | 1.9.0 | No release date checked | Docs say React 17 and newer. No Preact statement |
| @tanstack/react-router | 1.170.46 | No release date checked | Mature, React-first |
| motion | 14.14.0 | No release date checked | Docs are React-first |
| vite-plugin-pwa | 2.0.0 | GitHub release 3 Oct 2026. Adds Vite 8 peer dependency. Requires Node 20.19+ | MIT (package.json). Snyk reports no commits in the last 6 months |
| @serwist/vite | 9.5.15 | Serwist 9.5.12 dated July 2026 (secondary) | Active Workbox fork, ESM-only |
| workbox (workbox-*) | 7.4.1 | May 2026 (secondary) | Maintenance-only: API stable, feature-frozen |

Licences: only vite-plugin-pwa was checked (MIT). The others were not checked in this run.

## React 19 with React Compiler versus Preact

**React.** React 19.3 shipped on 9 September 2026. React Compiler 1.0 shipped on 7 October 2025 and is production-ready (react.dev). Vite's React plugin v6 uses Oxc for the Refresh transform and drops Babel as a dependency. The compiler is opt-in via a `reactCompilerPreset` helper that runs through `@rolldown/plugin-babel`. Plugin v5 still works with Vite 8 (vite.dev blog, 12 March 2026).

**Bundle sizes.** Every number here is from TanStack's own Redact measurements (esbuild 0.28.0, minified, ES2022, gzip). They were not reproduced independently.

- Preact 11.0.2, compat plus JSX plus client: 11,179 bytes gzip. Preact core alone: 5,029 bytes.
- React 19.2.3, client bundle (react, react-dom/client, jsx-runtime) measured as one bundle: 60.48 KB gzip. react-dom/client alone: 60.27 KB.
- Derived: the React-minus-Preact delta is about 49 KB gzip (60.48 minus 11.18). The per-entry rows sum to about 64 KB, above the bundled total. The bundled total is the right figure because shared code is counted once.
- TanStack's own Redact runtime is 12.24 KB in its savings page (v0.0.1) but 23.3 KB in its Preact page (v0.2.0, default preset). The two pages disagree, so treat Redact as pre-1.0 and watch it. It is not a recommendation yet.

**Compatibility.**

- **Base UI:** its About page says it 'supports React 17 and newer' and names no Preact support. Base UI issue #1995 shows the workaround of aliasing react and react-dom to preact/compat, which the author calls 'not good'.
- **Motion with Preact:** Preact PR #5055 (opened 17 March 2026, merged 25 June 2026 into the v10.x branch) fixes exit animations when motion/react and @base-ui/react run on preact/compat. Before the fix, a popup vanished instead of animating out, because Preact flushed effects per component. Whether the fix reached Preact 11.x was not verified.
- **Compat gaps (from TanStack's Redact comparison, a competitor's account):** compat does not export useActionState, useOptimistic, useFormStatus, Activity or ViewTransition. useDeferredValue returns the incoming value. Neither Preact nor Redact provides React's concurrent rendering. For a room app this matters only if you need the newer React 19 APIs.
- **TanStack Router on Preact:** not verified in this run.

**Recommendation.** Use React 19.3 with the compiler. You pay about 49 KB gzip of fixed JavaScript, which is not per-room. In return, Base UI, Motion and TanStack Router need no aliases. Keep Preact as the fallback if a measured build of your own design system fails the phone budget.

## Vite and Rolldown: what to watch

- Vite 8 requires Node 20.19+ or 22.12+ (vite.dev blog).
- Vite 8.1 added experimental bundled dev mode (`experimental.bundledDev`). The Vite team reports about 15x faster startup for an app with 10,000 React components. Treat it as experimental, not as a default.
- The Rolldown 1.0 page carries a banner stating that VoidZero is joining Cloudflare. The consequences for Vite, Rolldown or your Cloudflare hosting were not checked. Note it, do not overread it.

## TanStack Router in SPA mode

- TanStack Router with its Vite plugin (`@tanstack/router-plugin`) is client-side by default. It needs no server.
- TanStack Start's SPA mode (`spa.enabled`) prerenders only the root route into `/_shell.html` and rewrites 404s to that shell. Server functions and routes can be allow-listed on top of it (TanStack Start docs). Its purpose is a CDN-hostable shell, which is not what you need for an Elysia-served SPA.
- For this stack, use the Router alone with file-based routes. You still need a deployment fallback on the VPS (Traefik) so that deep links such as `/r/<id>` serve `index.html`, while `/api` and the WebSocket path are routed to Elysia.

## PWA in 2026

**Tooling.**

- vite-plugin-pwa 2.0.0 was released on 3 October 2026. It adds the Vite 8 peer dependency (GitHub release). Snyk rates it HEALTHY but reports no commits in the last 6 months, so weigh that maintenance signal.
- Workbox 7.4.1 (May 2026) is feature-frozen. It is the foundation of most PWA tooling (secondary).
- Serwist is a Workbox fork, ESM-only and actively developed. It was forked after Workbox's development stalled (secondary).
- Choice: vite-plugin-pwa for precache plus an update prompt. Serwist for custom runtime strategies.

**iOS.**

- Since iOS and iPadOS 16.4, Home Screen web apps support Web Push and the Badging API. Permission must be requested in response to a user gesture (WebKit, 16 Feb 2023).
- In iOS 26 and Safari 26, any site added to the Home Screen opens as a web app by default. The user can switch 'Open as Web App' off (WebKit Features in Safari 26.0, 15 Sep 2025; Apple's Safari 26 release notes).
- A Home Screen web app stores website data separately from Safari (OpenPWA, secondary). Test this yourself: an anonymous id created in Safari will not carry over to the installed app.

**Android and desktop installability.** Not verified in this run. The web.dev install-criteria page was read, but the text was cut before the criteria list.

**What a realtime room can usefully do offline.**

1. Precache the app shell and the embed route, so a reopened page shows a 'reconnecting' state instead of a browser error.
2. Show a timestamped, read-only snapshot of the last room state from IndexedDB.
3. Do not queue votes. Under hidden-vote rules a vote sent after a reveal is wrong, and the server is authoritative.
4. On reconnect, resync from a full room snapshot with a sequence number. You need this for rolling deploys anyway.
5. Background Sync is Chromium-only: Firefox and Safari do not support it (OpenPWA). Do not build on it.

## Embedding the app in other tools

**iframe or web component.** The platform docs read here all describe iframes, and none describes a web-component embed. Teams tabs are web pages in an iframe (Microsoft Learn). Miro apps run inside iframes using the Web SDK. Slack Work Objects render in a sandboxed iframe. Forge Custom UI apps all run within an iframe. Choose an iframe plus postMessage. Put a versioned schema on the messages, check `event.origin` on receipt, and send with an explicit `targetOrigin`.

**Platform requirements.**

- **Microsoft Teams:** Set `frame-ancestors` (or X-Frame-Options) so that Teams can frame the page. Allow `teams.microsoft.com` and `*.teams.microsoft.com`, the Microsoft 365 hosts, and `https://*.cloud.microsoft` for the ongoing migration. Use TeamsJS 2.19.0 or later and call `app.initialize()`, or the page is not shown. Pages must be HTTPS. Sign-in pages do not render inside iframes, so use token or cookie auth rather than a redirect. Self-signed certificates are not supported.
- **Jira and Confluence (Forge):** Custom UI apps run in an Atlassian-hosted iframe. External domains must be declared in the manifest's `content` CSP and egress section. Tunnelling for development works only in Chrome and Firefox. Whether Forge can frame an external SPA was not verified. This is the largest open question for Atlassian.
- **Notion:** There is no app-embed SDK in the pages read. The Embed block works from a URL, and Notion says it embeds content from over 1,900 domains through Iframely. Other pages must allow framing or the embed fails (iframecheck, secondary). Expect a room link to be a bookmark unless your domain is on that list. Unverified.
- **Miro:** Miro apps run in iframes in panels, modals or headless, using the Web SDK and an app manifest. The Embed item only accepts supported providers.
- **Slack:** Slack Marketplace guidelines exclude apps that embed Slack into another site, which is not this case. Work Objects embeds render in a sandboxed iframe inside the flexpane. Since 6 November 2026, the frame-ancestors directive must include `https://*.slack-mcps.com`, and embeds fail if any of three origins is missing (Slack changelog). This is a narrow surface. App Home and Block Kit are the main Slack entry points.

**CSP frame-ancestors (MDN).** The directive names the parents allowed to embed a page. It does not fall back to default-src, so set it explicitly. It is ignored in a meta tag. `'none'` is equivalent to X-Frame-Options DENY. In nested frames every ancestor must match, or the load is cancelled. Widely available since January 2018. Practical rule: emit per-route `frame-ancestors` for embed routes only, and keep DENY everywhere else (Traefik and Elysia both need this).

**Storage partitioning.**

- **Chrome:** storage partitioning is enabled for all users from Chrome 115. localStorage and IndexedDB written by an iframe are keyed by origin and top-level site. Chained cross-site frames get an extra ancestor bit (Privacy Sandbox, Storage Partitioning page).
- **Firefox:** double-keys all client-side state by resource origin and top-level site (MDN State Partitioning).
- **Safari:** partitions third-party storage (secondary). Details not checked.
- **Consequence:** a client id created inside a Teams tab will differ from the one created by a direct visit. The installed iOS app also has separate storage.
- **CHIPS:** an opt-in for partitioned cookies, with separate cookie jars per top-level site (Chrome, March 2026). It and the Storage Access API are the only supported routes to unpartitioned cookies.
- **Storage Access API:** lets a framed site request access to unpartitioned storage. The framed site must call it. Safari's gesture rules were not verified.
- **Design answer:** do not build identity on iframe-local localStorage. Prefer a server-issued, room-scoped token passed in the URL or from the host through the postMessage handshake (Teams already supplies user context). If a cookie is needed in an embed, use SameSite=None and Secure, and consider CHIPS. Use the Storage Access API only as a fallback.

## Recommended stack

- Bun monorepo. Vite 8 with `@vitejs/plugin-react` v6, and the React Compiler enabled via `reactCompilerPreset`.
- React 19.3, Base UI 1.9, Tailwind 4, TanStack Router (file-based, client-only), Motion (React).
- vite-plugin-pwa 2.0.0 for precache and the update prompt. Serwist only if runtime caching grows.
- Elysia on the VPS serves the SPA and the WebSocket. The SPA fallback and frame-ancestors are set per route at the proxy or server.
- An embed route with its own frame-ancestors allowlist, and a postMessage adapter (versioned, origin-checked) per host (Teams, Miro, Slack, Forge).

**Tradeoffs.** React costs about 49 KB gzip more than Preact. Preact is smaller but relies on compat paths for Base UI and Motion, with a recent exit-animation fix that may not cover Preact 11.x. Redact could be a future option but is pre-1.0. The PWA choice trades vite-plugin-pwa's simplicity against Serwist's control. Offline realtime is limited to the shell and a read-only snapshot.

**Must decide now.**

1. Canonical app origin and path. Cookie scope, SameSite and partitioning all follow from it.
2. The frame-ancestors allowlist and which routes are frameable.
3. Where the anonymous identity lives: server-issued room token, host-provided identity, or cookie.
4. The postMessage protocol: message versions, origin checks, handshake.
5. No sign-in redirects inside a room. Teams blocks them.
6. React versus Preact, since the design-system package depends on it.
7. Service-worker scope and manifest start URL, which tie to the canonical origin.
8. Realtime protocol: sequence numbers and full-snapshot resync on reconnect. Votes are not queued offline.

The bundler and the PWA plugin are cheap to swap later. Origin, framing, identity and the message protocol are not.

## Not verified in this run

- Android Chrome and desktop installability criteria (manifest, service worker, icons): Page fetched but the text was cut before the criteria list; not checked further because the research budget ran out.
- Whether Preact 11.x includes the exit-animation fix from PR 5055 (merged into the v10.x branch): Only the v10.x merge was read; the 11.x release notes were not checked.
- TanStack Router running on Preact via preact/compat: No source read for this in this run; the only related search result concerned React Router.
- Whether Forge Custom UI can frame an external SPA (the Frame component and Events API): Search snippet only; the Frame page was not read, and the page says it renders static frontend apps, not external origins.
- Notion embedding of an arbitrary room URL (not on the Iframely list): Help page snippet only; no documented app-embed SDK was found, so the fallback behaviour is unconfirmed.
- Jira and Confluence frame-ancestors and host domain lists beyond Forge's manifest: Atlassian pages on frame-ancestors were not read; the exact allowlist is unknown.
- Safari storage partitioning rules and Storage Access API user-gesture requirements: The MDN third-party cookies page was only seen as a truncated snippet; Safari details were not read.
- Chrome third-party cookie phase-out status in 2026: The Privacy Sandbox banner says some technologies are being phased out, but the current status was not read.
- Web components versus iframes as an embed model, beyond the platform docs: Not researched directly. The conclusion rests on the host platforms' iframe requirements, not on a source comparing the two models.
- Licences for React, Preact, Base UI, TanStack, Motion, Vite, Rolldown, Serwist and Workbox: Only vite-plugin-pwa's MIT licence was read; the rest were not checked.
- Release dates for @base-ui/react 1.9.0, @tanstack/react-router 1.170.46, motion 14.14.0, preact 11.2.0 and vite 8.2 to 8.3: npm registry answers gave versions without dates; the intermediate Vite releases were not dated.
- Bundle size of the actual room app with Base UI and Motion on React versus Preact: Not measured. The figures above are framework-only numbers from TanStack's Redact project and were not reproduced.
- Background Sync and service-worker behaviour inside cross-site iframes: Not researched. Partitioning of service workers in embeds is unverified.
- Teams tabs are web pages rendered in an iframe: cited, but the page was never retrieved this run

## Sources

- https://vite.dev/blog/announcing-vite8
- https://vite.dev/blog/announcing-vite8-1
- https://voidzero.dev/posts/announcing-rolldown-1-0
- https://www.npmjs.com/package/vite
- https://react.dev/blog/2025/10/07/react-compiler-1
- https://react.dev/blog/2026/09/09/react-19-3
- https://github.com/magicuidesign/magicui/pull/1045
- https://tanstack.com/redact/latest/docs/preact
- https://tanstack.com/redact/latest/docs/SAVINGS_ANALYSIS
- https://github.com/preactjs/preact/pull/5055
- https://base-ui.com/react/overview/about
- https://github.com/mui/base-ui/issues/1995
- https://preactjs.com/guide/v11/upgrade-guide/
- https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode.md
- https://tanstack.com/router/latest/docs/installation/with-vite
- https://github.com/vite-pwa/vite-plugin-pwa/releases
- https://github.com/vite-pwa/vite-plugin-pwa/blob/v2.0.0/package.json
- https://security.snyk.io/package/npm/vite-plugin-pwa
- https://progressivewebapps.com/tooling/
- https://openapps.pro/packages/serwist
- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes
- https://webkit.org/blog/17333/
- https://openpwa.net/reference/storage/home-screen-storage-isolation/
- https://openpwa.net/reference/service-worker/background-sync/
- https://web.dev/articles/install-criteria
- https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/tab-requirements
- https://developer.atlassian.com/platform/forge/custom-ui/iframe/
- https://developer.atlassian.com/platform/forge/build-a-custom-ui-app-in-jira/
- https://developer.atlassian.com/platform/forge/add-content-security-and-egress-controls/
- https://developers.miro.com/docs/app-panels-and-modals
- https://developers.miro.com/docs/websdk-reference-embed
- https://www.notion.com/help/embed-and-connect-other-apps
- https://iframecheck.com/platforms/notion
- https://docs.slack.dev/messaging/work-objects-embeds/
- https://docs.slack.dev/changelog/
- https://docs.slack.dev/slack-marketplace/slack-marketplace-app-guidelines-and-requirements/
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors
- https://privacysandbox.google.com/cookies/storage-partitioning
- https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/State_Partitioning
- https://developer.chrome.com/docs/privacy-sandbox/chips/?authuser=0
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_Access_API
- https://www.npmjs.com/package/rolldown-vite
- https://www.npmjs.com/package/@serwist/vite
- https://www.npmjs.com/package/vite-plugin-pwa
- https://www.npmjs.com/package/motion
- https://www.npmjs.com/package/babel-plugin-react-compiler
- https://www.npmjs.com/package/react
- https://www.npmjs.com/package/preact
- https://www.npmjs.com/package/@base-ui/react
- https://www.npmjs.com/package/@tanstack/react-router
