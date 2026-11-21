# Astro 7: language routing for a partly translated static site

Research run of 2026-11-21 (`agw research`, depth standard). Run status: partial. Citations grounded against fetched pages: 8/12. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line

1. **Config keys:** The i18n keys you use (`i18n.locales`, `i18n.defaultLocale`, `routing.prefixDefaultLocale`, `routing.redirectToDefaultLocale`, `i18n.fallback`, `routing.fallbackType`) are unchanged in the current Astro docs. The Astro v7 migration guide lists no i18n change. The routing defaults changed in v6, so set the flags explicitly.
2. **Partial translation:** Put only the landing pages under `src/pages/de/`, `/es/`, `/fr/`, `/zh/`, and leave `i18n.fallback` unset. Without a fallback, a missing `/de/blog/...` URL is a 404 and no page is generated.
3. **hreflang and sitemap:** Each landing version lists itself and every other version, plus `x-default` pointing at the English home page. English-only articles carry no alternates. `@astrojs/sitemap`'s `i18n` option produces the `xhtml:link` alternates from page paths, but its documented output shows no `x-default`.
4. **Collections:** Astro 6 removed legacy collections, so everything uses the Content Layer API with `src/content.config.ts`. A per-locale folder layout with a glob loader is my suggestion; I did not verify it against a docs page.
5. **Paraglide:** npm `@inlang/paraglide-js` is at 3.2.2. Its docs show one `project.inlang` catalogue feeding a React+Vite plugin and an Astro setup. I could not confirm Astro 7 static support.
6. **Language detection:** Use a visible language link or a non-blocking banner, not an automatic redirect. Browser-language detection in Astro is only available for on-demand pages.

## 1. Routing config, and what changed to Astro 7

- **`i18n.locales` / `i18n.defaultLocale`:** Documented as before. Example: `locales: ["es", "en", "pt-br"]`, `defaultLocale: "en"`. Folder names under `src/pages/` must match the locale strings exactly.
- **`routing.prefixDefaultLocale`:** Default `false`. With `false`, `src/pages/about.astro` produces `/about/` and `src/pages/fr/about.astro` produces `/fr/about/`. With `true`, every locale including the default needs a folder, and `index.astro` remains required at the root. This is the mode you want (English unprefixed, so `prefixDefaultLocale: false`).
- **`routing.redirectToDefaultLocale`:** Default `false`, added in 4.2.0. It only applies when `prefixDefaultLocale: true`; it redirects `/` to `/[defaultLocale]/`. It does nothing for your setup.
- **`i18n.fallback` and `routing.fallbackType`:** Covered in section 2. `fallbackType` takes `redirect` (default) or `rewrite`.
- **Changed in v6:** The v6 guide (read as a docs-tool excerpt, not the full page) says to set `prefixDefaultLocale` and `redirectToDefaultLocale` explicitly "to maintain previous i18n routing behavior". The current configuration reference lists both defaults as `false`. I could not read the full v6 i18n section, so the exact default that changed is open. Set both flags explicitly in your config.
- **Changed in v7 (read in full, no i18n item):** Node 22 is required (v6 guide: 22.12.0 or higher). Vite 8 replaces Vite 7. The Rust compiler is the only compiler and rejects unclosed tags. `compressHTML` now defaults to `'jsx'`, so `<span>hello</span><em>world</em>` renders as `helloworld`; add `{" "}` or set `compressHTML: true`. Sätteri is the default Markdown pipeline; remark and rehype plugins need porting, or you can keep them with `@astrojs/markdown-remark` and `markdown.processor: unified()`. `advancedRouting` is on by default and `src/fetch.ts` is a reserved filename. Experimental `cache` and `routeRules` moved out of the experimental block. `@astrojs/db` was removed.
- The Astro 7.4 point release from your background was not checked.

## 2. Partial translation without fallback duplicates

Layout:
- English, unprefixed: `src/pages/index.astro`, `src/pages/blog/...`, `src/pages/guides/...`, `src/pages/docs/...`
- Translated landing: `src/pages/de/index.astro`, `src/pages/es/index.astro`, `src/pages/fr/index.astro`, `src/pages/zh/index.astro`

Do not set `i18n.fallback`. The docs say that configuring `fallback` (for example `{ fr: "es" }`) makes Astro "ensure that a page is built in src/pages/fr/ for every page that exists in src/pages/es/". That is the mechanism that generates the extra pages. Without it, missing localized URLs return 404 and nothing is generated.

If you did want fallback: `redirect` (default) makes a route that redirects to the other locale's URL. `rewrite` serves the other locale's content under the localized URL, which duplicates content. Avoid `rewrite` for this site. I did not verify how the redirect is emitted in static output (redirect file, meta refresh, or Cloudflare rules).

For the language switcher on `/de/`, link to the English article when no German version exists. The docs provide `getRelativeLocaleUrl()` from `astro:i18n` for building localized links.

## 3. hreflang, x-default, sitemap

**What Google says** (Localized Versions page, last updated 2026-09-21):
- Each language version must list itself and all other versions. If page X links to Y without a return link, the annotations may be ignored.
- If maintaining a full set is hard, you can omit some languages on some pages; Google still processes the pairs that point to each other.
- `x-default` is "for unmatched languages"; Google suggests it "especially on language/country selectors or auto-redirecting home pages" and notes it "was designed for language selector pages".
- HTML `<link>`, HTTP headers and sitemap `xhtml:link` are equivalent to Google.
- Localized versions only count as duplicates if the main content is untranslated, so a partially translated site is not penalised for the missing articles.
- Use ISO 639-1 language codes. Google accepts `zh-Hans` for Simplified Chinese.

**Landing page `<head>`, identical on every version:**
```
<link rel="alternate" hreflang="en" href="https://example.com/" />
<link rel="alternate" hreflang="de" href="https://example.com/de/" />
<link rel="alternate" hreflang="es" href="https://example.com/es/" />
<link rel="alternate" hreflang="fr" href="https://example.com/fr/" />
<link rel="alternate" hreflang="zh-Hans" href="https://example.com/zh/" />
<link rel="alternate" hreflang="x-default" href="https://example.com/" />
```
The English home page serves as `x-default`, since there is no separate selector page. Inference from Google's guidance.

**English-only articles:** No alternate links needed. A self-referencing `en` link is optional. I would not add `x-default` to articles, since Google designed it for selector pages. Inference.

**`@astrojs/sitemap` (v3.7.6) `i18n` option:** The option takes `defaultLocale` (must be a key of `locales`) and `locales`, a map from path segment to language tag. Example from the docs: `i18n: { defaultLocale: 'en', locales: { en: 'en-US', es: 'es-ES', fr: 'fr-CA' } }`. Each `<url>` gets `xhtml:link rel="alternate"` entries. For this site, use `{ defaultLocale: 'en', locales: { en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR', zh: 'zh-Hans' } }`. Caveats:
- The docs' example output has no `x-default`. Adding it through `serialize()` by pushing a `{ hreflang: 'x-default', url }` entry to `item.links` is plausible from the `LinkItem` type, but I did not test it.
- The integration lists only pages it builds, so absent German articles get no entries. I did not verify its output for a page missing in some locales; check the built `sitemap-0.xml`.

**Machine translation:** Google's primary page on this was not read. A secondary search snippet (marschfahrt.de, 2026-11-09) says Google's docs since June 2025 treat machine translation as not spam in itself. The spam policy's scaled-content-abuse rule covers generating many pages mainly to manipulate rankings. Treat these as unverified. Human-review the five landing translations before publishing.

## 4. Content collections

- Astro 6 removed the legacy collections API and the `legacy.collections` flag. All collections use the Content Layer with `src/content.config.ts`. Loaders are imported from `astro/loaders`, for example `glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/data/blog' })`.
- The v7 guide does not change collections.
- Suggested per-locale layout (inference; no collection docs read): one collection per content type. English articles stay unprefixed, for example `src/content/guides/*.md`. Translated landing copy lives in `src/content/landing/de.md`, `es.md`, `fr.md`, `zh.md`, with a `lang` field in the schema. Set the glob pattern per collection so IDs come from the path.
- Alternatively, keep the short landing-page strings in the Paraglide catalogue (section 5) and use collections only for the Markdown content.

## 5. Paraglide JS

- Latest npm version: `@inlang/paraglide-js` 3.2.2.
- Docs excerpts (Context7, source `github.com/generaltranslation/paraglide-js`; I did not verify that this is the official inlang repository): a React+Vite `vite.config.ts` adds `paraglideVitePlugin({ project: './project.inlang', outdir: './src/paraglide', emitTsDeclarations: true })`. The same `project.inlang` catalogue can feed an Astro build, so one message catalogue is the intended model.
- The Astro example in that README adds the same plugin under `vite.plugins`, sets `output: 'server'` with the Node adapter, and adds `paraglideMiddleware` in `src/middleware.ts`. That is an SSR setup, not a static one. Drop the server parts for a static build; I did not verify that path.
- Astro 7 compatibility: not verified. Astro 7 uses Vite 8 (v7 guide), and I did not check Paraglide's compatibility with Vite 8. Run a static build with the plugin before committing.

## 6. Language detection without a server

- The Astro docs say `Astro.preferredLocale` and `Astro.preferredLocaleList` (from `Accept-Language`) work on "pages rendered on demand". All pages, including prerendered ones, get only `Astro.currentLocale`, which comes from the URL. A static build has no request headers, so automatic detection needs a server or edge function.
- Recommended pattern: no automatic redirect. On the English home page, show a visible language list (`Deutsch / Español / Français / 中文`) or a dismissible banner that offers the matching localized home. Make the choice persistent with a cookie or localStorage if you want (inference).
- Why: a client-side redirect runs after the page loads, so it is slower, can flash, and breaks the back button. Google's guidance frames `x-default` as the fallback for unmatched languages and suggests it for selector pages and auto-redirecting home pages. An English root that links to every version, with complete hreflang sets, lets users and crawlers reach each version without a redirect. The crawler point is inference.

## Not verified

- Exact i18n routing default changed in Astro v6 (prefixDefaultLocale / redirectToDefaultLocale): Fetching the v6 guide returned empty output and the budget ran out. Only a docs-tool excerpt was available.
- Google's current statement on machine-translated pages (2026) and its June 2025 documentation change: Only a secondary search snippet (marschfahrt.de) was seen. Google's spam-policy and content pages were not read.
- Whether @astrojs/sitemap i18n emits x-default, and how it handles a page missing in some locales: The docs do not show x-default output or partial coverage. Not tested with a build. Adding x-default via serialize() is untested.
- How static output emits fallback redirects (redirect file, meta refresh or Cloudflare rules): The i18n guide states the fallback behaviour but not the static output format. Not checked.
- Per-locale content collection layout in Astro 7: No collection-specific docs page was read for locale folders or IDs. The layout in section 4 is a suggestion.
- Paraglide JS support for Astro 7 static output and Vite 8: The Astro example is SSR and dates from an unknown Astro version. The example repo is not confirmed to be the official inlang repo. No static build was tested.
- Astro 7.4 (the version in the background) against the Astro 7 docs: The v7 guide does not name point versions. The 7.4 release notes were not checked.
- Language-detection redirect pattern and crawler behaviour: Google's page covers x-default and auto-redirecting home pages. It does not say that auto-redirects hide versions from crawlers; that point is inference.
- Astro v6 guide (docs excerpt): to maintain previous i18n routing behaviour, set routing.prefixDefaultLocale and routing.redirectToDefaultLocale explicitly, which indicates the routing defaults changed in v6. The exact changed default was not read.: cited, but the page was never retrieved this run
- Configuration reference: routing.redirectToDefaultLocale default false, added in 4.2.0, applies to the home URL when prefixDefaultLocale is true; fallbackType added in 4.15.0.: cited, but the page was never retrieved this run
- Paraglide React+Vite: paraglideVitePlugin({ project: './project.inlang', outdir: './src/paraglide', emitTsDeclarations: true }) in vite.config.ts; the Astro example adds the same plugin under vite.plugins with output 'server' and paraglideMiddleware in src/middleware.ts.: cited, but the page was never retrieved this run
- Paraglide Astro example uses output 'server' with the node adapter and paraglideMiddleware, an SSR setup.: cited, but the page was never retrieved this run

## Sources

- https://docs.astro.build/en/guides/upgrade-to/v7/
- https://docs.astro.build/en/guides/internationalization/
- https://docs.astro.build/en/guides/upgrade-to/v6/
- https://developers.google.com/search/docs/specialty/international/localized-versions
- https://docs.astro.build/en/guides/integrations-guide/sitemap/
- https://www.npmjs.com/package/@inlang/paraglide-js
- https://marschfahrt.de/en/blog/mehrsprachige-website-erstellen-hreflang-uebersetzung
- https://context7.com/withastro/docs
- https://context7.com/jasongitmail/super-sitemap
- https://context7.com/generaltranslation/paraglide-js
