---
name: arena-score
description: Score a table arena entry (make arena-score ENTRY=<name>) and fix what its floor fails: reading order, keyboard, reduced motion, frame time, size, colours. Use when building or reviewing an entry under arena/entries, or when CI's arena job is red.
---

# Scoring an arena entry

The contract and the floor are in `docs/v9/TABLE-BRIEF.md`; this is the loop around them.

1. **Run it into a file**: `make arena-score ENTRY=<name> > /tmp/arena-<name>.log 2>&1; echo rc=$?`, about 2 minutes. It builds the gallery, renders every frame through the entry, runs the static checks and then Playwright in the headless shell.
2. **Read `arena/scores/<name>/score.json`**, `floor[].pass` and `floor[].detail`, not the log: every rule carries the scenario and the element that failed. The screenshots are under `shots/<container>-<theme>/<scenario>.png`; Read the phone ones first.
3. **Fix by rule:**
   - `plays`: the detail names the scenario; render it with `bun test apps/arena` (a crash there is a crash in the gallery).
   - `reading-order`: one `data-seat` element per seat in the order of `view.seats`; a played card after the reveal carries `data-card` and `data-card-of`; both need an accessible name from `messages`.
   - `keyboard`: the detail lists the intents the Tab walk never reported per scenario; the control is not focusable, or reacts to the pointer only.
   - `reduced-motion`: something still changes after the first paint under `preferences.reducedMotion`; a fade counts.
   - `frame-time`: the 30-seat reveal is too heavy with the CPU slowed four times; animate `transform` and `opacity` only, and fewer elements at once.
   - `size`, `colours`, `contained`: `arena/scores/<name>/static.json` names the file and line.
4. Rerun until it exits 0, then `make check-fast`.
