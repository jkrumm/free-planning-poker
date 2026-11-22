import rss from '@astrojs/rss'
import type { APIContext, GetStaticPaths } from 'astro'
import { sectionEntries } from '../../lib/entries.ts'

// The feed of the posts this build shows. Built only while there are some, like the index.
export const getStaticPaths = (async () => {
  const entries = await sectionEntries('blog')
  return entries.length === 0 ? [] : [{ params: { feed: 'rss' } }]
}) satisfies GetStaticPaths

export async function GET(context: APIContext) {
  if (context.site === undefined) throw new Error('astro.config.ts sets site; the feed needs it')
  const entries = await sectionEntries('blog')
  return rss({
    title: 'Free Planning Poker blog',
    description: 'Articles from the Free Planning Poker project.',
    site: context.site,
    // The site's addresses have no trailing slash (astro.config.ts, trailingSlash: 'never').
    trailingSlash: false,
    items: entries.map((entry) => ({
      title: entry.data.title,
      link: `/blog/${entry.id}`,
      pubDate: entry.data.published,
      description: entry.data.description,
    })),
  })
}
