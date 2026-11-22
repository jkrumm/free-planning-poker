import mdx from '@astrojs/mdx'
import { defineConfig } from 'astro/config'
import { resolveTarget } from './src/lib/target.ts'

// The same rule the content reader uses: beta builds drafts, anything else is production.
const target = resolveTarget(process.env.FPP_SITE_TARGET)

export default defineConfig({
  // Every build names production, so canonical links never point at the beta host (its noindex header is the edge's).
  site: 'https://free-planning-poker.com',
  output: 'static',
  outDir: process.env.FPP_SITE_OUT ?? `dist/${target}`,
  // Workers static assets serve /guide from guide.html with no redirect; a directory per page would redirect to /guide/.
  trailingSlash: 'never',
  build: { format: 'file' },
  // Astro 7 defaults to 'jsx', which removes the space in "a <em>b</em>". 'true' collapses white space to one space.
  compressHTML: true,
  // @astrojs/sitemap is pinned in package.json and wired by v9-site-crawl, which owns the crawl files.
  integrations: [mdx()],
  i18n: {
    locales: ['en', 'de', 'es', 'fr', 'zh'],
    defaultLocale: 'en',
    // Both set explicitly: Astro 6 changed their defaults.
    routing: { prefixDefaultLocale: false, redirectToDefaultLocale: false },
    // No `fallback` on purpose: it builds a page in every language for every page of the default one, the thin
    // duplicate this site must not have. Without it a URL nobody translated is a 404, and a translated page is
    // added whole by its own row. A static build sees no Accept-Language header, so nothing redirects by language.
  },
})
