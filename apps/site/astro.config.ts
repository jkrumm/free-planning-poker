import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import { defineConfig } from 'astro/config'

// The one build-time variable: beta builds drafts, anything else is production, so a forgotten flag hides drafts.
const target = process.env.FPP_SITE_TARGET === 'beta' ? 'beta' : 'production'

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
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.endsWith('/404'),
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR', zh: 'zh-Hans' },
      },
    }),
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
