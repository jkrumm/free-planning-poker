import type { Target } from './target.ts'

export type Draftable = { data: { draft: boolean } }

/** Production drops drafts; beta keeps them. Every list and every route reads entries through this one function. */
export function visibleEntries<T extends Draftable>(entries: readonly T[], target: Target): T[] {
  return target === 'beta' ? [...entries] : entries.filter((entry) => !entry.data.draft)
}
