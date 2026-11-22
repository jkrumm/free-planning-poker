/**
 * The paths of a host that belong to the API's container (docs/v9/ARCHITECTURE.md, Topology). Each gets a Workers route
 * with no Worker: the most specific route wins, so these send their requests past Workers to the tunnel and Traefik,
 * while the Worker's `<host>/*` route takes everything else.
 */
export const apiPaths = ['/room*', '/_room/*', '/api/*'] as const

/** A Workers route as the Cloudflare API lists it; `script` is absent or empty on a route with no Worker. */
export type Route = { id: string; pattern: string; script?: string | null }

export type RouteChange =
  | { action: 'create'; pattern: string }
  | { action: 'detach'; id: string; pattern: string; script: string }

export function bypassPatterns(host: string): string[] {
  return apiPaths.map((path) => `${host}${path}`)
}

/** What makes the zone hold a route with no Worker for every API path of the host; other routes are left alone. */
export function routeChanges(existing: Route[], host: string): RouteChange[] {
  const changes: RouteChange[] = []
  for (const pattern of bypassPatterns(host)) {
    const route = existing.find((candidate) => candidate.pattern === pattern)
    if (route === undefined) changes.push({ action: 'create', pattern })
    else if (route.script)
      changes.push({ action: 'detach', id: route.id, pattern, script: route.script })
  }
  return changes
}
