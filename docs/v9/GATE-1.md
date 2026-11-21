# Owner gate 1: the v9 rewrite concept

**What you accept with "Looks good":** Free Planning Poker is rewritten on `master` as release 9.0.0, on the architecture in `docs/v9/ARCHITECTURE.md` and the product in `docs/v9/UX.md`, in the stages of `docs/v9/PLAN.md`. v1 moves to its own branch and stays in production from there, untouched, until one reversible cutover on a weekend. The whole plan is written out: 78 rows in four stages (`docs/plan.yaml`). With "Looks good" the factory files three rows at once (Umami on v1, the development host, the Postgres role) and every later row when the rows it reads have shipped. Nothing with a look is built before basalt-ui 3 is on npm.

**Read first:** the Report "v9 strategy" (12 minutes). It opens with what each of your comments of 2026-11-21, 2026-11-20 and 2026-11-19 changed, and with your rulings on the open choices. The Reports on UX, architecture, engineering and the plan are the detail behind it. All are in the collection "Free Planning Poker v9" and take comments.

**Where the concept differs from your brief**

1. No multiplayer engine (TanStack DB, SpacetimeDB): a hand-written authoritative room server, because votes are hidden information.
2. Astro for the marketing site, not TanStack Start. React, not Preact.
3. No long-lived worktree: the rewrite takes `master` and v1 takes a branch, because the factory files rows only from the default branch.
4. Effect is used in the API's adapters and jobs, not in the core. Its socket server is one of three candidates measured for the WebSocket path.
5. basalt-ui 3.0.0 is unpublished, so everything without a look is built first.

**Already ruled by you:** Umami's script without a banner; Bun and Elysia 2 at its release candidate; one origin with unchanged room links; the weekend cutover; waiting for basalt-ui 3; the final value and the room lock in 9.0.0; no work on v1 meanwhile; the table decided by a competition between models, run outside the factory. And on 2026-11-20, on what was still open: a room has no owner and every player runs it; a new room is a six-digit number and a name is a booking; the lock takes a typed or a generated password and need not be secure; languages from the beginning, five in the room and on the landing page; no QR code; a tracker's key never rests on our server; FAQ markup stays; AI crawlers are welcome; a thorough setup for agents before the first feature row.

**Open choices:** none. Each ruling and what it changed is in `docs/v9/STRATEGY.md`, "Rulings of gate 1".

**Your later stops:** the pick in the table arena and the finished room (stage 2), the cutover and the deletion of v1's database (stage 4). Nothing else waits for you, and no row hands you a Spec. Pages you must read before the world does are merged as drafts that only the beta host shows.

**With "Changes":** nothing is built. Your comments go back to the session that wrote the concept; the documents and `docs/plan.yaml` are reworked and resubmitted.
