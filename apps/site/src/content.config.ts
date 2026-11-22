import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { contentRoot } from './lib/content-root.ts'
import { entrySchema, glossarySchema } from './lib/entry-schema.ts'

// The tests build against test/fixtures/content; a real build reads src/content.
const root = contentRoot

const section = (name: string, schema: typeof entrySchema = entrySchema) =>
  defineCollection({
    loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: `${root}/${name}` }),
    schema,
  })

export const collections = {
  guides: section('guides'),
  glossary: section('glossary', glossarySchema),
  vs: section('vs'),
  blog: section('blog'),
  docs: section('docs'),
}
