import { getCollection, getEntry } from 'astro:content'
import { visibleEntries } from './drafts.ts'
import type { EntryData, GlossaryData, VsData } from './entry-schema.ts'
import type { Section } from './sections.ts'
import { target } from './target.ts'

export { sections } from './sections.ts'
export type { Section } from './sections.ts'

type SectionData = {
  guides: EntryData
  glossary: GlossaryData
  vs: VsData
  blog: EntryData
  docs: EntryData
}

export type SectionEntry<S extends Section> = { id: string; body?: string; data: SectionData[S] }

/** The entries of a section that this build shows, newest first. The only reader of the collections. */
export async function sectionEntries<S extends Section>(section: S): Promise<SectionEntry<S>[]> {
  // getCollection's name is a union here, so its entry type is too; every section's schema extends entrySchema.
  const all = (await getCollection(section)) as unknown as SectionEntry<S>[]
  return visibleEntries(all, target).toSorted(
    (a, b) => b.data.published.getTime() - a.data.published.getTime(),
  )
}

/** The pillar guide at /guide: published, and the same in every build. */
export async function pillarEntry(): Promise<SectionEntry<'guides'>> {
  const entry = await getEntry('pillar', 'guide')
  if (!entry) throw new Error('src/content/pillar/guide.md is missing')
  return entry as unknown as SectionEntry<'guides'>
}

/** One entry of a section if this build shows it. A link from one page to another entry goes through here or entryPath. */
export async function visibleEntry<S extends Section>(
  section: S,
  id: string,
): Promise<SectionEntry<S> | undefined> {
  return (await sectionEntries(section)).find((entry) => entry.id === id)
}

/** The path of an entry this build shows, else undefined: a published page never links a draft, and no link is broken. */
export async function entryPath(section: Section, id: string): Promise<string | undefined> {
  return (await visibleEntry(section, id)) === undefined ? undefined : `/${section}/${id}`
}
