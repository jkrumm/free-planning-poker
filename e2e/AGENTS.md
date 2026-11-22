# e2e

Playwright. Today it holds the table arena's scorecard; `v9-e2e` adds the suite against the built image.

- `arena/` is the scorecard: `make arena-score ENTRY=<name>`, never `playwright test` by hand (the Makefile builds the gallery and the static checks first, and runs it in a test slot). One worker, so the frame timing has the CPU to itself; the bundled headless shell (`playwright install --only-shell chromium ffmpeg`).
- Each test writes a part under `arena/scores/<entry>/parts` before it asserts, and `arena/report.ts` (global teardown) turns the parts into `index.html` and `score.json`, failed tests included. A floor rule is recorded with `floor()` from `arena/support.ts`, and named in `RULES` of `report.ts` and in `docs/v9/TABLE-BRIEF.md`.
- The page is served from `apps/arena/dist` on a port the system picks (`arena/setup.ts`); nothing listens on a fixed port.
- Two waits on the wall clock are deliberate and say so: the reduced-motion check and the recordings measure real animation. Add no other.
- Types: `e2e/tsconfig.json`, run by `make check-fast`.
