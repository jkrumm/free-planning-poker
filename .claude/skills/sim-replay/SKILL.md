---
name: sim-replay
description: Replay and fix a failing room simulator seed (bun run sim --seed <n>), from make check-fast, sim.test.ts or the nightly workflow. Use when a seed fails, the nightly is red, or a runtime change needs its trace read.
---

# Replaying a simulator seed

The simulator (`packages/room-core/src/sim`) plays a room on the runtime with bots over a seeded lossy network and checks the invariants after every step. A run is a pure function of its seed, so a failure replays exactly.

1. **Reproduce first.** Run the replay line the failure printed, `bun run sim --seed <n>` (with `--fault vote-any-round` if it was there), into a file: `bun run sim --seed <n> > /tmp/seed.txt 2>&1; echo rc=$?`. The trace has one line per frame: `<ms> <conn> > ...` client to server, `< ...` server to client, `x <code>` a close, `! ...` a lock change or a deploy. The last lines name the violation and the time it happened.
2. **Read around the time** of the violation for the connection it names: `rg ' c12 ' /tmp/seed.txt`, and `welcome seat=<n>` to find which sockets held a seat. Reorder and loss are deliberate, so first decide whether the runtime broke a rule or the bot (`src/sim/bots.ts`) did something no real client would; a client bug is fixed in the bot, with the reason in a comment.
3. **Commit the seed as a test that fails** before the fix: `await simulate({ seed: <n> })` in `packages/room-core/test/sim.test.ts`, expecting `ok`. Then fix, and run `make check-fast`.
4. **A change to the bots, the network or the checker changes every trace.** Seeds that passed may fail afterwards: that is new coverage, not a flake. Run `bun run sim --seeds 1000` before pushing such a change.
5. Never raise a limit or loosen an invariant to make a seed pass without saying why in the pull request.
