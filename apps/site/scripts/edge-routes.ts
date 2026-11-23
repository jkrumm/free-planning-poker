import { routeChanges, type Route } from '../src/lib/edge-routes.ts'
import { siteOrigin } from '../src/lib/site.ts'

// Makes the zone hold a Workers route with no Worker for /room*, /_room/* and /api/* of one host, so those paths reach
// the API through the tunnel while the Worker serves the rest (docs/shipping.md, Site). Idempotent: run before every
// wrangler deploy, so the Worker's <host>/* route never exists without them. Reads CLOUDFLARE_API_TOKEN (cf-deploy:
// Workers Routes edit and Zone read) from the environment and prints no token, id or account.

const api = 'https://api.cloudflare.com/client/v4'

function fail(message: string): never {
  console.error(`edge-routes: ${message}`)
  process.exit(1)
}

const hostFlag = process.argv.indexOf('--host')
const host = hostFlag === -1 ? undefined : process.argv[hostFlag + 1]
if (host === undefined || host === '')
  fail('usage: bun apps/site/scripts/edge-routes.ts --host <hostname>')
const token = process.env.CLOUDFLARE_API_TOKEN
if (token === undefined || token === '') fail('CLOUDFLARE_API_TOKEN is not set')

type Envelope<T> = { success: boolean; errors: { code: number; message: string }[]; result: T }

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${api}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  })
  const body = (await response.json()) as Envelope<T>
  if (!body.success)
    fail(
      `${init.method ?? 'GET'} ${path.split('?')[0]?.replace(/[0-9a-f]{32}/g, '<id>')}: ${JSON.stringify(body.errors)}`,
    )
  return body.result
}

const zoneName = new URL(siteOrigin).hostname
const zones = await call<{ id: string }[]>(`/zones?name=${zoneName}`)
const zone = zones[0]?.id ?? fail(`no zone ${zoneName} for this token`)
const routes = await call<Route[]>(`/zones/${zone}/workers/routes`)
const changes = routeChanges(routes, host)

for (const change of changes) {
  if (change.action === 'create') {
    await call(`/zones/${zone}/workers/routes`, {
      method: 'POST',
      body: JSON.stringify({ pattern: change.pattern }),
    })
    console.log(`edge-routes: created ${change.pattern} with no Worker`)
  } else {
    await call(`/zones/${zone}/workers/routes/${change.id}`, {
      method: 'PUT',
      body: JSON.stringify({ pattern: change.pattern }),
    })
    console.log(`edge-routes: detached ${change.script} from ${change.pattern}`)
  }
}
if (changes.length === 0) console.log(`edge-routes: ${host} already has its routes with no Worker`)
