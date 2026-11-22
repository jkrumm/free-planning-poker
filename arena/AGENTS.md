# arena

The table arena's entries, one directory each under `entries/`, and their scorecards under `scores/` (not committed). Before changing an entry, Read `docs/v9/TABLE-BRIEF.md`: it is the whole contract for an entry, and an entrant needs no other document.

- `package.json` is the entries' one workspace package, so a new entry directory needs no install. A library an entry needs goes here, exactly pinned, and into that entry's manifest.
- `entries/reference` stays plain: it proves the contract and the scorecard and is never a candidate.
