# apps/site

The marketing site: Astro 7.4, static output, no look yet (basalt-ui 3 is not on npm). Contract: `docs/v9/ARCHITECTURE.md` (Topology, Stack), `docs/v9/UX.md` (The marketing site, Languages), `docs/v9/research/r25-astro7-i18n.md`. The site is not deployed from here (`v9-edge-routing`).

## Commands

- `make site` builds four outputs and runs `bun test apps/site` over them, about 15 s: `dist/production`, `dist/beta`, and the same two from `test/fixtures/content` (`dist/fixture-production`, `dist/fixture-beta`), which exist to test the draft rule. CI runs it as the job `site`, only when lane `site` changed.
- Astro runs on Bun (`bunx --bun astro build`): the CI job installs no Node. Tests named `*.site.test.ts` read `dist` and run in `make site` only; the other `*.test.ts` run in `make check-fast`.
- `No files found` warnings from the glob loader are expected while a collection has no content.
- Never start `astro dev`; prove a change with the built output and its tests.

## The draft rule

`FPP_SITE_TARGET` is the build-time variable of the target: `beta` or anything else, which is production. `FPP_SITE_CONTENT` (content root) and `FPP_SITE_OUT` (output directory) exist for the fixture builds of `make site` only; never set them in a deploy. `src/lib/entries.ts` (`sectionEntries`) is the only reader of the collections, and it drops drafts in production through `visibleEntries`. Read content through it and a draft gets no route and no index entry; on beta a draft is built with a draft line and `robots: noindex`. A section with nothing to show in a build gets no index page. A new list (sitemap, `llms.txt`, a feed; `v9-site-crawl` wires `@astrojs/sitemap`, pinned here) reads through `sectionEntries` too; `test/drafts.site.test.ts` fails if a draft's name appears in any production file.

## Facts about this setup

- **URLs.** `trailingSlash: 'never'` with `build.format: 'file'` writes `guide.html`, which Workers static assets serve at `/guide` with no redirect; a directory per page would redirect to `/guide/`. A translated landing page at `de/index.html` is served at `/de/`: check how `/de` behaves when `v9-site-landing-i18n` adds it.
- **Canonical** is built from `site: https://free-planning-poker.com`, in every build, beta included (`src/lib/canonical.ts`).
- **`compressHTML: true`**: Astro 7's default `jsx` removes white space between text and an inline element (`a<b>b</b>`); `test/whitespace.site.test.ts` fails on it.
- **Astro 7**: Vite 8, Sätteri as the Markdown pipeline with no remark or rehype plugin (one needs `@astrojs/markdown-remark` with `unified()`; prefer none), collections only as the Content Layer in `src/content.config.ts`, `src/fetch.ts` reserved (unused).
- **Languages.** `astro.config.ts` sets both routing flags to false and no `i18n.fallback`: a fallback would build a thin duplicate page in every language. A translated page is added whole, as `src/pages/<locale>/...`, by its own row; nothing redirects by browser language. `test/i18n.site.test.ts` holds this.
- **Zero JavaScript.** `test/scripts.site.test.ts` fails on any executable script, inline handler or emitted `.js` in any output unless `test/script-allowlist.ts` lists it with a reason. It is empty; the row that adds a script adds its entry.
- **Links and budgets.** Every internal link and anchor must resolve (`/room*`, `/_room/*`, `/api/*` belong to other apps); a page is at most 12 kB gzip.
- **Strings.** Navigation and footer text is in `src/strings.en.ts`; page bodies are content in the `.astro` files.

## Where the later rows plug in

Structured data and social tags go into the `structured-data` and `social` slots of `src/layouts/base.astro`; the look replaces nothing in the markup. `questions` of an entry print as plain text until `v9-site-schema` marks them up.

## Left out of v1's pages on purpose

The room form and screenshots of `/` (no JavaScript, no images yet), the Todoist-backed board of `/roadmap`, the figures of `/analytics` (v1's invented fallbacks are not ported), the contact form (`v9-site-legal`), the release tag in the footer (a link to the releases instead), and the icon and manifest links.
