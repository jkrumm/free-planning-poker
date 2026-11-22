# The table arena: the owner's runbook

The table's look is picked from competing entries (`docs/v9/UX.md`, The table arena). This page is how you run that competition: start entries, score them, look at them, close the arena. An entry is one directory under `arena/entries` and one pull request; its brief is `docs/v9/TABLE-BRIEF.md`, and that file is all an entrant gets.

## Start an entry

1. Make a worktree of this repository on a branch of its own, from the root of your checkout:

   ```sh
   git fetch origin && git worktree add ../fpp-arena-<name> -b arena/<name> origin/master
   cd ../fpp-arena-<name> && bun install
   ```

2. Start a fresh session of any coding agent, with any lab's model, in that directory. Give it this prompt with one direction from the list below:

   > Read docs/v9/TABLE-BRIEF.md and build one entry for the table arena. Your direction: \<direction\>. Name the entry \<name\>; its author is \<author\>. Iterate until `make arena-score ENTRY=<name>` exits 0 and `make check-fast` passes, then open the pull request the brief describes.

3. Let it run to the end. A second round on the same entry is a new prompt in the same session: what to change, from what you saw in the gallery.

One session per direction; never two directions in one session, or the entries converge.

## Directions

Each differs in kind from the others. Use each once before you repeat one with another model.

| Direction | What it tests |
|-|-|
| A felt card table seen from above, cards dealt and turned | the obvious game: does it read as cards |
| A flat board game: tokens on a printed board, no depth | whether play works without realism |
| A strict grid, every seat a tile of the same size | how far order and density carry at 30 seats |
| A conversation: seats as a list of people, cards played like messages | a table that reads top to bottom on any width |
| A playful one: bounce, colour, a reveal with a punchline | where game feel tips into noise |
| A minimal one: type and space, almost nothing moves | the floor of motion that still feels like a round |
| Built for a phone first, then grown to the wall screen | one hand, a 360 px screen, thumbs |
| Built for thirty seats first, then shrunk to two | the large room as the design case |
| Paper and ink: hand-drawn cards on a desk | a warm look a work meeting still accepts |
| An arcade cabinet: a scoreboard, a reveal as a round's result | how far a theme can go before it hurts the tool |

## How many

At least four entries from at least two labs before you compare: fewer, and the pick is between a model's habits, not between tables. Eight, one per direction above, covers the space.

## Score an entry

`make arena-score ENTRY=<name>` from the repository root, about two minutes; CI also scores every entry a pull request changes and keeps the result as the artifact `arena-scores`. It writes `arena/scores/<name>/index.html`. Read it top down:

| Section | Read it as |
|-|-|
| Floor | every row must say pass; a fail is not judged further, its detail says where |
| Size | own code against the 60 kB limit; "adds" is what the room's bundle grows by, its libraries included |
| Reveal frame times | the 30-seat rows decide; a median near 16.7 ms is a reveal that costs nothing, a worst frame over 50 ms is a stutter you will see on a phone |
| Determinism | must say identical; otherwise the entry reads the wall clock or chance |
| axe | serious and critical findings count against the entry even though they do not fail it |
| The split reveal | the two recordings: the reveal as a person sees it, at 9 and at 30 seats |
| End states | every scenario in every container and theme; look at the phone column first |

## See it in the gallery

`make arena`, then `bun run --filter @fpp/arena preview` and open the address it prints (on the beta host once the arena is deployed there). Choose the entry, the scenario and the container; play, step or scrub; pick a second entry under "Compare with" to run both in step. The address bar holds the whole selection, so a link shows anyone the same frame. Each entry links its scorecard.

## Merge an entry

An entry's pull request is merged when its floor passes and it touches nothing outside its directory (the brief's one exception: a dependency in `arena/package.json`). Merging is not picking: every entry merged under `arena/entries` takes part when the arena closes. Never merge a change to the reference entry from an entrant.

## Close the arena

When the entries you want are merged, write a note on the Issue of row `v9-table-pick`:

```sh
factory issue note <issue of v9-table-pick> "The arena is closed: <n> entries under arena/entries." --wake
```

That gate then asks you for the pick: it puts every entry's scorecard side by side, and you say which entry's table, which entry's reveal and which details you keep. It builds `packages/table` from those pieces and asks for your verdict on the result. An entry merged after the note is not considered.
