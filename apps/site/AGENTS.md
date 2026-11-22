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
- **Zero JavaScript.** `test/scripts.site.test.ts` fails on any executable script, inline handler or emitted `.js` in any output unless `test/script-allowlist.ts` lists it with a reason. It lists one script, the contact form's (`src/scripts/contact-form.ts`, which Astro inlines into `contact.html`); `legal.site.test.ts` fails if another page carries one. The row that adds a script adds its entry.
- **Links and budgets.** Every internal link and anchor must resolve (`/room*`, `/_room/*`, `/api/*` belong to other apps); a page is at most 12 kB gzip.
- **Strings.** Navigation and footer text is in `src/strings.en.ts`; page bodies are content in the `.astro` files.
- **Legal pages.** Every figure `/privacy` prints is a fact in `src/lib/privacy-facts.ts`, backed by a constant in `apps/api/src/db/holds.ts` or a quoted sentence of `docs/v9/ARCHITECTURE.md`; `privacy-facts.test.ts` fails when either moves, so change the page's number there, not in the page. `/imprint` is v1's text (`test/fixtures/v1-imprint.ts`) and publishes no address or e-mail on purpose. The contact form's limits are v1's (`src/lib/contact.ts`); it posts to `POST /api/contact`, whose answers (`v9-api-contact`: 400, 429, 503, 502) `answerFor` maps to four messages.
- **Blog.** `src/pages/blog/` builds `/blog` and `/blog/rss.xml` only while `sectionEntries('blog')` is non-empty; the footer links `/blog` on the same condition. The generic `[section]` route skips blog. `updated` is set by hand, when the body changes.

## Where the later rows plug in

Structured data and social tags go into the `structured-data` and `social` slots of `src/layouts/base.astro`; the look replaces nothing in the markup. `questions` of an entry print as plain text until `v9-site-schema` marks them up.

## The glossary

`src/content/glossary` holds at most 15 terms (`src/lib/glossary.test.ts`); the title is the term, and the first sentence of the body must contain it. A link from one entry to another goes through `entryPath` or `visibleEntry` in `src/lib/entries.ts`, or `components/term-link.astro` in a page: frontmatter `related` and `guide` become links only where the target is shown in the build, so no published page links a draft and a missing cluster page leaves no broken link. `guide` names a cluster entry id of `guideClusters` (`src/lib/entry-schema.ts`); `v9-site-guide` must use those ids or change the list. DefinedTerm and DefinedTermSet are `components/schema/defined-term*.astro` over typed builders; the JSON-LD serialiser is `components/schema/json-ld.ts`.

## Left out of v1's pages on purpose

The room form and screenshots of `/` (no JavaScript, no images yet), the Todoist-backed board of `/roadmap`, the figures of `/analytics` (v1's invented fallbacks are not ported), the release tag in the footer (a link to the releases instead), and the icon and manifest links.
