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
  ],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { port: 7739, proxy: { '/api': { target: 'http://localhost:7740', ws: true } } },
  build: { outDir: 'dist', emptyOutDir: true },
})
