# e2e

Playwright, two suites. `arena/` is the table arena's scorecard; `suite/` is the end-to-end suite against the shipped image.

## suite

One browser context per seat against the image users self-host (`deploy/compose.yml`). Run it with `make e2e` (builds the image, starts a stack of its own on a port the system picks, runs Playwright, removes the stack, all in a factory slot; arguments to Playwright: `make e2e E2E_ARGS='--grep reload'`), never `playwright test` by hand: the config refuses to start without `E2E_BASE_URL`. About 20 s of tests plus the image build.

- `suite/room.ts` is the fixture: `room(n)` opens n contexts, the first through `/room/new` as a person does, and closes them all when the test ends. It captures every WebSocket frame a seat receives (`seat.frames`). A test makes its own room and shares nothing but the stack; the suite runs files and tests in parallel, two workers.
- Select by the ids of `TESTIDS.md` and by role, never by text. Wait with a web-first assertion on an id or an attribute (`data-status="live"`, `data-state="revealed"`); no `waitForTimeout`, no sleep.
- A privacy check needs cards that are not in the page by default: test 1 votes 21, 13 and 8 and looks for them as leaves of each other's frames (a `deck` is skipped: it lists every card) and in the markup outside the hand. It reloads every seat first, because a leak in `project` shows only in a snapshot taken while votes exist. Proof it bites: with `project` returning every seat's card, the test fails with the leaked values named.
- `restart.e2e.ts` starts a stack of its own (`make v9-up` on a free port, the suite's image from `E2E_IMAGE`), replaces the API container with `make v9-replace-api` and removes it; every other test shares the stack of `run.ts`, so none meets a restart. It needs Docker, so it is not tagged `@smoke`.
- `@smoke` marks the tests that need only a base URL: `make e2e-beta E2E_BASE_URL=<origin of the beta host>`. The config refuses the production host.
- CI (`e2e`, two shards, then `e2e-report`) runs `bun e2e/suite/run.ts --shard=n/2` with the image of the `image` job (`E2E_NO_BUILD`, `E2E_IMAGE`). One retry records a trace, and `failOnFlakyTests` keeps a test that needed it red. Chromium only, in the bundled headless shell (`playwright install --only-shell chromium`).
- Workers are a memory figure (rules/browser.md): the thirty-player test holds thirty pages, so raise `E2E_WORKERS` with that sum in mind.
- `suite/port.ts` is the OS-assigned port; `e2e` may import no workspace package, so it does not use `@fpp/test-kit`.

## arena

- `arena/` is the scorecard: `make arena-score ENTRY=<name>`, never `playwright test` by hand (the Makefile builds the gallery and the static checks first, and runs it in a test slot). One worker, so the frame timing has the CPU to itself; the bundled headless shell (`playwright install --only-shell chromium ffmpeg`).
- Each test writes a part under `arena/scores/<entry>/parts` before it asserts, and `arena/report.ts` (global teardown) turns the parts into `index.html` and `score.json`, failed tests included. A floor rule is recorded with `floor()` from `arena/support.ts`, and named in `RULES` of `report.ts` and in `docs/v9/TABLE-BRIEF.md`.
- The page is served from `apps/arena/dist` on a port the system picks (`arena/setup.ts`); nothing listens on a fixed port.
- Two waits on the wall clock are deliberate and say so: the reduced-motion check and the recordings measure real animation. Add no other.

## both

- `TESTIDS.md` lists the `data-testid` of the room app. A suite selects by those ids and by role, never by text: the text is in the user's language. A test in `apps/room/test` fails when the list and the source differ.
- Types: `e2e/tsconfig.json`, run by `make check-fast`.
