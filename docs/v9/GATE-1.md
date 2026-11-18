# Owner gate 1: the v9 rewrite concept

**What you accept with "Looks good":** Free Planning Poker is rewritten in place on `master` as release 9.0.0, on the architecture in `docs/v9/ARCHITECTURE.md` and the product in `docs/v9/UX.md`, in the stages of `docs/v9/PLAN.md`. v1 stays in production, untouched, until one reversible cutover. Stage 1 (17 rows, no visible design) starts when this gate closes.

**Read first:** the Report "v9 strategy" (10 minutes). The Reports "v9 product and UX concept" and "v9 architecture" are the detail behind it. All three are linked to this Issue and take comments.

**The five things that differ from your brief**

1. No multiplayer engine (TanStack DB, SpacetimeDB): a hand-written authoritative room server, because votes are hidden information.
2. Umami is fed by the servers; no analytics script runs in a browser. The German regulator's position makes a client script a consent question even without cookies.
3. Astro for the marketing site, not TanStack Start. React, not Preact.
4. Work happens on `master` in new directories, not in a long-lived worktree: the factory files rows only from the default branch.
5. basalt-ui 3.0.0 is unpublished, so everything without a look is built first.

**Open choices**

| Choice | Default | Alternative | Cost of changing later |
|-|-|-|-|
| 1. Origin | One origin, marketing and app split by path at the Cloudflare edge | App on `app.<domain>`; returning users lose name and settings, shared links redirect | High after launch |
| 2. basalt-ui timing | UI rows wait for 3.0.0 on npm | You publish a 3.0.0 release candidate and stage 2 starts on it | None |
| 3. Who runs a round | Everyone, as in v1, with an optional facilitator lock | The room's creator is always the host | Low |

**Your later stops:** the look of the table and the finished room (stage 2), the cutover and the deletion of v1's database (stage 4). Nothing else waits for you.

**With "Changes":** nothing is built. Your comments go back to the session that wrote the concept; the documents and `docs/plan.yaml` are reworked and resubmitted.
