# packages/table

The table's contract and the arena's scenarios; `v9-table-pick` builds the picked table here. Every table entry, the room and the landing page depend on `src/contract.ts`, so a change to it is a change to every entry under `arena/entries`.

- `src/contract.ts` is types only, plus `INTENT_TYPES`. A new prop is optional or every entry breaks; a new intent type also needs the scorecard's keyboard walk (`e2e/arena/scorecard.e2e.ts`) to expect it in some state, and a line in `docs/v9/TABLE-BRIEF.md`.
- `src/scenarios.ts` is data built without chance: who votes what follows from a seat's index, the seed only fixes ids. A changed script changes every entry's screenshots; `apps/arena/src/entries.test.tsx` plays every script and fails when the room refuses a step. The phases and seat counts are the matrix of `docs/v9/UX.md`, The table arena; the brief repeats them.
- `@fpp/room-core` is imported for types only (`boundaries.toml`): `playScript` runs in the arena, not here. `TableMessages` carries every word an entry shows (rule `strings.md`); a new message gets English and German in `apps/arena/src/messages.ts`.
