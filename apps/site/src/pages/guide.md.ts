import { pillarEntry } from '../lib/entries.ts'
import { siteOrigin } from '../lib/site.ts'
import { twinMarkdown } from '../lib/twin.ts'

export async function GET(): Promise<Response> {
  const entry = await pillarEntry()
  const body = twinMarkdown({
    title: entry.data.title,
    address: `${siteOrigin}/guide`,
    updated: entry.data.updated ?? entry.data.published,
    body: entry.body ?? '',
  })
  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } })
}
