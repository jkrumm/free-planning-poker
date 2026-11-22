---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.e2e.ts"
  - "packages/test-kit/**"
  - "e2e/**"
---

# Tests

Many leads run their suites on one host at once, each in its own worktree, with nobody watching. A test that shares a port, a database or the wall clock fails for someone else's reason.

## The rule

- **A port** comes from `freePort()` (`@fpp/test-kit/port`). No test listens on a fixed port, 7738 to 7740 included.
- **A database** comes from `startPostgres()` (`@fpp/test-kit/postgres`): a private cluster from `PG_BIN_DIR` (or the `initdb` on PATH) in a temporary directory, on a free port; `stop()` deletes it. No test touches the mini's `fpp` database or any shared one. A file that starts Postgres is named `*.server.test.ts` and runs in `make check`, not in `check-fast`. Use nothing newer than PostgreSQL 16: the factory's step host runs 16, CI and production 18.
- **No sleep.** Time arrives through the injected clock or Effect's test clock; wait on an event, never on a timer.
- **No module mocks.** Replace an adapter with its in-memory twin from room-core or `/sim`.
- **A failing simulator seed is replayed before it is fixed**: `bun run sim --seed <n>` prints the same trace; commit the seed as a regression test that fails first, then the fix.
- **No flake is tolerated.** A test that fails once without a code change is fixed or deleted in the next row that touches its area; never retried into green.
- `@fpp/test-kit` is imported by test files only. A test sits beside its code as `*.test.ts`; Playwright files end in `*.e2e.ts` so `bun test` never runs them.
- A new test target writes JUnit to `$FACTORY_JUNIT_DIR` only when it is set (the `JUNIT` macro in the `Makefile`).
- A heavy suite (end to end, component, load) runs inside a slot, `factory slot run -- <command>`, and locally only to reproduce a CI failure.

## Why

`docs/v9/ENGINEERING.md`, Built for the factory and Targets (flaky tests: none tolerated); `docs/v9/ARCHITECTURE.md`, Testing.

## The check

`boundaries.toml` marks `@fpp/test-kit` `tests_only`, so `make check-fast` refuses it in source. `make check-fast` skips `*.server.test.ts`; `make check` and CI run them with PostgreSQL 18. Sleeping and fixed ports have no script yet: review refuses them.
