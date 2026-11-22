import { siteOrigin } from './site.ts'

// The key is public by design: IndexNow reads it from the site root, so it is committed as public/<key>.txt.
export const indexNowKey = '48f6f4777f9fc968c6aab529281e3f07'
// The global endpoint of the FAQ at indexnow.org (read 2026-11-22): it forwards to every participating engine.
export const indexNowEndpoint = 'https://api.indexnow.org/indexnow'
// IndexNow takes at most 10,000 URLs in one request.
export const indexNowBatchSize = 10_000

/** The URLs of a sitemap, each with its lastmod when it has one. */
export function sitemapEntries(xml: string): Map<string, string | undefined> {
  const entries = new Map<string, string | undefined>()
  for (const block of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const body = block[1] ?? ''
    const loc = /<loc>([^<]+)<\/loc>/.exec(body)?.[1]?.trim()
    if (loc === undefined) continue
    entries.set(loc, /<lastmod>([^<]+)<\/lastmod>/.exec(body)?.[1]?.trim())
  }
  return entries
}

/** The URLs that are new, or whose lastmod moved, since the previous deploy. */
export function changedUrls(
  previous: Map<string, string | undefined>,
  current: Map<string, string | undefined>,
): string[] {
  return [...current]
    .filter(([url, lastmod]) => !previous.has(url) || previous.get(url) !== lastmod)
    .map(([url]) => url)
}

export function batches<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export function indexNowBody(urls: string[]): string {
  return JSON.stringify({ host: new URL(siteOrigin).host, key: indexNowKey, urlList: urls })
}
