# Team activities beyond planning poker

Research run of 2026-11-20 (`agw research`, depth standard). Run status: ok. Citations grounded against fetched pages: 13/13. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line
- **Which activities extend a poker room:** fist of five (confidence vote), T-shirt sizing (a deck change), dot voting for backlog items, a shared timer, and a random picker. Retro boards and team health checks are separate products with their own persistence and anonymity needs, so defer them.
- **Demand:** the only hard volume I could read is one third-party list (Keywords Everywhere, global Google monthly averages). It gives planning poker 33,100/month, timeboxing 33,100, MoSCoW method 27,100, daily standup 8,100 and sprint retrospective 6,600. Most of the named activities did not appear in the top 300 of 773 project-management keywords. That list's floor there is 4,400/month, so every keyword not shown is at or below that figure. No Ahrefs, Semrush or Google Trends figure was retrieved for any term.
- **Structure:** one persistent room with switchable activities, with one landing page per activity on the existing Astro marketing site that deep-links into the room. Separate tools per URL would split users and reconnect logic for little search gain at these volumes.
- **Competitors:** Parabol bundles poker, retro, stand-ups, check-ins, team health, icebreakers and a timer, and is free for 2 teams. TeamRetro bundles retro, stand-ups, health checks and estimation but has no free-forever tier. EasyRetro is retro-first. ScrumJam's comparison table lists planning poker.

## Activity by activity

Hidden input is the key test: does an individual answer need to stay private until a reveal? Demand figures are global monthly Google averages from Keywords Everywhere unless stated. 'Not in top 300' means at or below 4,400/month.

| Activity | One line | Hidden until reveal? | Session shape | Demand evidence | Leading free tools (from sources read) | Bundled by poker rivals |
|--|--|--|--|--|--|--|
| Random picker / spinner | Picks who speaks, estimates first or leads stand-up order | No; the result is the reveal | Spin, reveal, discuss | Not in top 300 | Spreo (formerly Metro Retro) has spinners per TeamRetro's guide | Not checked |
| Start-stop-continue | Three-column retro; anonymous cards, grouping, vote | Yes for cards (anonymity matters) | Write silently, group, discuss, act | 'sprint retrospective' 6,600 | RetroTool, Retrospected, EasyRetro, Parabol | Parabol, TeamRetro, EasyRetro |
| Mad-sad-glad | Emotion-column retro | Yes for cards | As above | Not in top 300 | EasyRetro templates (100+) | Parabol templates (40+) |
| 4Ls | Liked, learned, lacked, longed for | Yes for cards | As above | Not in top 300 | Parabol template listed on its homepage | Parabol |
| Sailboat | Wind, anchors, rocks, goal | Yes for cards | As above | Not in top 300 | Parabol template listed on its homepage | Parabol |
| Dot voting | Each person spends a fixed dot budget on items | Optional; not sourced | List, dot, tally, discuss | Not in top 300 | Not checked | Not checked |
| Fist of five / confidence vote | 0 to 5 fingers on confidence in a decision | Yes, until simultaneous count | Show together, discuss low scores | Not in top 300 | Not checked | Not checked |
| ROTI | 1 to 7 scale: return on time invested in a meeting | Yes, simultaneous reveal | Vote, reveal, discuss | Not in top 300 | Not checked | Not checked |
| Team health check (Spotify) | Teams rate indicators green, yellow or red with a trend arrow | Yes; anonymous rating matters | Workshop, rate, chart, track trend | Not in top 300 | Echometer (EU hosting), TeamRetro, Parabol's paid tier | Parabol (10 question packs, including the Spotify one), TeamRetro |
| Magic / affinity estimation | Team sorts stories into size groups silently, then moves them | Silent sort, no reveal | Silent sort, then discuss outliers | Not in top 300 | Not checked | Not checked |
| T-shirt sizing | XS to XL using the poker reveal | Yes | Same as poker | Not in top 300 | Not checked | Not checked |
| WSJF / RICE | Scores by formula; individual scores averaged | Yes for individual scores | Score, average, rank | Not in top 300; 'prioritization' 246,000 is generic | Not checked | Not checked |
| MoSCoW | Sort into Must, Should, Could, Won't | No; shared drag and sort | Collaborative sort, agree | 'MoSCoW method' 27,100 | Not checked | Not checked |
| Timers / timeboxes | Shared countdown for rounds and discussion | No input | Set timer, run, close | 'timeboxing' 33,100 | Parabol (timer listed), Spreo | Parabol |
| Stand-up tools | Async or timed updates per person | No | Each person posts, then review | 'daily standup' 8,100; 'standup meetings' 8,100 | Parabol standups, TeamRetro standups | Parabol, TeamRetro |
| Icebreaker questions | Short prompt before the session | No | Prompt, answer, move on | Not in top 300 | EasyRetro Icebreaker Bingo (free) | Parabol built-in icebreaker |
| Team mood (niko-niko) | Daily mood tick per person on a shared chart | Optional | Tick, view trend | Not in top 300 | Not checked | Not checked |
| Lean coffee | Agenda built by voting on topics, then timeboxed talks | Topic votes can be hidden | Propose, vote, timebox each | Not in top 300 | Not checked | Not checked |
| Async estimation poll | Vote on your own time, reveal at a deadline | Yes | Vote, deadline, reveal, discuss | Not in top 300 | Not checked | Not checked |
| Decision matrix | Weighted scoring of options | Optional for scores | Score, weight, total | 'decision trees' 90,500 is a different concept | Not checked | Not checked |
| Sprint capacity / velocity | Capacity and throughput arithmetic | No | Enter numbers, read output | 'velocity' 673,000 is generic; 'burndown chart' 60,500 | Not checked | Not checked |

## Which activities extend a poker room, and in what order
1. **Fist of five / confidence vote.** It is the same hidden-reveal-discuss cycle as poker with one card. It needs the least new code.
2. **T-shirt sizing.** This is a deck and scale change on the existing estimation reducer, not a new activity.
3. **Dot voting, for backlog items.** It follows estimation, and it is the natural entry point for WSJF, RICE and MoSCoW later. It needs a per-seat budget in the projection.
4. **Timer.** It is a shared countdown the room already needs for rounds.
5. **Random picker.** It is cheap and useful for choosing who estimates first. It has no hidden input, so it adds little to the reducer.

Defer retro boards, team health checks and lean coffee. They need anonymous free-text items, grouping, history across sessions and multi-column layouts. That is a different data model from a vote.

## One room or a tool per URL
- **One room.** One state machine, per-seat projection that hides votes once on the server, reconnects handled once, and a team can switch from poker to fist of five on the same stories. This wins on experience.
- **A tool per URL.** Each page can target its own query. But the volumes are small: most activity terms sit under 4,400/month, and only planning poker (33,100) is large. Separate apps would duplicate room logic for little gain.
- **Recommended hybrid.** Keep one room engine. Model each activity as a reducer module with its own command, event and projection rules. Put one landing page per activity on the static Astro site, which the stack already has, linking to `/room/<slug>` with the activity preset. Search visibility then comes from the marketing site, and the room stays single.

## Competitor bundling
- **Parabol** (open source, AGPL-3.0): retro, sprint poker, stand-ups, check-ins, team health, icebreakers, timer and 40+ templates, free forever for up to 2 teams. Its 2026 team health check is on paid Team and Enterprise plans only. Its team health rebuild, per TeamRetro's guide, includes a Spotify question pack.
- **TeamRetro**: retro, stand-ups, health checks and estimation in one place. No free-forever tier, a 30-day trial, from $250 per team per year.
- **EasyRetro**: retro-first, 100+ templates, 2 public boards a month free. The sources read do not describe poker.
- **ScrumJam**: its comparison table marks planning poker as present, with a free tier of 10 sessions. This is from a search snippet.
- **Neatro**: free for up to 10 members, and no planning poker per ScrumJam's table.
- **Miro and FigJam widgets, Kollabe, PlanITpoker**: not checked.

## Demand measures used
- The Keywords Everywhere list is a third-party estimate. It is not Google Ads data and not Ahrefs or Semrush data. Semrush describes volume as the average monthly searches per term, which is an estimate.
- Google Trends gives a relative index from 0 to 100 (Semrush's Google Trends guide, search snippet). I did not retrieve per-term Trends data.
- A Miro agile retrospective template shows 1.8K uses on its page (no date given). That is a weak adoption proxy, not search demand.

## Ecosystem note for the rewrite
- The npm package `elysia` reports latest 1.4.32 on its latest tag. I did not verify the Elysia 2 release candidate tag or its date. Confirm that before committing to the RC.

## Recommendation
Build the room with one event model. Add fist of five and T-shirt sizing first, then dot voting, then the timer and random picker. Put the per-activity pages on the Astro site.

**Decide now, because these cannot be retrofitted:**
- The event envelope must carry an activity-typed payload, with a per-seat projection rule for each activity that takes input. A second input type later changes the shared schema.
- The active activity is room state, not part of the URL path, so switching is a command.
- Anonymity is enforced by the server projection, not by the client.
- Anonymous free-text items (retro cards) need a different storage model. Leave room for it in the envelope, or decide now that retro is out of scope.
- Whether rooms persist in Postgres on the free tier. This decides whether history, such as team health trends, is possible at all.
- The Umami event-name scheme for activity usage, since historic events cannot be renamed later.

**Main tradeoffs:** one room means one larger reducer with more property tests. Separate tools are cheaper to build per page but split users and duplicate the reconnect and privacy logic.

**Open:** the Ahrefs and Semrush figures, Google Trends per term, the Miro/FigJam, Kollabe and PlanITpoker bundling, and the leading free tools for dot voting, fist of five, ROTI, lean coffee, magic estimation and mood charts. These were not checked in this run.

## Not verified

- Ahrefs and Semrush keyword volume for the named activities: Ahrefs page returned 404 and was not retried. The Semrush keyword checker was not read, so no Semrush figure was retrieved.
- Google Trends per term for the named activities: No per-term Google Trends data was retrieved; the Trends search result was only the home page.
- Leading free tools for dot voting, fist of five, ROTI, magic estimation, lean coffee, niko-niko, async estimation polls, decision matrices, and capacity calculators: Not searched in this run.
- Whether Miro/FigJam poker widgets, Kollabe and PlanITpoker bundle retro, health or other activities: Not checked in this run.
- Activity definitions for fist of five, ROTI, lean coffee and niko-niko: Described from common agile practice without a primary source read in this run.
- Elysia 2 release candidate version, tag and date: The npm latest tag is 1.4.32; the RC tag was not located.

## Sources

- https://www.teamretro.com/blog/best-retrospective-tools/
- https://www.parabol.co/
- https://keywordseverywhere.com/ctl/top/project-management-keywords
- https://engineering.atspotify.com/2014/09/squad-health-check-model
- https://www.scrumjam.app/blog/best-retrospective-tools-2026
- https://www.semrush.com/kb/683-what-is-search-volume-in-semrush
- https://www.semrush.com/blog/google-trends/
- https://www.npmjs.com/package/elysia
- https://miro.com/templates/agile/?amp=&page=4
- https://echometerapp.com/en/best-free-agile-tools-2026/
