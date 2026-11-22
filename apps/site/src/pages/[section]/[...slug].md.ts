import type { APIRoute, GetStaticPaths } from 'astro'
import { sectionEntries, sections, type Section, type SectionEntry } from '../../lib/entries.ts'
import { siteOrigin } from '../../lib/site.ts'
import type { VsData } from '../../lib/entry-schema.ts'
import { twinMarkdown } from '../../lib/twin.ts'
import { vsTwinFacts } from '../../lib/vs.ts'

// The Markdown twin of every entry the section routes show: the same entries, at the same address plus .md.
export const getStaticPaths = (async () => {
  const paths = []
  for (const section of sections) {
    for (const entry of await sectionEntries(section)) {
      paths.push({ params: { section, slug: entry.id }, props: { section, entry } })
    }
  }
  return paths
}) satisfies GetStaticPaths

export const GET: APIRoute = ({ props }) => {
  const { section, entry } = props as { section: Section; entry: SectionEntry<Section> }
  const body = twinMarkdown({
    title: entry.data.title,
    address: `${siteOrigin}/${section}/${entry.id}`,
    updated: entry.data.updated ?? entry.data.published,
    body:
      section === 'vs'
        ? `${vsTwinFacts(entry.data as VsData)}\n\n${entry.body ?? ''}`
        : (entry.body ?? ''),
  })
  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } })
}
