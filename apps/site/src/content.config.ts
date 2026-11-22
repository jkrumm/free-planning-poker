import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { entrySchema } from './lib/entry-schema.ts'

// The tests build against test/fixtures/content; a real build reads src/content.
const root = process.env.FPP_SITE_CONTENT ?? './src/content'

const section = (name: string) =>
  defineCollection({
    loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: `${root}/${name}` }),
    schema: entrySchema,
  })

export const collections = {
  guides: section('guides'),
  glossary: section('glossary'),
  vs: section('vs'),
  blog: section('blog'),
  docs: section('docs'),
}
