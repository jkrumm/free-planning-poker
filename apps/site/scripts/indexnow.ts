import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  batches,
  changedUrls,
  indexNowBatchSize,
  indexNowBody,
  indexNowEndpoint,
  sitemapEntries,
} from '../src/lib/indexnow.ts'
import { siteOrigin } from '../src/lib/site.ts'
import { target } from '../src/lib/target.ts'

// Pings IndexNow with the production URLs that are new or changed since the last deploy: the diff of this build's
// sitemap and the live one, which is the previous deploy's. --dry-run prints the list and sends nothing.

function fail(message: string): never {
  console.error(`indexnow: ${message}`)
  process.exit(1)
}

if (target === 'beta') {
  console.log('indexnow: skipped on the beta target; the beta host is noindex and submits nothing')
  process.exit(0)
}

const built = join(import.meta.dir, '..', 'dist', 'production', 'sitemap-0.xml')
const current = sitemapEntries(
  await readFile(built, 'utf8').catch(() =>
    fail(`no production sitemap at ${built}: run make site first`),
  ),
)

const live = await fetch(`${siteOrigin}/sitemap-0.xml`)
if (!live.ok && live.status !== 404) fail(`the live sitemap answered ${live.status}; nothing sent`)
const previous = live.ok ? sitemapEntries(await live.text()) : new Map<string, string | undefined>()

const urls = changedUrls(previous, current)
if (urls.length === 0) {
  console.log('indexnow: no URL is new or changed since the last deploy')
  process.exit(0)
}

if (process.argv.includes('--dry-run')) {
  console.log(`indexnow: dry run, ${urls.length} URLs would be sent, none sent:`)
  for (const url of urls) console.log(url)
  process.exit(0)
}

for (const batch of batches(urls, indexNowBatchSize)) {
  const response = await fetch(indexNowEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: indexNowBody(batch),
  })
  if (!response.ok) fail(`IndexNow answered ${response.status} for ${batch.length} URLs`)
  console.log(`indexnow: sent ${batch.length} URLs, answered ${response.status}`)
}
