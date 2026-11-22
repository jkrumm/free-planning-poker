/**
 * Every entry under `arena/entries/<name>/index.tsx`, found at build time: a new directory appears in the gallery
 * with no change anywhere else. An entry whose module does not export a well-formed `entry` is listed with its
 * problem instead of breaking the gallery.
 */
import { checkEntry, type LoadedEntry } from './entry-check.ts'

export type { LoadedEntry } from './entry-check.ts'

const modules = import.meta.glob<{ readonly entry?: unknown }>(
  '../../../arena/entries/*/index.tsx',
  {
    eager: true,
  },
)

/** The reference first, then the others by name. */
export const ENTRIES: readonly LoadedEntry[] = Object.entries(modules)
  .map(([path, module]) => checkEntry(path.split('/').at(-2) ?? path, module.entry))
  .toSorted((a, b) =>
    a.name === 'reference' ? -1 : b.name === 'reference' ? 1 : a.name.localeCompare(b.name),
  )
