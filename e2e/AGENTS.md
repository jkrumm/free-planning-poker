# e2e

Playwright, two suites. `arena/` is the table arena's scorecard; `suite/` is the end-to-end suite.

## suite

One browser context per seat against a stack of its own. Run it with `make e2e` (starts the stack on a port the system picks, runs Playwright, removes the stack, all in a factory slot; arguments to Playwright: `make e2e E2E_ARGS='--grep reload'`), never `playwright test` by hand: the config refuses to start without `E2E_BASE_URL`. About 40 s in all in native mode, 40 s in image mode. Native runs one worker (peak about 1.3 GiB against the slot's 2 GiB; two workers peak at 2.1 GiB); image mode, CI's, runs two. `E2E_WORKERS` overrides either.

Two modes, `E2E_MODE`. **native** is the default and needs no Docker engine: `run.ts` builds the room app and the API as the Dockerfile does (`bun run build`), starts a private PostgreSQL (`suite/postgres.ts`) and the API with `bun` (`suite/native.ts`), and stops both after the run. **image** (`E2E_MODE=image make e2e`, what CI sets) starts `deploy/compose.yml`, the file users self-host, so the shipped artifact is proven; it builds the image first unless `E2E_NO_BUILD` and `E2E_IMAGE` name a loaded one. A change to the Dockerfile, the compose file or the image's environment is proven in image mode only.

- `suite/room.ts` is the fixture: `room(n)` opens n contexts, the first through `/room/new` as a person does, and closes them all when the test ends. It captures every WebSocket frame a seat receives (`seat.frames`). A test makes its own room and shares nothing but the stack; the suite runs files and tests in parallel, in as many workers as `E2E_WORKERS` says.
- Select by the ids of `TESTIDS.md` and by role, never by text. Wait with a web-first assertion on an id or an attribute (`data-status="live"`, `data-state="revealed"`); no `waitForTimeout`, no sleep.
- A privacy check needs cards that are not in the page by default: test 1 votes 21, 13 and 8 and looks for them as leaves of each other's frames (a `deck` is skipped: it lists every card) and in the markup outside the hand. It reloads every seat first, because a leak in `project` shows only in a snapshot taken while votes exist. Proof it bites: with `project` returning every seat's card, the test fails with the leaked values named.
- `restart.e2e.ts` starts a stack of its own on a free port and replaces the API under a round; every other test shares the stack of `run.ts`, so none meets a restart. Native: SIGTERM, wait for the drain to exit 0, a new process on the same port and database. Image: `make v9-up` with the suite's image from `E2E_IMAGE`, then `make v9-replace-api`. Its cleanup runs in `afterEach` and in an exit handler, so a timeout does not leave a stack; it is not tagged `@smoke`.
- `@smoke` marks the tests that need only a base URL: `make e2e-beta E2E_BASE_URL=<origin of the beta host>`, and `selfhost.yml` runs them against a stack started from the page's commands. The config refuses the production host.
- In image mode `run.ts` gives the compose file the two secrets it has no default for (random per run), as a self-hoster's `.env` does, and starts with `make v9-sweep`, which removes `fpp-e2e-*` stacks older than two hours (a killed run never cleans up). Docker is driven through Makefile targets only.
- CI (`e2e`, two shards, then `e2e-report`) runs `bun e2e/suite/run.ts --shard=n/2` in image mode with the image of the `image` job (`E2E_MODE=image`, `E2E_NO_BUILD`, `E2E_IMAGE`). One retry records a trace, and `failOnFlakyTests` keeps a test that needed it red. Chromium only, in the bundled headless shell (`playwright install --only-shell chromium`).
- Workers are a memory figure (rules/browser.md): a context is about 140 MiB of renderer, so raise `E2E_WORKERS` with that sum in mind. A crowd is never thirty pages: `suite/socket.ts` seats a participant over the WebSocket with no browser (the thirty-player test has one page and twenty-nine sockets), and a new test that needs many seats looks at one page and seats the rest the same way.
- `suite/port.ts` and `suite/postgres.ts` are copies of `freePort` and `startPostgres` of `@fpp/test-kit`: `e2e` may import no workspace package. `postgres.ts` uses Node's APIs, because a Playwright worker runs on Node, not Bun; keep both copies in step.

## arena

- `arena/` is the scorecard: `make arena-score ENTRY=<name>`, never `playwright test` by hand (the Makefile builds the gallery and the static checks first, and runs it in a test slot). One worker, so the frame timing has the CPU to itself; the bundled headless shell (`playwright install --only-shell chromium ffmpeg`).
- Each test writes a part under `arena/scores/<entry>/parts` before it asserts, and `arena/report.ts` (global teardown) turns the parts into `index.html` and `score.json`, failed tests included. A floor rule is recorded with `floor()` from `arena/support.ts`, and named in `RULES` of `report.ts` and in `docs/v9/TABLE-BRIEF.md`.
- The page is served from `apps/arena/dist` on a port the system picks (`arena/setup.ts`); nothing listens on a fixed port.
- Two waits on the wall clock are deliberate and say so: the reduced-motion check and the recordings measure real animation. Add no other.

## both

- `TESTIDS.md` lists the `data-testid` of the room app. A suite selects by those ids and by role, never by text: the text is in the user's language. A test in `apps/room/test` fails when the list and the source differ.
- Types: `e2e/tsconfig.json`, run by `make check-fast`.
