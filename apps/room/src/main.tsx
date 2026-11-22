/**
 * The app's entry file: reads the page's surroundings once, activates the person's language and mounts the router
 * (docs/v9/ARCHITECTURE.md, Client). Nothing else in the app touches `window`.
 */
import { createLocalStore, httpLookup, type ClientPorts } from '@fpp/room-client'
import { pickLanguage } from '@fpp/i18n'
import { I18nProvider } from '@lingui/react'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppEnvProvider, type AppEnv } from './app-env.tsx'
import { activatorOf, i18n } from './i18n.ts'
import { routeTree } from './routeTree.gen.ts'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const origin = window.location.origin
const randomFloat = (): number => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32

const ports: ClientPorts = {
  WebSocket,
  storage: window.localStorage,
  timers: {
    now: Date.now,
    setTimeout: (run, ms) => window.setTimeout(run, ms),
    clearTimeout: (handle) => window.clearTimeout(handle as number),
  },
  signals: {
    onOnline: (listener) => {
      window.addEventListener('online', listener)
      return () => window.removeEventListener('online', listener)
    },
    onVisible: (listener) => {
      const onChange = () => {
        if (document.visibilityState === 'visible') listener()
      }
      document.addEventListener('visibilitychange', onChange)
      return () => document.removeEventListener('visibilitychange', onChange)
    },
  },
  random: randomFloat,
  lookup: httpLookup({ origin, fetch: (url) => window.fetch(url) }),
}

const store = createLocalStore({ storage: ports.storage, now: Date.now, random: randomFloat })

const env: AppEnv = {
  ports,
  store,
  origin,
  fetch: (url, init) => window.fetch(url, init),
  hash: () => window.location.hash.slice(1),
  activate: activatorOf(
    import.meta.glob<{ readonly messages: Record<string, unknown> }>(
      '../../../packages/i18n/locales/*/*.po',
    ),
  ),
  newAvatar: () => crypto.randomUUID().slice(0, 8),
  reload: () => window.location.reload(),
}

// Nothing is shown before the language is: a message never flashes in the wrong one.
await env.activate(
  pickLanguage({ stored: store.prefs.get().language, browser: navigator.languages }),
)

const root = document.getElementById('root')
if (root === null) throw new Error('index.html has no #root')
createRoot(root).render(
  <StrictMode>
    <AppEnvProvider value={env}>
      <I18nProvider i18n={i18n}>
        <RouterProvider router={router} />
      </I18nProvider>
    </AppEnvProvider>
  </StrictMode>,
)
