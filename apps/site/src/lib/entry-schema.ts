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

/** Who is ahead on one row of a comparison: the other tool, Free Planning Poker, or neither. */
export const vsAhead = ['them', 'us', 'even'] as const

/**
 * One fact about another product: what its own page says, the address of that page and the day it was read there.
 * `ours` is what release 9.0.0 does on the same point.
 */
export const vsFactSchema = z.object({
  topic: z.string(),
  claim: z.string(),
  source: z.url(),
  read: z.coerce.date(),
  ours: z.string(),
  ahead: z.enum(vsAhead),
})

/**
 * A comparison page. `origins` are the address prefixes that count as the tool's own pages: a fact's source must start
 * with one (src/lib/vs.test.ts). `checked` is the day the newest fact was read.
 */
export const vsSchema = entrySchema.extend({
  tool: z.object({ name: z.string(), url: z.url(), origins: z.array(z.url()).min(1) }),
  checked: z.coerce.date(),
  facts: z.array(vsFactSchema).min(1),
})

export type VsData = z.infer<typeof vsSchema>
export type VsFact = z.infer<typeof vsFactSchema>

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
