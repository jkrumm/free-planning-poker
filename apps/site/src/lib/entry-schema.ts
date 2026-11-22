import { z } from 'astro/zod'

/** The one schema of every collection: guides, glossary, vs, blog and docs. */
export const entrySchema = z.object({
  title: z.string(),
  description: z.string(),
  published: z.coerce.date(),
  updated: z.coerce.date().optional(),
  draft: z.boolean().default(false),
  questions: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
})

export type EntryData = z.infer<typeof entrySchema>
