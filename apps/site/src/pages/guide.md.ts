import { siteOrigin } from '../lib/site.ts'
import { twinMarkdown } from '../lib/twin.ts'
import { guideTwin } from '../twins/guide.ts'

export function GET(): Response {
  const body = twinMarkdown({
    title: guideTwin.title,
    address: `${siteOrigin}/guide`,
    updated: guideTwin.updated,
    body: guideTwin.body,
  })
  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } })
}
