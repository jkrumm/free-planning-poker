/**
 * The felt table: a green oval seen from above, seats on its rim, cards dealt face down and turned in seat order.
 * Built against docs/v9/TABLE-BRIEF.md; the table reads the view and the messages, and reports intents only.
 */
import type { Entry } from '@fpp/table/contract'
import { FeltTable } from './table.tsx'

export const entry: Entry = {
  manifest: {
    name: 'felt-top',
    direction: 'a felt card table seen from above',
    author: 'factory lead',
    dependencies: [],
  },
  Table: FeltTable,
}
