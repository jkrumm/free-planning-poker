import { getCollection } from 'astro:content'
import { visibleEntries } from './drafts.ts'
import type { EntryData } from './entry-schema.ts'
import { target } from './target.ts'

export const sections = ['guides', 'glossary', 'vs', 'blog', 'docs'] as const
export type Section = (typeof sections)[number]

type SectionEntry = { id: string; data: EntryData }

/** The entries of a section that this build shows, newest first. The only reader of the collections. */
export async function sectionEntries(section: Section) {
  const all: SectionEntry[] = await getCollection(section)
  return visibleEntries(all, target).toSorted(
    (a, b) => b.data.published.getTime() - a.data.published.getTime(),
  )
}
