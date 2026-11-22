/**
 * The reference entry: plain, correct, boxes only. It proves the contract and the scorecard and is never a candidate.
 * Copy this directory to start an entry (docs/v9/TABLE-BRIEF.md).
 */
import type { Entry } from '@fpp/table/contract'
import { ReferenceTable } from './table.tsx'

export const entry: Entry = {
  manifest: {
    name: 'reference',
    direction: 'Plain boxes: the contract and the floor, and nothing else',
    author: 'the arena',
    dependencies: [],
  },
  Table: ReferenceTable,
}
