/**
 * The room app's build: assets under /_room/ with hashed names, the shell at dist/index.html. The API serves both
 * (docs/v9/ARCHITECTURE.md, Topology); the dev server answers /room* with the shell and hands /api to the API.
 */
import babel from '@rolldown/plugin-babel'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { lingui } from '@lingui/vite-plugin'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import { umamiScriptTags } from '@fpp/telemetry/umami-script'

/**
 * Umami's two tags in the shell's head, from the build's public `FPP_UMAMI_WEBSITE_ID` and `FPP_UMAMI_DOMAINS`; no tag
 * when the id is unset, as in a self-hosted build. The same text the site renders (packages/telemetry).
 */
function umami(): Plugin {
  const tags = umamiScriptTags({
    websiteId: process.env.FPP_UMAMI_WEBSITE_ID,
    domains: process.env.FPP_UMAMI_DOMAINS,
  })
  return {
    name: 'umami-script',
    transformIndexHtml: (html) =>
      tags === '' ? html : html.replace('</head>', () => `${tags}</head>`),
  }
}

/** In the dev server a room address is the shell, as the API answers it in production. */
function shellForRooms(): Plugin {
  return {
    name: 'room-shell',
    configureServer: (server) =>
      void server.middlewares.use((request, _response, next) => {
        if (request.url !== undefined && /^\/room(\/|\?|$)/.test(request.url))
          request.url = '/_room/index.html'
        next()
      }),
  }
}

export default defineConfig({
  base: '/_room/',
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: false }),
    react(),
    lingui({
      configPath: resolve(import.meta.dirname, '../../packages/i18n/lingui.config.ts'),
      macroTransform: true,
    }),
    babel({ presets: [reactCompilerPreset()] }),
    shellForRooms(),
    umami(),
  ],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { port: 7739, proxy: { '/api': { target: 'http://localhost:7740', ws: true } } },
  build: { outDir: 'dist', emptyOutDir: true },
})
