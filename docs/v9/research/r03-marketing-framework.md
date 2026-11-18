# Astro versus TanStack Start for the marketing site

Research run of 2026-11-18 (`agw research`, depth deep). Run status: ok. Citations grounded against fetched pages: 33/33. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line

- **Marketing engine:** Astro 7 fits a content-heavy static site on Cloudflare Workers best. Astro's npm latest is 7.4.12, and 7.0 shipped on 22 June 2026. It ships zero JavaScript by default and has MDX, content collections, a sitemap with hreflang, built-in i18n routing, an image pipeline and a first-party Cloudflare adapter.
- **TanStack Start:** 1.0 went stable on 13 October 2026 (RC on 23 September 2025). It prerenders, has an SPA mode and deploys to Workers through the Vite plugin. For marketing content it leaves MDX, hreflang and image optimisation to you, and I found no build-speed numbers for it.
- **Single framework vs split:** for this brief the split wins. The room SPA runs on the VPS and gets little from Start's server features, while the marketing site needs what Astro is built for. Recommended: Astro 7 for marketing on Workers, plus a Vite SPA (TanStack Router optional) for the room app, both consuming one React 19 + Base UI design-system package. Confidence: medium-high. The single-framework option is defensible only if marketing stays small (about a dozen pages, no MDX, no i18n).

## Versions, dates, maturity

| Piece | Current (npm latest, 18 Nov 2026) | Key dates | Maturity |
|---|---|---|---|
| astro | 7.4.12 | 6.0 on 10 Mar 2026; 7.0 on 22 Jun 2026; 7.2 on 6 Aug; 7.4 on 15 Oct | Stable major; minors every 1-2 months |
| @astrojs/cloudflare | 14.4.8 | New versions require astro@^7.4.0 | Stable; runs workerd at every stage since 6.0 |
| @astrojs/react | 7.1.9 | v7.0.0 removed the babel option | Stable |
| @astrojs/sitemap | 3.7.5 | Sitemap i18n and chunks options present | Stable |
| @tanstack/react-start | 1.169.5 | 1.0 stable 13 Oct 2026; RC 23 Sep 2025 | 1.0 with an explicit API commitment |
| vite | 8.3.8 | Vite 8 ships Rolldown; Astro 7 is built on Vite 8 | Stable |
| @base-ui/react | 1.9.0 | 1.0.0 on 11 Dec 2025; 1.9.0 on 9 Oct 2026 | v1; 35 components; minors roughly every 1-2 months |

**Licences:** Astro is MIT (Astro blog). I did not check the licences of TanStack, Base UI or @astrojs/cloudflare in this run.

**Ownership:** The company behind Astro joined Cloudflare, announced 16 January 2026. Astro says it stays open source, MIT-licensed and actively maintained. The roadmap now sits with one commercial owner. That is a governance risk to weigh, not a current defect.

**Release cadence:** Astro 6.0 (10 Mar 2026) moved to Vite 7 and rebuilt the Cloudflare adapter so that dev, prerendering and production all run in workerd. Astro 7.0 (22 Jun 2026) brought a Rust `.astro` compiler, Sätteri as the default Markdown/MDX pipeline, queued rendering and route caching as stable features, and Vite 8. The Rust compiler is a breaking change: it no longer silently fixes HTML, unclosed tags are errors, and whitespace between inline elements collapses the JSX way. Astro 7.2 added experimental incremental static builds. Astro 7.4 (15 Oct 2026) added `--timings`, separate build and runtime image services, and experimental parallel prerendering.

TanStack Start went from RC to 1.0 in about 13 months. Its own post says it has been used in production since before the RC, and it reports roughly 5.5x SSR throughput from profiling work. That is a runtime benchmark, not a build benchmark.

## Static prerendering and build speed

- **Astro:** static output is the default. Astro's own benchmarks on an M4 Pro (vendor-run, Astro 7 vs before): docs.astro.build 6,313 pages 114.54s to 73.53s; astro.build ~308 pages 62.70s to 24.24s; developers.cloudflare.com 8,431 pages 386.89s to 261.94s. Astro claims 15-61% faster builds overall. Queued rendering is about 2.4x faster on expression-dense pages, and static pages see less gain.
- **TanStack Start:** the `prerender` option is off by default (`enabled: false`). When on, it has `crawlLinks` (default true), `concurrency` (default 14), `retryCount` 2, `failOnError` true and `autoStaticPathsDiscovery`. Dynamic routes are only prerendered if a crawled link reaches them, or if listed in `pages`.
- **SPA mode:** with `spa.enabled`, the build prerenders only the root shell to `/_shell.html`. Unmatched URLs need a rewrite to that shell on the host. Other routes can be prerendered too, and the docs recommend prerendering as much as possible. Per-route `ssr: false` is also supported.
- **Build speed verdict:** Vite 8 with Rolldown is now common to both, so the bundler gap is smaller than it was. Astro's measurable edge is its Rust Markdown and `.astro` pipeline and its prerender queue. I found no TanStack Start build-time benchmark on a comparable content site, so I cannot quantify the difference.

## Content collections and MDX

- **Astro:** content collections are build-time by default, with loaders for Markdown, MDX, Markdoc, YAML, TOML and JSON. Astro's docs say you should use build-time collections when you need MDX or image optimisation. Live collections (stable in 6.0) fetch at request time but do not support MDX. Markdown and MDX run through Sätteri by default. Remark/rehype plugins still work via the `unified` processor.
- **TanStack Start:** I found no first-party content collections. Its Markdown guide uses the third-party `content-collections` package with a Vite plugin. TanStack Markdown is a new renderer that explicitly does not execute MDX or implement every CommonMark/GFM feature. So MDX on TanStack means a separate plugin you would need to verify.

For a guides/blog-heavy marketing site, Astro is the lower-risk choice here.

## React 19 islands, Base UI, Tailwind 4, React Compiler

- **Astro islands:** `@astrojs/react` hydrates only the components you mark as islands. Everything else is static HTML. This suits a marketing page where only the live demo needs JavaScript. The Astro React docs describe mixing frameworks and client hydration directives.
- **React Compiler on Astro:** experimental. `@astrojs/react` uses Oxc by default. `compiler: true` turns on the experimental Oxc React Compiler. The Babel option was removed in v7.0.0; custom Babel transforms now go through `@rolldown/plugin-babel` in `vite.plugins`.
- **TanStack Start:** the whole app is React, so the compiler applies everywhere. I did not verify the exact Start compiler setup in this run.
- **Base UI:** v1.0.0 (11 Dec 2025) is stable with 35 components. Its release notes show SSR work in 1.0.0-beta.3, a `use client` directive fix in rc.0, and an RSC hotfix for popups in beta.6. Both frameworks SSR the components first, so the design-system package must render cleanly on the server.
- **Tailwind 4:** not checked in this run. Both stacks integrate through Vite, so I expect no blocker, but this is unverified.

## Image optimisation

- **Astro:** `astro:assets` handles optimisation. Astro 7.4 lets you set `image.service.build` (for prerendered pages and dev, e.g. Sharp) and `image.service.runtime` (for on-demand pages and the image endpoint) separately. Since 7.4, `@astrojs/cloudflare` runs prerendered images through the same pipeline as other adapters. The 2026 PR made build-time transforms with the workerd Images binding the default for the Cloudflare adapter.
- **TanStack Start:** I found no first-party image optimisation in the docs I read. Cloudflare Images exists as a separate product. Community threads mention Unpic, but that is an unread snippet.

## SEO

- **Sitemap:** `@astrojs/sitemap` writes `sitemap-index.xml` and numbered sitemaps, with `entryLimit` defaulting to 45,000 entries per file. It supports `filter`, `serialize`, `chunks`, and `customSitemaps` for external sitemaps.
- **hreflang in Astro:** the sitemap `i18n` option emits `xhtml:link rel=alternate hreflang` entries for each locale in each URL's alternates.
- **TanStack Start sitemap:** built-in generation at build time with `sitemap: { enabled: true, host }` alongside prerender `crawlLinks`. Static or server-route sitemaps are the documented alternatives.
- **TanStack head API:** the route `head()` function sets `title`, `meta`, `links` (canonical), and `scripts` (JSON-LD). The docs show all of these. hreflang has no documented helper; it would be hand-written in `links` (my inference, not a documented pattern).
- **Canonical and JSON-LD on Astro:** canonical is set in the layout and JSON-LD via `<script type="application/ld+json">`; I did not read an Astro doc for these, so treat as unverified.

## i18n

- **Astro:** i18n routing is built in (Astro docs describe it as added in v4), with `getRelativeLocaleUrl()` helpers and a sitemap `i18n` option for hreflang.
- **TanStack Start:** no built-in i18n. The Router docs point to Paraglide, using a router `rewrite` for locale in and out, plus server-side locale resolution. Third-party guides exist (use-intl, Paraglide setups), but they are secondary.

## View transitions

- **Astro:** opt-in. `<ClientRouter />` gives SPA-like navigation with `transition:name`, `transition:animate`, and `transition:persist`, fallbacks for unsupported browsers, and automatic `prefers-reduced-motion` handling. Browser-native cross-document view transitions also work for MPA navigation without the router.
- **TanStack Start:** `defaultViewTransition` on the router (boolean or `ViewTransitionOptions` with `types`) wraps navigations in `document.startViewTransition`. I did not verify cross-document (MPA) support or persistent elements.

## Cloudflare adapter state

- **Astro:** Cloudflare recommends Workers for new projects. Static sites need only `wrangler.jsonc` with an `assets` directory (Workers static assets, no worker code). On-demand rendering uses `main: @astrojs/cloudflare/entrypoints/server` with `nodejs_compat`. Known issue: client hydration mismatches can come from Cloudflare's Auto Minify, which must be disabled. Route caching is stable in Astro 7, and `cacheCloudflare()` from `@astrojs/cloudflare/cache` is an experimental CDN provider.
- **TanStack Start:** the Cloudflare guide (last updated 5 Nov 2026) uses `npm create cloudflare@latest -- --framework=tanstack-start`, or `wrangler deploy` in an existing project, which auto-detects Start. It requires `@cloudflare/vite-plugin` with `viteEnvironment: { name: 'ssr' }` and `main: @tanstack/react-start/server-entry`. Cloudflare says Rsbuild-based Start projects are not supported and must move to Vite. The guide has sections on static prerendering and on custom entrypoints for Queues and Cron.

Both Cloudflare paths are first-party and current. Astro's adapter is the more mature for static-first output.

## Single-framework option vs split

**Single framework (TanStack Start prerender for marketing, SPA mode for the app)**
- For: one router, one React runtime, one build config, one design-system integration; `head()` covers SEO basics; built-in sitemap; a 1.0 API commitment; the live demo is just a route.
- Against: no first-party content collections or MDX; no documented hreflang or i18n helper; no first-party image pipeline; the marketing pages ship the Start/router runtime and hydrate by default, where Astro ships none; no build-time benchmark. The SPA-mode benefit is weak here because the room app is served from the VPS next to Elysia, so Start's server features go unused.

**Split (Astro 7 for marketing, Vite SPA for the room app)**
- For: each tool fits its job; marketing gets zero-JS output, MDX, collections, sitemap with hreflang, i18n routing, an image pipeline and a first-party Cloudflare adapter; the room app keeps a lean SPA with no SSR concerns.
- Against: two toolchains and two build outputs; the design system must build cleanly under Astro's islands and the Vite SPA; two React roots and two bundles; a shared-package boundary to maintain.

**Recommendation:** split. Astro 7 for marketing on Workers, a Vite SPA for the room app on the VPS, and one framework-neutral design-system package (Base UI + Tailwind 4 + React 19) consumed by both. Confidence: medium-high. Revisit the single-framework option only if the marketing site stays small.

## What must be decided now (cannot be retrofitted cheaply)

1. **Origins.** localStorage is per origin. If the marketing site and the room app are on different origins, the anonymous client id will not carry across the marketing demo and the app. Likewise, moving from the current Vercel origin to a new one loses existing users' ids unless a migration path is planned. Also decide the WebSocket origin allow-list and CORS for the VPS.
2. **URL scheme and i18n.** Locale prefixes, trailing-slash policy, canonical host and hreflang must be fixed before launch. Changing them later means redirects and SEO loss. Astro's sitemap i18n option makes hreflang a configuration choice, not hand-written code.
3. **Content format.** MDX vs Markdown and the collection schema. Choosing Astro means MDX is native; choosing TanStack means a third-party content layer.
4. **Design-system packaging.** Keep it SSR-safe and framework-neutral at the boundary: no browser-only code at import time, and clear `use client` boundaries. Base UI's SSR and RSC fixes are recent, so pin versions deliberately.
5. **React Compiler policy.** Astro's compiler integration is experimental. Decide whether the design system is compiled for both apps the same way (for example through the same Vite plugin) so the two bundles behave alike.
6. **Image service.** Choose build-time (Sharp or the Cloudflare binding) and runtime services now. Asset URL patterns are hard to change once shared.
7. **Analytics and telemetry origins.** Umami and OpenTelemetry endpoints need a CORS and privacy decision for the marketing origin before pages are indexed.

## Open or uncertain

- TanStack Start build-time numbers and any Start-specific prerender benchmarks.
- TanStack hreflang/i18n helpers and cross-document view transitions.
- Licences for TanStack, Base UI and @astrojs/cloudflare.
- Tailwind 4 and React 19 specifics for each framework.
- Community experience: I found only search snippets, not full threads, so there is no solid consensus on production marketing sites either way.
- Cloudflare Workers pricing and limits for static assets; the exact Cloudflare image service behind Astro's runtime option.
- Astro's canonical-link and JSON-LD guidance, which I did not read directly.

## Not verified in this run

- TanStack Start build-time performance on a content-heavy site (no benchmark found; Astro's numbers are vendor-run): No comparable build benchmark found in the pages read.
- TanStack Start hreflang and i18n helpers beyond Paraglide routing: Only the search snippet was read; no documented hreflang helper was found in the Start SEO docs.
- TanStack Router view transitions for cross-document (MPA) navigation and persistent elements: Only the option description was read from a search snippet.
- Licences of TanStack, Base UI and @astrojs/cloudflare: Licence pages were not read in this run.
- Tailwind 4 integration details for Astro and TanStack Start: Not checked in this run.
- React 19 versions and React Compiler setup in TanStack Start: Not checked in this run; only Astro's compiler integration was read.
- TanStack Start image optimisation options: Only a search snippet of a community thread was seen; no first-party image optimisation found in the Start docs read, and Cloudflare Images integration is unverified.
- Astro canonical-link and JSON-LD guidance: The Astro docs for these were not read.
- Astro 7.2 incremental builds and Astro 7.4 parallel prerendering in practice: Only the 7.2 search snippet was read; the parallel-prerendering claim comes from the 7.4 post and is experimental.
- Community experience with Astro vs TanStack Start for marketing sites: Only search snippets of threads were seen; no full thread was read, so there is no consensus evidence.
- Cloudflare Workers static-assets pricing and limits; which image service backs the Astro runtime option: Not checked in this run.
- MDX support for TanStack Start through a plugin: The docs say TanStack Markdown does not run MDX; a separate MDX plugin path was not verified.

## Sources

- https://tanstack.com/blog/tanstack-start-1-0
- https://blog.cloudflare.com/astro-joins-cloudflare/
- https://astro.build/blog/astro-7/
- https://astro.build/blog/astro-740/
- https://astro.build/blog/astro-6/
- https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering
- https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode
- https://tanstack.com/start/latest/docs/framework/react/guide/hosting
- https://tanstack.com/start/latest/docs/framework/react/guide/seo
- https://tanstack.com/start/latest/docs/framework/react/guide/rendering-markdown
- https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/
- https://docs.astro.build/en/guides/deploy/cloudflare/
- https://docs.astro.build/en/guides/integrations-guide/sitemap/
- https://docs.astro.build/en/guides/view-transitions/
- https://docs.astro.build/en/guides/content-collections/
- https://docs.astro.build/en/guides/integrations-guide/react/
- https://base-ui.com/react/overview/releases
- https://www.npmjs.com/package/astro
- https://www.npmjs.com/package/@tanstack/react-start
- https://www.npmjs.com/package/@astrojs/cloudflare
- https://www.npmjs.com/package/@base-ui/react
- https://www.npmjs.com/package/vite
