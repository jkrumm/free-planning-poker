import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'
import { contentRoot } from './content-root.ts'
import { parseFrontmatter } from './frontmatter.ts'
import { type Section, sections } from './sections.ts'

/** An entry's address and the frontmatter that decides its draft state and dates. */
export type IndexedEntry = {
  section: Section
  id: string
  data: { draft: boolean; published: Date; updated: Date | undefined }
}

/**
 * Every entry file of every collection, read from its frontmatter. The sitemap is configured when the build starts,
 * before astro:content exists, so it reads the files the loader reads (the pattern of content.config.ts). Pages read
 * the collections through sectionEntries.
 */
export function readContentIndex(root: string = contentRoot): IndexedEntry[] {
  return sections.flatMap((section) => {
    const dir = join(root, section)
    if (!existsSync(dir)) return []
    return entryFiles(dir).map((rel) => indexed(section, dir, rel))
  })
}

// The glob loader's pattern: Markdown or MDX, the file name not starting with an underscore.
function entryFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((rel) =>
    /(^|\/)[^_/][^/]*\.mdx?$/.test(rel.split(sep).join('/')),
  )
}

function indexed(section: Section, dir: string, rel: string): IndexedEntry {
  const file = join(dir, rel)
  const { fields } = parseFrontmatter(readFileSync(file, 'utf8'))
  if (fields.published === undefined) throw new Error(`${file}: no published date`)
  // The loader slugifies ids: a name that is not already a slug would get another id in the pages than here, and the
  // draft filter would miss it. Fail the build instead.
  const id = rel
    .replace(/\.mdx?$/, '')
    .split(sep)
    .join('/')
  if (!/^[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(id))
    throw new Error(`${file}: the file name must be a lowercase slug`)
  return {
    section,
    id,
    data: {
      draft: fields.draft === 'true',
      published: new Date(fields.published),
      updated: fields.updated === undefined ? undefined : new Date(fields.updated),
    },
  }
}
