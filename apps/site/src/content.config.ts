import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { contentRoot, pillarRoot } from './lib/content-root.ts'
import { entrySchema, glossarySchema, vsSchema } from './lib/entry-schema.ts'

// The tests build against test/fixtures/content; a real build reads src/content.
const root = contentRoot

const section = (name: string, schema: typeof entrySchema = entrySchema) =>
  defineCollection({
    loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: `${root}/${name}` }),
    schema,
  })

export const collections = {
  // One entry, the pillar guide at /guide: src/content/pillar/guide.md. Read through pillarEntry in lib/entries.ts.
  pillar: defineCollection({
    loader: glob({ pattern: 'guide.md', base: pillarRoot }),
    schema: entrySchema,
  }),
  guides: section('guides'),
  glossary: section('glossary', glossarySchema),
  vs: section('vs', vsSchema),
  blog: section('blog'),
  docs: section('docs'),
}
