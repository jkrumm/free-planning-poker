import { createRouter, type RouterHistory } from '@tanstack/react-router'
import { NotFound } from './features/lobby/not-found.tsx'
import { routeTree } from './routeTree.gen.ts'

/** The app's router; a test passes a memory history, the page uses the browser's. */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    defaultNotFoundComponent: NotFound,
    ...(history === undefined ? {} : { history }),
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
