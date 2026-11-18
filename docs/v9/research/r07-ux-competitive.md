# Competitive landscape and UX

Research run of 2026-11-18 (`agw research`, depth deep). Run status: ok. Citations grounded against fetched pages: 39/39. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line

- **The landscape:** Free, no-signup planning poker is a crowded, commoditised category. Kollabe, Planning Poker Online, PlanITpoker, pointingpoker.com, scrumpoker-online.org and PlanningPoker.live all run anonymous rooms, and at least five open-source no-signup clones appeared between 2024 and 2026. What separates the free tiers is their ceilings (round caps, participant caps, ads, paid issue-tracker sync), not their features.
- **Practice and features:** Fibonacci and T-shirt decks, hidden votes with one reveal, re-votes, a distribution view and async voting are now table stakes. Jira and Linear sync is the line most vendors put behind a paywall. Parabol (free for 2 teams) and PlanningPoker.live are the free-tier exceptions.
- **Recommendation:** Compete on no caps, no ads, no accounts, phone-first use, 30-person rooms, and votes the server withholds until reveal. Treat free issue-tracker import and export as the gap to close. Do not rely on 'open source plus no signup' alone, since that is no longer rare. Decide now: server-side vote withholding, how a room host keeps control without accounts, retention and telemetry scope (the privacy claim must match the OpenTelemetry and Umami setup), the licence, the brand name, and an append-only event model for votes.

## 1. Named tools: free tier, paid tier, sign-up, maturity

**planningpokeronline.com (We Agile You).** Basic is $0 with unlimited players, 9 voting rounds per game, 5 voted issues per game, CSV import, and “unlimited games for 6 weeks” with permanent game URLs. Premium is $30 per facilitator per month or $300 per year, with unlimited rounds, unlimited issues and history. The site claims ISO 27001 and GDPR compliance. The operator says it reached 147,000+ monthly users, spent more than €60k on Google Ads without result, collects no email addresses, and shipped a Jira plugin in March 2024 ([planningpokeronline.com](https://planningpokeronline.com/); [operator write-up on dev.to](https://dev.to/miquelcdp/6-years-building-planning-poker-online-from-a-weekend-project-to-147k-users-and-3-mistakes-i-had-4a04)). Its UX strength is the poker-table metaphor with emoji throwing. Complaints found: the round and issue caps. The operator also says its generic domain hurts brand recall now that LLMs treat “planning poker online” as a generic phrase. Trustpilot shows 4.5 from 13 reviews ([Trustpilot](https://uk.trustpilot.com/review/planningpokeronline.com), snippet).

**Kollabe.** The free plan has unlimited rooms, 10 team members per room, and 7-day meeting history. Integrations are paid. Planning Poker Only is $12 per space per month ($120 per year). Premium is $29 per month per team ($290 per year), and adds Jira, GitHub, Azure DevOps and Linear sync, export, and an API and MCP server. No signup is required ([kollabe.com](https://kollabe.com)). Its planning-poker page claims rooms for up to 500 users, which contradicts the 10-member free cap, so the free participant limit is unclear ([kollabe.com/planning-poker](https://kollabe.com/planning-poker), snippet). Kollabe removed its round cap on free meetings in 2025, after saying it had added “the same restriction we once hated” and that hidden limits drove churn ([r/Kollabe announcement](https://www.reddit.com/r/Kollabe/comments/1n7qx8t/unlimited_planning_poker_rounds_for_free_teams/)). Its homepage counters (1,025,386 active users, 6,258,002 votes) are self-reported.

**Parabol Sprint Poker.** The free Starter plan covers up to 2 teams, 10 meetings per month, 30 days of history and unlimited users. It includes Sprint Poker and 7 integrations. Team is $8 per active user per month ([parabol.co/pricing](https://www.parabol.co/pricing/)). Sprint Poker offers Fibonacci, T-shirt, 5 fingers, WSJF and custom scales, with Question and Pass cards. It pulls issues from Jira, GitHub and GitLab using JQL or GitHub syntax, syncs estimates back, and produces an automatic meeting summary and CSV export ([parabol.co Sprint Poker](https://www.parabol.co/agile/sprint-poker/)). **Licence:** the repository's LICENSE file is Business Source License 1.1, not an OSI open-source licence. It converts to AGPL-3.0 four years after each version is published ([LICENSE](https://raw.githubusercontent.com/ParabolInc/parabol/master/LICENSE)). The site still describes itself as “Open Source & Fully Auditable Code” ([pricing](https://www.parabol.co/pricing/)). A competitor blog says every participant needs an account and the guided flow is heavy ([Kollabe blog, vendor-authored](https://kollabe.com/posts/best-free-planning-poker-tools)).

**PlanITpoker.** The free plan is $0 for 7 participants, with unlimited rooms and stories, multiple decks, and CSV and XML import. Premium is $20 per month for unlimited participants ([planitpoker.com/pricing](https://planitpoker.com/pricing/)). Quick play needs no signup, and accounts are optional ([planitpoker.com](https://planitpoker.com/)). The footer still reads “Copyright 2014-2023”. A competitor blog says the free tier is ad-supported ([Kollabe blog](https://kollabe.com/posts/best-free-planning-poker-tools)). I did not confirm ads on the site. A Reddit commenter wrote that PlanITpoker “was no longer going to be free for our team” ([r/scrum, snippet](https://www.reddit.com/r/scrum/comments/mzkph5/i_created_a_free_lightweight_open_source_planning/)); the date metadata is unreliable.

**scrumpoker-online.org.** Three tiers. Anonymous (no signup) covers room creation, link and QR sharing, reveal, reset and clear, in six languages, with ads. A free account adds custom card values and host controls (hide, clear, delete votes), with ads. Premium is $40 per year. It removes ads for everyone in the owner's room, and adds a voting timer, automatic average and median, an attendance indicator, and a personal reusable room ID ([scrumpoker-online.org pricing](https://www.scrumpoker-online.org/en/pricing/)). The root domain returns only a redirect shell, so I read the pricing page only.

**pointingpoker.com.** Free, no signup, no account, ad-supported, with a retrospective mode. The site reports 86,594,089 total votes (self-reported), and a live snapshot of 217 sessions and 526 players. It states that it collects no personal data ([pointingpoker.com](https://www.pointingpoker.com)).

**Atlassian Marketplace (Jira).** The listings I read:
- *Planning Poker Agility* (Agile Pulse): free, 4.6 out of 5 from 77 ratings, 3,224 installs, version 2.9.0 released 14 Nov 2026. It offers Fibonacci, time-based and custom values, automated reveal, and a definition-of-ready check. Its listing promotes a Forge-based successor, SprintPoker ([Atlassian listing](https://marketplace.atlassian.com/apps/1233038/planning-poker-agility-free-estimation-sizing-for-jira)).
- *Planning Poker Online for Jira* (We Agile You): paid via Atlassian, 4.8 out of 5 from 8 ratings, 601 installs, version 4.10.0 released 26 Oct 2026. It adds a Rovo AI player that gives its own estimate after reveal, and auto-saves results to the issue ([Atlassian listing](https://marketplace.atlassian.com/apps/1233326/planning-poker-online-for-jira?hosting=cloud&tab=overview)).
- Other listings seen in search but not read: Planning Poker ® (2014), Agile Poker for Jira (2011), Sync Poker (2025), Pokerly (2026), and a “Live & Async” Jira app (2026).

**Easy Agile TeamRhythm.** Planning Poker sits inside a Jira-native story-mapping and retro suite. It has a 30-day trial, is free for up to 10 users, and is priced per user tier beyond that ([easyagile.com/pricing](https://www.easyagile.com/pricing)). Its Marketplace listing says it estimates commitment inside the user story map ([Marketplace snippet](https://marketplace.atlassian.com/apps/1212078/easy-agile-teamrhythm-user-story-map-retrospectives?tab=overview)). It targets Jira-committed teams, not the anonymous free audience.

**Miro Estimation app.** Miro's free plan has 3 editable boards. Timer and voting facilitation are listed under the paid Starter plan at $8 per member per month billed yearly. Business at $20 adds two-way Jira and Linear sync ([miro.com/pricing](https://miro.com/pricing/)). Miro's estimation page describes private votes, reveal, one-click sync to Jira and Miro AI clustering of backlog items ([miro.com/agile/planning-poker](https://miro.com/agile/planning-poker/)). I did not confirm whether the Estimation app itself is free.

**FigJam estimation widgets.** FigJam is included with every seat on every plan ([figma.com/figjam, snippet](https://www.figma.com/figjam/)). A third-party review says the free plan caps you at 3 FigJam files and offers native voting and timers ([RetroTools review, snippet](https://www.retrotools.io/tools/figjam)). I did not read a primary source for the estimation widget itself.

## 2. Newcomers

- **PlanningPoker.live.** No signup, open source (GitHub link), embedded in Zoom, Teams, Meet and Webex. Jira and Linear import with estimate push-back, password-protected rooms, and an experimental PokerBot that writes a post-session summary. It claims a 4.5 rating from 1,000+ reviewers, a self-claim ([planningpoker.live](https://planningpoker.live)). Its pricing page was not read.
- **Open-source clones**, mostly published 2024 to 2026:
  - openplanningpoker.com: no signup, works on phones, self-hostable ([snippet, indexed 17 Nov 2026](https://openplanningpoker.com/)).
  - alxndr-bnd/planning-poker (Serbito): free, no registration, real-time, self-hosted ([GitHub snippet](https://github.com/alxndr-bnd/planning-poker)).
  - gllmt/open-poker-planning: Next.js with Convex, token-based rooms, no login ([GitHub snippet](https://github.com/gllmt/open-poker-planning)).
  - RezaHoque/planning-poker: no accounts, SignalR, Docker ([GitHub snippet](https://github.com/RezaHoque/planning-poker)).
  - rie03p/planning-poker: Cloudflare Workers with Durable Objects, “no voting limits”. Its Show HN got 2 points ([HN item 46372480](https://news.ycombinator.com/item?id=46372480)).
- **Hacker News.** scrum.host's Show HN (December 2024) pitched free planning poker and retros with no signup, against tools that are “overcomplicated or locked behind paywalls” ([HN item 42314495](https://news.ycombinator.com/item?id=42314495)). Hacker News attention is small and short-lived. The planningpokeronline operator says a 2020 HN post brought 2,000 users in a week ([dev.to](https://dev.to/miquelcdp/6-years-building-planning-poker-online-from-a-weekend-project-to-147k-users-and-3-mistakes-i-had-4a04)).
- **Other 2026 entrants** seen on Reddit and Product Hunt (snippets): “The Planning Poker” on Product Hunt (November 2026), with no signup, Fibonacci, T-shirt and custom decks, CSV export, emoji throwing and a hall of fame ([Product Hunt](https://www.producthunt.com/products/the-planning-poker)); an ad-free Fibonacci-only app ([r/scrum](https://www.reddit.com/r/scrum/comments/1utgvnu/free_planning_poker_app_seeks_for_feedback/)); PointWalk ([r/scrum](https://www.reddit.com/r/scrum/comments/1xfqam4/i_built_a_free_planning_poker_tool_would_love/)); Deckr, with an AI assistant ([r/agile](https://www.reddit.com/r/agile/comments/1jnf5pn/ive_created_a_online_planning_poker_tool_do_you/)); Fermi Poker, a betting-style estimator on Hacker News ([HN, Nov 2026](https://news.ycombinator.com/item?id=50403395)).

About ten recent entrants in 24 months show that free, no-signup and open source alone do not differentiate.

## 3. Complaints from reviews, Reddit and Hacker News

- **Ads.** The most-cited complaint. A Reddit author wrote that existing tools were “littered with Amazon ads” and paywalled basics such as voting history and custom decks ([r/scrum, Jul 2026](https://www.reddit.com/r/scrum/comments/1uytejf/made_a_free_scrum_poker_tool_already_100_users/)). pointingpoker.com states it is ad-funded, and scrumpoker-online's free tiers show ads.
- **Hidden caps.** Kollabe's founders say a 10-round limit stopped a real meeting, and that hidden limits drove churn ([r/Kollabe](https://www.reddit.com/r/Kollabe/comments/1n7qx8t/unlimited_planning_poker_rounds_for_free_teams/)). PlanningPoker Online caps free rounds at 9 and issues at 5 per game ([pricing](https://planningpokeronline.com/)).
- **Signup and time limits.** A Reddit post from April 2026 says its author built the tool because existing sites “required account creation and imposed restrictions on the time available for estimating story points” ([r/scrum snippet](https://www.reddit.com/r/scrum/comments/1sp7ej3/planning_poker_feedback/)).
- **Paywalled integrations.** Kollabe and PlanningPoker Online put Jira and Linear sync behind paid tiers. Competitor blogs present free sync as the gap ([Kollabe blog](https://kollabe.com/posts/best-free-planning-poker-tools)).
- **Accounts and weight.** Parabol requires accounts and is described as heavy for a quick vote. PlanITpoker's interface is described as dated (competitor claims).
- **Sentiment.** Some Reddit replies greet new tools with “Oh no, not another one!” ([r/scrum](https://www.reddit.com/r/scrum/comments/1uytejf/made_a_free_scrum_poker_tool_already_100_users/)). That is a saturation signal, not a product complaint.
- **Positive signal.** Users praise the play feel and low friction. The planningpokeronline operator quotes feedback such as “team loves it and promotes conversations” and “stays out of the way” ([dev.to](https://dev.to/miquelcdp/6-years-building-planning-poker-online-from-a-weekend-project-to-147k-users-and-3-mistakes-i-had-4a04)).

## 4. Estimation practice trends

- **Fibonacci** remains the default. PlanningPoker Online, Parabol, Kollabe and scrumpoker all ship it first. Kollabe reports that its most common custom deck is Fibonacci capped at 13, and that the first vote is unanimous only about 1 time in 6. These are self-reported figures across 5.4 million votes, so treat them as low confidence ([Kollabe blog](https://kollabe.com/posts/best-free-planning-poker-tools)).
- **T-shirt sizing** is supported by every tool read. Parabol adds 5 fingers and WSJF for SAFe teams.
- **Async estimation** is now expected. Kollabe, PlanningPoker Online for Jira (“Live, Async or Hybrid”), Parabol (“async-safe”), PlanningPoker.live and Miro all support it.
- **#NoEstimates** is a mature debate, not a growing one. A 2026 TeamRetro verdict summarises Allen Holub's objection that estimates are inaccurate, Vasco Duarte's finding that counting stories forecasts about as well as summing points, and Ron Jeffries's 2019 remark that he “may have invented story points, and if I did, I'm sorry now”. Its conclusion: “The number is worthless; the conversation that made it is the point” ([TeamRetro](https://www.teamretro.com/guides/agile-verdicts/story-points-vs-noestimates/)). This supports framing planning poker as a disagreement detector, not a forecast.
- **AI-assisted estimation.** An RIT study (arXiv 2603.06276) found that zero-shot LLMs predicted story points better than supervised deep learning trained on 80% of the data, across four LLMs and 16 projects. Few-shot examples improved results further ([arXiv](https://arxiv.org/html/2603.06276)). Product uptake takes the form of AI players and summaries: the Rovo player in PlanningPoker Online for Jira, PokerBot on PlanningPoker.live, Miro AI clustering, Kollabe AI summaries (paid), and Parabol AI summaries (Team plan).

## 5. Issue tracker integrations

- **Jira:** Planning Poker Online for Jira (paid via Atlassian), Planning Poker Agility (free), Easy Agile (native, per-user pricing), Parabol (free tier), Miro (Business tier), Kollabe (Premium), PlanningPoker.live (import and sync).
- **Linear:** Linear's integrations directory lists Kollabe, PlanningPoker.live, Team O'clock, Parabol and Spades as collaboration integrations ([linear.app](https://linear.app/integrations/collaboration), snippet). Kollabe's Linear sync is paid ([Kollabe Linear page, snippet](https://linear.app/integrations/kollabe)).
- **GitHub:** Parabol (free; search by GitHub syntax; sync to a comment or label), Zenhub (GitHub-only; basic free plan after trial), Kollabe (paid).
- **Azure DevOps:** Kollabe (paid), and Parabol per its README.
- **No integration:** CSV, XML and clipboard import (PlanningPoker Online, PlanITpoker, PlanningPoker.live).

## 6. Facilitation features

- **Timer:** Parabol (in every meeting), scrumpoker-online (Premium), Miro (paid), Kollabe (per its Linear page).
- **Auto reveal:** Planning Poker Agility (automated reveal). Most others use a manual reveal button.
- **Re-vote:** Parabol supports it. PlanningPoker Online caps it at 9 rounds. Kollabe removed its round cap on free meetings.
- **Consensus and spread:** PlanningPoker Online shows result bars, Parabol shows the distribution and most common estimate, PlanningPoker.live highlights edge cases, PlanITpoker shows graphs. Spread visualisation is standard, and TeamRetro's point is that the spread is the useful output.
- **Hidden votes:** Parabol shows who has voted but not what they chose, to prevent anchoring. Miro uses a private vote before reveal.
- **Spectators and breaks:** no evidence for either in the tools read. Unverified.
- **Attendance indicator:** scrumpoker-online Premium.
- **Host controls:** scrumpoker-online free account (hide, clear, delete votes).
- **Icebreakers:** Parabol (optional).

## 7. Gamification and retention

- **Gamification:** planningpokeronline's poker table, avatars, emoji and projectile throwing, and a robot that reacts when consensus is reached. Its operator calls throwing “the most loved feature” ([dev.to](https://dev.to/miquelcdp/6-years-building-planning-poker-online-from-a-weekend-project-to-147k-users-and-3-mistakes-i-had-4a04)). Pointing Poker's retro product has a hall of fame. Nothing else of substance was found.
- **Retention:** The planningpokeronline operator collects no email, so it cannot re-market to churned users, a trade-off it accepts ([dev.to](https://dev.to/miquelcdp/6-years-building-planning-poker-online-from-a-weekend-project-to-147k-users-and-3-mistakes-i-had-4a04)). Kollabe's reversal suggests that hidden caps churn users. Parabol's 30-day history and scrumpoker's personal reusable room ID are the explicit retention hooks found.

## 8. Session summaries and exports

- **Parabol:** automatic summary after each meeting, with each story, final estimate, total points and team velocity, plus CSV export ([Parabol Sprint Poker](https://www.parabol.co/agile/sprint-poker/)).
- **PlanningPoker.live:** PokerBot writes a summary of events, votes and highlights (experimental).
- **Kollabe:** data export and full history on paid plans. The free plan keeps 7 days.
- **PlanningPoker Online:** CSV import on the free plan. Results auto-save to the Jira issue in the Marketplace app.
- **PlanITpoker:** voting statistics, and CSV or XML import.

## 9. Jobs to be done, table stakes, differentiators

**Jobs to be done**
1. Start an estimate in seconds, with no account for the host or the team.
2. Keep each vote private until everyone has voted, so no one anchors.
3. See the spread and outliers, then talk until the spread closes.
4. Re-vote, or split a story, when the team cannot agree.
5. Move the agreed number back to the backlog without retyping.
6. Estimate across time zones, asynchronously or in a hybrid of both.
7. Run it from a phone during a video call, without installing anything.
8. Leave a short record of what was decided.

**Table stakes (2026)**
- No signup for host and participants.
- Votes hidden until reveal, with one reveal action.
- Fibonacci, T-shirt and custom decks.
- Re-vote.
- A distribution view.
- Async voting.
- A phone layout that works.
- A shareable link.
- No ads, or ads kept clearly separate from the session.

**Credible differentiators for this app**
- **No caps.** Unlimited rounds, and a 30-person room ceiling. Free competitors cap at 7 to 10 participants (PlanITpoker, Kollabe) or 9 rounds (PlanningPoker Online).
- **No ads and no paid tier for the core session.** This removes the complaint most cited on Reddit.
- **Server-enforced hidden votes.** Several tools appear to hide votes only in the client. That is an inference from the sites read, not a tested finding, so confirm before claiming it.
- **A disagreement-first result view:** spread, outliers and a “discuss” prompt, in line with the TeamRetro framing.
- **Free import and export of issue lists** (CSV, pasted clipboard), plus an open-source, self-hostable build with a clear licence. The Parabol example shows that an open-source claim can mismatch the licence.
- **Verifiable privacy.** Name exactly what is stored and what telemetry runs. PlanningPoker Online's ISO 27001 claim is a marketing differentiator, but a small team can match the practice without the certificate.

## 10. Recommendation and tradeoffs

**Recommendation.** Build the room SPA on the planned stack, but make the free promise explicit and measurable: no signup, no ads, no round or room caps within a 30-person room, phone-first, votes withheld by the server, and free CSV or clipboard import of issues. Add free Jira or Linear sync later, through the API, once the core is stable. Market the tool on the no-caps and no-ads claims, because these are the most-cited complaints.

**Tradeoffs.**
- *In-memory room state on one VPS.* Simple and fast for 2 to 30 people, but a single point of failure, and rolling deploys must keep room state alive. A 30-person room and a few hundred concurrent rooms fit a small VPS. Verify with load tests, not assumption.
- *Anonymous identity.* A client-generated ID in localStorage is simple and private, but it is lost when the user clears storage or changes device. Accept that, and say so in the product.
- *Free tier with no revenue.* The operator carries the cost. Kollabe and PlanningPoker Online chose paid tiers. Ads (scrumpoker, pointingpoker) are the alternative users complain about. Decide whether donations or self-hosting are the only revenue options.
- *Integrations.* Free sync adds scope and OAuth maintenance, and paid tiers are what fund competitors. Import and export first, sync later.
- *Analytics.* OpenTelemetry, ClickStack and Umami are useful, but they conflict with a strict privacy claim unless their scope is limited to aggregate, non-identifying data. Write the policy before launch.

**Must be decided now, because it cannot be retrofitted**
1. **Vote visibility on the server.** Send vote values to clients only after reveal. Retrofitting this later is a protocol change.
2. **Host control without accounts.** Choose between a host secret in localStorage, a room owner token, or an unguessable room URL. Each affects how a host reclaims a room after a device change.
3. **Vote event model.** Store append-only events (join, vote, revote, reveal, reset, finalise). Summaries, exports and history all derive from it. A final-state-only model cannot produce the spread or the re-vote history later.
4. **Deck as data.** Store scale ID, values, per-card descriptions, and Question and Pass cards as first-class fields.
5. **Issue references.** Store external references (provider, key, URL) as first-class fields, so sync can be added without a migration.
6. **Retention and telemetry scope.** Write down which fields are stored (display names, room IDs, votes), for how long, and which telemetry events carry room or user identifiers.
7. **Licence.** Pick an OSI-approved licence before accepting outside contributions, and keep the README and the LICENSE file consistent. Parabol's BSL alongside an open-source claim is the cautionary example.
8. **Brand name.** Pick a distinct brand and domain before launch. The planningpokeronline operator says a generic domain now hurts recall.
9. **Room size and connection limits.** Set the 30-person ceiling in the protocol and in load tests from day one. Competitors advertise between 7 and 500, so the number is a visible promise.
10. **Language.** scrumpoker-online offers six languages, and a Reddit newcomer offers multiple. Decide routing and i18n structure now, before marketing pages are split onto Cloudflare Workers.

## 11. Unverified

- **scrumpoker-online.org home and features.** The root URL returns a redirect shell. I read the pricing page only, and feature claims come from search snippets.
- **FigJam estimation widget.** No primary source read. The RetroTools review is third-party.
- **Miro Estimation app on the free plan.** Not confirmed.
- **Spectators and breaks.** No evidence in any tool read.
- **Kollabe free participant cap.** The homepage says 10 members per room, while the planning-poker page says up to 500 users in one room. Confirm on the live app.
- **PlanningPoker.live pricing and rating.** Pricing page not read, and the 4.5 rating is self-reported.
- **PlanITpoker ads.** Only a competitor blog claims ads. Not confirmed on the site.
- **Reddit and Hacker News complaints beyond the threads read.** Two Reddit threads and one Kollabe announcement were read in full. Other points rest on search snippets.
- **AI-assisted estimation evidence beyond arXiv 2603.06276.** A 2026 Springer study on LLM effort estimation and an arXiv paper on cognitive offloading in agile teams appeared in search but were not read, and are not cited.
- **Gamification and retention data.** No published retention numbers found for any tool.
- **Atlassian Marketplace listings beyond the two read.** User counts and pricing unknown.
- **Easy Agile planning poker documentation.** Only a search snippet was seen ([help.easyagile.com](https://help.easyagile.com/easy-agile-teamrhythm/planning-poker)).

## Not verified in this run

- scrumpoker-online.org home and features pages: Root URL returned only a redirect shell; pricing page read, features from search snippets only.
- FigJam estimation widget features and limits: No primary source for the estimation widget; third-party review only.
- Miro Estimation app on the free plan: Pricing lists timer and voting under paid Starter; availability of the Estimation app on Free not confirmed.
- Spectator mode and breaks across tools: No evidence found for either in any tool read.
- Kollabe free participant cap: Homepage says 10 members per room; planning-poker page says up to 500 users in one room; live app not checked.
- PlanningPoker.live pricing and user rating: Pricing page not read; 4.5 rating is self-reported.
- PlanITpoker ads on the site: Ad-supported status comes only from a competitor blog; not confirmed on the site.
- Reddit and Hacker News complaints beyond the threads read: Two Reddit threads and one Kollabe announcement were read in full; other complaints rest on search snippets, so the sample is small.
- AI-assisted estimation studies beyond arXiv 2603.06276: A 2026 Springer study and an arXiv cognitive-offloading paper appeared in search but were not read; not cited.
- Gamification and retention metrics: No published retention or engagement data found for any tool.
- Atlassian Marketplace listings beyond the two read: Other Jira poker apps seen in search only; user counts and pricing unknown.
- Easy Agile planning poker documentation: Search snippet only; feature detail not read.

## Sources

- https://planningpokeronline.com/
- https://kollabe.com
- https://www.parabol.co/agile/sprint-poker/
- https://planitpoker.com/
- https://planitpoker.com/pricing/
- https://www.scrumpoker-online.org/
- https://www.scrumpoker-online.org/en/pricing/
- https://www.pointingpoker.com
- https://www.parabol.co/pricing/
- https://dev.to/miquelcdp/6-years-building-planning-poker-online-from-a-weekend-project-to-147k-users-and-3-mistakes-i-had-4a04
- https://www.reddit.com/r/scrum/comments/1uytejf/made_a_free_scrum_poker_tool_already_100_users/
- https://news.ycombinator.com/item?id=42314495
- https://news.ycombinator.com/item?id=46372480
- https://miro.com/agile/planning-poker/
- https://planningpoker.live
- https://github.com/ParabolInc/parabol
- https://raw.githubusercontent.com/ParabolInc/parabol/master/LICENSE
- https://www.easyagile.com/pricing
- https://miro.com/pricing/
- https://arxiv.org/html/2603.06276
- https://www.teamretro.com/guides/agile-verdicts/story-points-vs-noestimates/
- https://marketplace.atlassian.com/apps/1233038/planning-poker-agility-free-estimation-sizing-for-jira
- https://marketplace.atlassian.com/apps/1233326/planning-poker-online-for-jira?hosting=cloud&tab=overview
- https://kollabe.com/posts/best-free-planning-poker-tools
- https://www.reddit.com/r/Kollabe/comments/1n7qx8t/unlimited_planning_poker_rounds_for_free_teams/
- https://uk.trustpilot.com/review/planningpokeronline.com
- https://kollabe.com/planning-poker
- https://openplanningpoker.com/
- https://github.com/alxndr-bnd/planning-poker
- https://github.com/gllmt/open-poker-planning
- https://github.com/RezaHoque/planning-poker
- https://www.producthunt.com/products/the-planning-poker
- https://www.reddit.com/r/scrum/comments/1utgvnu/free_planning_poker_app_seeks_for_feedback/
- https://www.reddit.com/r/scrum/comments/1xfqam4/i_built_a_free_planning_poker_tool_would_love/
- https://www.reddit.com/r/agile/comments/1jnf5pn/ive_created_a_online_planning_poker_tool_do_you/
- https://news.ycombinator.com/item?id=50403395
- https://www.reddit.com/r/scrum/comments/1sp7ej3/planning_poker_feedback/
- https://www.reddit.com/r/scrum/comments/mzkph5/i_created_a_free_lightweight_open_source_planning/
- https://linear.app/integrations/collaboration
- https://linear.app/integrations/kollabe
- https://www.figma.com/figjam/
- https://www.retrotools.io/tools/figjam
- https://marketplace.atlassian.com/apps/1212078/easy-agile-teamrhythm-user-story-map-retrospectives?tab=overview
- https://help.easyagile.com/easy-agile-teamrhythm/planning-poker
- https://www.planitpoker.com
- https://www.planningpokeronline.com
- https://www.parabol.co/sprint-poker
- https://scrumpoker-online.org
- https://www.reddit.com/r/scrum/comments/1uytejf/made_a_free_scrum_poker_tool_already_100_users?jsc_orig_r=
