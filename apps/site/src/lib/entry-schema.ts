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

/**
 * The cluster pages under /guides/ that a glossary term points to (v9-site-guide writes them). The names are the
 * entry ids of the guides collection: a term whose cluster page is not in the build gets no link to it.
 */
export const guideClusters = ['decks', 'when-a-spread-means-split', 'large-rooms'] as const
export type GuideCluster = (typeof guideClusters)[number]

/** A glossary entry: the shared fields, the title is the term, plus its related terms and one cluster page. */
export const glossarySchema = entrySchema.extend({
  /** Entry ids of other terms that explain this one; shown as links only where the target is visible in the build. */
  related: z.array(z.string()).default([]),
  guide: z.enum(guideClusters).optional(),
})

export type GlossaryData = z.infer<typeof glossarySchema>
