# apps/site

The marketing site: Astro 7.4, static output, no look yet (basalt-ui 3 is not on npm). Contract: `docs/v9/ARCHITECTURE.md` (Topology, Stack), `docs/v9/UX.md` (The marketing site, Languages), `docs/v9/research/r25-astro7-i18n.md`. It runs on the beta host as a Worker with static assets and no Worker code, deployed by `deploy-site.yml` (`docs/shipping.md`, Site).

## Commands

- `make site` builds four outputs and runs `bun test apps/site` over them, about 15 s: `dist/production`, `dist/beta`, and the same two from `test/fixtures/content` (`dist/fixture-production`, `dist/fixture-beta`), which exist to test the draft rule. CI runs it as the job `site`, only when lane `site` changed.
- Astro runs on Bun (`bunx --bun astro build`): the CI job installs no Node. Tests named `*.site.test.ts` read `dist` and run in `make site` only; the other `*.test.ts` run in `make check-fast`.
- `No files found` warnings from the glob loader are expected while a collection has no content.
- Never start `astro dev`; prove a change with the built output and its tests.

## The draft rule

`FPP_SITE_TARGET` is the build-time variable of the target: `beta` or anything else, which is production. `FPP_SITE_CONTENT` (content root) and `FPP_SITE_OUT` (output directory) exist for the fixture builds of `make site` only; never set them in a deploy. `src/lib/entries.ts` (`sectionEntries`) is the only reader of the collections, and it drops drafts in production through `visibleEntries`. Read content through it and a draft gets no route and no index entry; on beta a draft is built with a draft line and `robots: noindex`. A section with nothing to show in a build gets no index page. A new list (`llms.txt`, a feed) reads through `sectionEntries` too. The sitemap is configured when the build starts, before `astro:content` exists, so `src/lib/content-index.ts` reads the same files and `src/lib/sitemap.ts` drops drafts through the same `visibleEntries`. `test/drafts.site.test.ts` fails if a draft's name appears in any production file.

## Facts about this setup

- **URLs.** `trailingSlash: 'never'` with `build.format: 'file'` writes `guide.html`, which Workers static assets serve at `/guide` with no redirect; a directory per page would redirect to `/guide/`. A translated landing page at `de/index.html` is served at `/de/`: check how `/de` behaves when `v9-site-landing-i18n` adds it.
- **Canonical** is built from `site: https://free-planning-poker.com`, in every build, beta included (`src/lib/canonical.ts`).
- **`compressHTML: true`**: Astro 7's default `jsx` removes white space between text and an inline element (`a<b>b</b>`); `test/whitespace.site.test.ts` fails on it.
- **Astro 7**: Vite 8, Sätteri as the Markdown pipeline with no remark or rehype plugin (one needs `@astrojs/markdown-remark` with `unified()`; prefer none), collections only as the Content Layer in `src/content.config.ts`, `src/fetch.ts` reserved (unused).
- **Languages.** `astro.config.ts` sets both routing flags to false and no `i18n.fallback`: a fallback would build a thin duplicate page in every language. A translated page is added whole, as `src/pages/<locale>/...`, by its own row; nothing redirects by browser language. `test/i18n.site.test.ts` holds this.
- **Zero JavaScript.** `test/scripts.site.test.ts` fails on any executable script, inline handler or emitted `.js` in any output unless `test/script-allowlist.ts` lists it with a reason. It lists the contact form's script and Umami's two tags, which `base.astro` renders when `FPP_UMAMI_WEBSITE_ID` is set (fixture builds set it); an inline script matches by its text. The row that adds a script adds its entry.
- **Links and budgets.** Every internal link and anchor must resolve (`/room*`, `/_room/*`, `/api/*` belong to other apps); a page is at most 12 kB gzip.
- **`/roadmap`.** Reads the repository `CHANGELOG.md` at build time through `src/lib/changelog.ts`: the newest five releases. A line the parser does not know fails the build with its line number. What is next is `src/data/next.ts`; the page never fetches at runtime.
- **Strings.** Navigation and footer text is in `src/strings.en.ts`; page bodies are content in the `.astro` files.
- **Legal pages.** Every figure `/privacy` prints is a fact in `src/lib/privacy-facts.ts`, backed by a constant in `apps/api/src/db/holds.ts` or a quoted sentence of `docs/v9/ARCHITECTURE.md`; `privacy-facts.test.ts` fails when either moves, so change the page's number there, not in the page. `/imprint` is v1's text (`test/fixtures/v1-imprint.ts`) and publishes no address or e-mail on purpose. The contact form's limits are v1's (`src/lib/contact.ts`); it posts to `POST /api/contact`, whose answers (`v9-api-contact`: 400, 429, 503, 502) `answerFor` maps to four messages.
- **`/self-hosting`.** Its `<pre data-commands>` blocks are what `selfhost.yml` runs; no braces or `<` inside one.
- **Blog.** `src/pages/blog/` builds `/blog` and `/blog/rss.xml` only while `sectionEntries('blog')` is non-empty; the footer links `/blog` on the same condition. The generic `[section]` route skips blog. `updated` is set by hand, when the body changes.

## The edge

- `wrangler.jsonc` deploys `dist/beta` as `fpp-site-beta` with no Worker code; `make site-deploy` runs only in CI. Adding Worker code (`main`, `run_worker_first`) makes every request it serves count against the free plan's 100,000 a day and drops `_headers` from its responses: set the headers in code then.
- `_headers` is written per build by `src/integrations/headers.ts` from `src/lib/headers.ts`, not kept in `public`: beta sets `X-Robots-Tag: noindex` on every path, production none (`test/headers.site.test.ts`). The security headers copy the API route's; change both together.
- `/room*`, `/_room/*` and `/api/*` never reach the Worker: `scripts/edge-routes.ts` keeps routes with no Worker for them.

## Crawl files

- `src/lib/robots.ts`: the crawler list, each token's source and read date above it; re-read the vendor page when the list changes. Served as `robots.txt`; every group disallows `/room`, `/_room/`, `/api/`.
- `/llms.txt` (`src/pages/llms.txt.ts`) and the `.md` twins: `src/pages/[section]/[...slug].md.ts` for entries, `src/pages/guide.md.ts` for the pillar.
- IndexNow: `make indexnow` (`scripts/indexnow.ts`) sends the URLs whose sitemap entry is new or whose lastmod moved, skips on beta, and `DRY_RUN=1` lists them; the key file `public/<key>.txt` is committed because the protocol serves it publicly. `deploy-site.yml` calls it after the deploy.

## Structured data and social images

Before changing `src/components/schema`, `src/layouts/base.astro` or `src/integrations`, Read `src/components/schema/AGENTS.md`.

## Content collections

Before changing `src/content/vs`, `src/content/glossary`, `src/content/guides` or `src/content/pillar`, Read `docs/site-content.md`: the rules for the comparisons, glossary entries, guides and the pillar page.

## Left out of v1's pages on purpose

The room form and screenshots of `/`, the Todoist board of `/roadmap`, the figures of `/analytics`, the footer's release tag, the icon and manifest links.
