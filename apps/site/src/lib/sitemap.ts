import type { SitemapOptions } from '@astrojs/sitemap'
import type { IndexedEntry } from './content-index.ts'
import { visibleEntries } from './drafts.ts'
import { siteOrigin } from './site.ts'
import type { Target } from './target.ts'

// The room app and the API share the origin (ARCHITECTURE.md, invariant 1); the sitemap never lists them.
const notTheSite = /^\/(?:room|_room|api)(?:\/|$)/

const addressOf = (entry: IndexedEntry) => `/${entry.section}/${entry.id}`

/**
 * The sitemap's filter and lastmod. Drafts go through visibleEntries, the one draft rule, so production lists none.
 * lastmod is the entry's updated date, or its published date while it was never updated: it moves only when the content does.
 */
export function sitemapOptions(
  target: Target,
  entries: IndexedEntry[],
  pillarDate: Date,
): NonNullable<SitemapOptions> {
  const visible = new Set(visibleEntries(entries, target).map(addressOf))
  const known = new Set(entries.map(addressOf))
  // The pillar is the one entry of its own collection, not of a section: its date is passed in.
  const dated = new Map<string, Date>([
    ['/guide', pillarDate],
    ...entries.map(
      (entry) => [addressOf(entry), entry.data.updated ?? entry.data.published] as const,
    ),
  ])
  return {
    filter: (url) => {
      const path = new URL(url).pathname
      if (notTheSite.test(path)) return false
      return !known.has(path) || visible.has(path)
    },
    serialize: (item) => {
      const date = dated.get(new URL(item.url, siteOrigin).pathname)
      return date === undefined ? item : { ...item, lastmod: date.toISOString() }
    },
  }
}
