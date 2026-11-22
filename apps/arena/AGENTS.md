# apps/arena

The table arena's gallery (Vite, React): every entry under `arena/entries`, every scenario of `@fpp/table/scenarios` played by `playScript` from `@fpp/room-core/sim`, compare mode, and the harness the scorecard drives. The owner's runbook is `docs/v9/ARENA.md`, the entrants' brief `docs/v9/TABLE-BRIEF.md`.

- `make arena` builds `dist` and runs `src/entries.test.tsx`, which renders every entry through every frame with `react-dom/server` (also part of `make check-fast`). `make arena-score ENTRY=<name>` runs `scripts/static-score.ts` and then `e2e/arena`.
- Entries are found by `import.meta.glob` in `src/entries.ts`; nothing lists them. Bun has no `import.meta.glob`, so code a test imports goes into `src/entry-check.ts` or another file without it.
- The selection lives in the fragment (`src/selection.ts`); the scorecard sets it from outside, and `bare=1` shows the stages alone at 1:1. `window.arenaHarness` (`src/harness.ts`) is the scorecard's only window into the page: change both sides together.
- An intent changes nothing here (the frames are scripted); the scorecard relies on that when it presses every control.
- `src/tokens.css` stands in for basalt-ui 3's tokens under their names until `v9-ui-foundation` replaces it; it is the one file of the arena where a colour is a value. Every string is in `src/messages.ts`, English and German.
- React is deduplicated in `vite.config.ts`, because an entry resolves React through `arena/node_modules`.
