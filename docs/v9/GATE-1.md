# Owner gate 1: the v9 rewrite concept

**What you accept with "Looks good":** Free Planning Poker is rewritten on `master` as release 9.0.0, on the architecture in `docs/v9/ARCHITECTURE.md` and the product in `docs/v9/UX.md`, in the stages of `docs/v9/PLAN.md`. v1 moves to its own branch and stays in production from there, untouched, until one reversible cutover on a weekend. Stage 1 (20 rows, no visible design) starts when this gate closes.

**Read first:** the Report "v9 strategy" (12 minutes). It opens with what each of your comments of 2026-11-20 and 2026-11-19 changed. The Reports on UX, architecture, engineering and the plan are the detail behind it. All are in the collection "Free Planning Poker v9" and take comments.

**Where the concept differs from your brief**

1. No multiplayer engine (TanStack DB, SpacetimeDB): a hand-written authoritative room server, because votes are hidden information.
2. Astro for the marketing site, not TanStack Start. React, not Preact.
3. No long-lived worktree: the rewrite takes `master` and v1 takes a branch, because the factory files rows only from the default branch.
4. Effect is used in the API's adapters and jobs, not in the core or the WebSocket path.
5. basalt-ui 3.0.0 is unpublished, so everything without a look is built first.

**Already ruled by you:** Umami's script without a banner; Elysia 2 at its release candidate; one origin with unchanged room links; the weekend cutover; waiting for basalt-ui 3; the final value and the room lock in 9.0.0; a lock that is easy to share and need not be secure; no work on v1 meanwhile; the table decided by a competition between models.

**Open choices**

| Choice | Default | Alternative | Cost of changing later |
|-|-|-|-|
| Who runs a round | Everyone, as in v1, with an optional facilitator lock | The room's creator is always the host | Low |
| What a new room is called | Two words, such as `brave-otter` | Six digits, as in v1 | Low |
| How far Effect goes | The API's adapters and jobs only | Also the protocol schemas and the client's connection | High in both directions |

**Your later stops:** the pick in the table arena and the finished room (stage 2), the cutover and the deletion of v1's database (stage 4). Nothing else waits for you, and no row hands you a Spec.

**With "Changes":** nothing is built. Your comments go back to the session that wrote the concept; the documents and `docs/plan.yaml` are reworked and resubmitted.
