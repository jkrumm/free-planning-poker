# Handover: plan the rest of v9 ahead, and make the repository ready for agents

You are picking up the planning of the Free Planning Poker rewrite (release 9.0.0) in a fresh session. The concept is finished and ruled on. Nothing is built. Your job is the planning that is still missing, done ahead of time with the owner in the room, so that the factory can run for weeks without asking him.

## What exists

| What | Where |
|-|-|
| The concept and every decision with its reason | `docs/v9/STRATEGY.md`. Start with "Rulings of gate 1", "Your comments of 2026-11-20" and "Your rulings of 2026-11-19": they bind |
| The technical contract | `docs/v9/ARCHITECTURE.md` (eighteen invariants, room model, protocol, data model) |
| The product | `docs/v9/UX.md` |
| Patterns, checks, CI, the factory fit | `docs/v9/ENGINEERING.md` |
| Stages and draft rows | `docs/v9/PLAN.md` |
| The rows the factory runs | `docs/plan.yaml`: stage 1 written out, two rows of stage 2, three planning rows. This file wins over `PLAN.md` |
| Research | `docs/v9/research/`, r01 to r24, each with what it could not verify |
| The owner's gate | factory Issue 2295, held. Its text is `docs/v9/GATE-1.md` |
| The Reports the owner reads and annotates | the collection "Free Planning Poker v9" in the factory console (`factory artifact list --repo free-planning-poker`) |
| v1, for behaviour and copy | `master` until the row `v9-freeze-v1` ships, then `git show origin/v1:<path>` |

Read `STRATEGY.md` and `PLAN.md` in full. Read the other documents by section when a row needs them; do not load all of them at once.

## The job

1. **Write stages 2, 3 and 4 as rows in `docs/plan.yaml`**, as far as they can be known today. Every draft item of `PLAN.md` under "Stage 2", "Stage 3" and "Stage 4" becomes a row, is merged into another row, or is listed as deferred with its reason.
2. **Turn the three planning rows into correction rows.** `v9-plan-table`, `v9-plan-site` and `v9-plan-launch` keep their place in the order, and each shrinks to: read what the stage before measured, correct the rows that follow, change nothing that still holds.
3. **Deepen the setup for agents.** Review the row `v9-agent-setup` and `ENGINEERING.md`, "Ready for agents before the first feature", against how leads fail in the owner's other repositories (`factory read` has the history; `~/SourceRoot/dotfiles/docs/agents-md.md` and `rules/writing-for-agents.md` are the contract). Sharpen the row's facts. Draft the rule files' outlines into the row, not into the repository.
4. **Prepare the table arena as a session the owner runs**, outside the factory: a runbook `docs/v9/ARENA.md` that says how he starts an entry with each of his launchers (OpenCode reaches the models of other labs), which directions to hand out so the entries differ, how many rounds, how he closes the arena, and what the gate `v9-table-pick` then needs from him. Keep `TABLE-BRIEF.md` for the row `v9-table-arena`: the runbook is for the owner, the brief for the entrant.
5. **Settle with the owner what is still open** (list below), one question at a time, each with two options and your tendency. Record every answer in `STRATEGY.md`, "Rulings of gate 1".
6. **Leave the gate ready.** When the plan is merged, revise the five Reports, update `GATE-1.md`, add a note to Issue 2295, and tell the owner in one line what his verdict now starts.

## What a row must be

The format is software-factory's `docs/plan.md`; `factory issue schema` has the facts' keys; the rows of stage 1 are the model.

- One change that ships alone, sized for one lead session of at most a day.
- Facts with `why`, `what`, `change`, `acceptance`, `scope`. Exact paths. The section of `docs/v9` the row implements, by name. Research baked in: the lead cannot see yours.
- Every acceptance line is a command with its expected output, or a number.
- `after` only where a row reads what another shipped. Width before depth: at most what truly depends.
- An opus seat only for novel hard logic or a design that must hold, with the reason in `why`. Leads are Claude tiers only.
- No `checkpoint: spec`. The gates are the five in `PLAN.md`; stage 2's exit, the cutover and the deletion of v1's database are written as `checkpoint: gate` rows by you.
- A row that needs the picked table reads `packages/table` through the arena's contract, so only the look waits for the pick. Order stage 2 so that everything else can be built against the reference entry.
- A row with a visible string uses the message catalogue; a row for the interface names the arena scenarios whose screenshots it attaches.
- `factory plan check docs/plan.yaml` and `factory project check` pass before every commit.

## How to work

- **You hold the plan and the decisions; workers gather and draft.** Explore agents for v1's behaviour and for the owner's other repositories; `/research` for every library, version and vendor fact (never from memory, and never with the project's name or domain in a query); one drafting worker per stage on disjoint row ranges, which you then read and correct line by line.
- **`/lenses` if the owner asks for it in your session.** He named it as an option. It fits stage 3 best (content, search, assistants, languages, measurement, legal: many fields), and it costs hours and tens of millions of tokens, so confirm the scope with him first.
- Work in small verified steps: one stage, check, commit, pull request, `/review`, merge inside `factory merge-lock`, then the next.
- Human-facing prose (the documents, the Reports) follows `~/SourceRoot/brain/voice.md` and goes through `/prose`. Row facts are written for agents: complete, literal, no style.
- `research/r24-i18n.md` was run with Astro 6 in its context; the stack is Astro 7. Re-check its routing findings against the current documentation before a site row relies on them.
- The repository's `AGENTS.md` still describes v1 until the freeze. For planning, the documents above win.

## Open, for you to settle with the owner

| Question | What is known | Tendency |
|-|-|-|
| The site's second language at launch | the room ships in English and German; a half-translated site hurts (`research/r24-i18n.md`) | English only at launch, German when every page is translated and reviewed |
| The hold periods | three months for a number, six for a booked name, 30 days for a replaced address; the owner first said "e.g. 3 months" for everything | keep; they are constants |
| What the importer does with v1's per-person estimates | v1 stores them without a link to a round | count them in the totals, attach none to a round |
| Self-hosting at 9.0.0 | one compose file is promised on the landing page | a row in stage 4 that proves the compose file on a clean host |
| The order of the first activities after launch | confidence vote, dot voting, wheel (`research/r23`) | keep; none is a row yet |
| basalt-ui 3: wait for 3.0.0 or use a release candidate | everything with a look waits on it. The needs are filed in basalt-ui as Issues 2529 (motion), 2530 (seams, icons), 2531 (site profile), 2532 (marketing blocks) and 2525 (TanStack map); `ENGINEERING.md`, "Working with basalt-ui", has the table. They are not plan rows there, so a row of yours cannot wait on them with `after`: let it defer on the registry, or ask the basalt-ui session for row keys | ask the owner for a date; plan stage 3's content rows so they do not wait |

Not yours to settle, because a row measures it: what Vercel does with a commit that lacks the project's root directory (`v9-freeze-v1`); which socket adapter wins (`v9-api-ws`); whether Paraglide holds the bundle budget (`v9-room-plain`); whether link scanners keep a URL fragment (stage 2, the lock's screens: test with real Teams and Outlook messages); whether one hostname can be split by path at the edge (`v9-edge-routing`).

## Rules of this repository that bind you

- Every artifact is English. No attribution to a model or a tool anywhere.
- No real host name, address, user name, token or internal URL in a tracked file: placeholders.
- Never start a dev server. Docker only through Makefile targets. Secrets only through `secrets-run`.
- This repository is public. Nothing private to the owner's other systems goes into it.
- Changes reach `master` through a pull request that is reviewed, rebased and merged inside `factory merge-lock --project free-planning-poker`, after every check has finished on the exact head. Until `v9-freeze-v1` ships, each merge still redeploys v1: keep merges few.
- Commits: `<type>: <subject>`, at most 80 characters, body lines at most 100.

## Done means

- `docs/plan.yaml` holds every row of stages 2 to 4 that can be written today, `factory plan check` passes, and `factory read chain` shows the rows after a sync.
- `PLAN.md` shows the same rows as tables, and nothing in it is still called a draft without a reason.
- `docs/v9/ARENA.md` exists and the owner has read it.
- Every open question above has a ruling in `STRATEGY.md`.
- The Reports are revised, Issue 2295 has a note, and the owner has one line that says what "Looks good" now starts.
