import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import { defineConfig } from 'astro/config'
import { socialImages } from './src/integrations/social-images.ts'
import { readContentIndex, readPillarDate } from './src/lib/content-index.ts'
import { siteOrigin } from './src/lib/site.ts'
import { sitemapOptions } from './src/lib/sitemap.ts'
import { resolveTarget } from './src/lib/target.ts'

// The same rule the content reader uses: beta builds drafts, anything else is production.
const target = resolveTarget(process.env.FPP_SITE_TARGET)

export default defineConfig({
  // Every build names production, so canonical links never point at the beta host (its noindex header is the edge's).
  site: siteOrigin,
  output: 'static',
  outDir: process.env.FPP_SITE_OUT ?? `dist/${target}`,
  // Workers static assets serve /guide from guide.html with no redirect; a directory per page would redirect to /guide/.
  trailingSlash: 'never',
  build: { format: 'file' },
  // Astro 7 defaults to 'jsx', which removes the space in "a <em>b</em>". 'true' collapses white space to one space.
  compressHTML: true,
  // @astrojs/sitemap (pinned in package.json): its filter and lastmod come from src/lib/sitemap.ts, read at build start.
  integrations: [
    mdx(),
    sitemap(sitemapOptions(target, readContentIndex(), readPillarDate())),
    socialImages(),
  ],
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
