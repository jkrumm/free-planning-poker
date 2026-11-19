# v9 product and UX concept

What the rewritten product does and how it feels. The three figures are wireframes drawn from the planned seat geometry: they show structure and states, not the final look, which the table prototype settles. `ARCHITECTURE.md` says how it is built and `PLAN.md` in which order; where they disagree with this file on behaviour, this file wins. Competitor facts and platform limits are from `research/r07-ux-competitive.md`, `r06-rendering-motion.md` and `r04-spa-stack.md`.

## Position

Free, no-signup planning poker is a crowded category: about ten new entrants in 24 months, most of them open source. "Free and no account" no longer sets a tool apart. What users complain about is caps (9 rounds, 7 or 10 participants), ads, paywalled basics and dated interfaces. v9 competes on five claims, each one checkable:

| Claim | How it is kept |
|-|-|
| From the landing page to a seat in under 10 seconds | one click, one name field, no account, no dialog wall |
| No cap on rounds or rooms, no ads | unlimited rounds and rooms, 30 players per room where free tiers elsewhere stop at 7 to 10, nothing paid |
| Nobody sees a vote before the reveal, not even in the network tab | the server withholds values until the reveal |
| No account, no cookie, no banner, and no name in any record | visits are counted by cookieless Umami; an anonymous device id counts the days you estimated and is never stored with a room or a vote. History knows seats by number, not by name |
| A reload, a sleeping phone or a deploy never costs you your seat or your vote | seat tokens, resume, handoff between server versions |

Beyond the five claims, the result view is where v9 differs in use. Estimation practice has moved from "what is the number" to "where do we disagree": the spread is the useful output, the average is not. v9's result view leads with the spread and names who should talk.

## Who uses it

- **A team of 3 to 9 in a refinement or planning meeting**, on a video call, each on a laptop. The main case; the table is designed for it.
- **A large group of 10 to 30**, a department or a workshop. The room must stay readable and nobody may wait on an absent seat.
- **Someone joining from a phone**, on the couch or in a meeting room without a laptop. Everything works; the layout is different.
- **The person who runs the meeting.** Shares the link, sets the topic, reveals, decides on a re-vote, wants a record at the end.

## Principles

1. **The table is the interface.** Who is here, who has voted and who everyone is waiting for are readable at a glance, without opening a panel.
2. **The spread is the product.** Results show agreement and outliers first.
3. **The fast path is never slower than v1.** Every animation is short and skippable, every action has a key.
4. **Play is optional and earned.** Celebration happens on consensus, not on every click. One switch turns the game feel off.
5. **Desktop first, phone complete.** No action is missing on a 360 px screen.
6. **Quiet by default.** Sound is off until the user turns it on; nothing loops; nothing moves while the user reads.

## The room

A room is a URL. Opening `/room/<slug>` seats you after you give a name; the same link is the invitation. Rooms have no owner account. By default every player may reveal, decide, move on, change settings and remove someone, as in v1, because small teams trust each other. The person who created the room is its first facilitator and can turn on the **facilitator lock**, after which only facilitators run the round. Spectators watch and never block a reveal.

Two things are new and optional. A room can have a **password**: asked once per person, then the seat remembers. And a room has a **room key**, a link its creator gets once, to keep. Whoever holds it is the room's admin and decides what outlives a meeting: the password, deleting the room, later the integrations. Running a round never needs the key.

What a team estimates is a **topic**: typed, pasted as a list, or left unnamed. A round is one attempt at it and has two states. **Voting:** players pick a card, can change it, and see only who has voted. **Revealed:** values are fixed and the result view is shown. From there the team settles the **final value**, votes again on the same topic, or moves on.

| Seat state | Shown as |
|-|-|
| thinking | avatar, empty card slot |
| voted | a face-down card slides into the slot |
| away (tab hidden 30 s) | dimmed; does not block auto reveal |
| reconnecting | outline pulse, after 3 s of lost connection |
| spectator | sits in the rail beside the table, no card slot |
| facilitator | a small marker on the avatar |
| you | accent ring, always at the bottom centre |

Presence, vote and role combine: an away seat that has voted keeps its face-down card and is dimmed.

![The table at 6, 12, 20 and 30 players, with the seat states](img/table-sizes.svg)

Avatars are generated from a random seed in a few shapes and token colours, re-rolled in settings. No uploads, no photos.

## Flows

**First visit.** Landing page → "Start planning" → the table appears with your seat already there and its name field focused, prefilled with a suggestion → Enter. The centre of the empty table holds the invitation: copy link, QR code. No modal stands between the click and the table.

**Joining by link.** The table is visible behind a single name field. A returning visitor is seated at once with the stored name.

**A round.** The topic sits in the round bar and is editable in place. Players choose a card with a click, with the keys `1` to `9` and `0` for the first ten cards, or with the arrow keys and Enter for any card. The bar shows "7 of 9 voted" as a segmented meter. After 20 seconds it names who is missing, and any player can poke them. Reveal with the button or Enter; with auto reveal on, a three-second ring starts when the last active player votes, and any player can cancel it.

**Agreement.** When every card is the same, that value is the topic's final value at once, and the room celebrates. Nobody clicks anything.

**Disagreement.** The result says "Spread 3 to 13. Anna voted lowest, Ben highest." The distribution bar is also the decision: the card closest to the middle is marked as the suggestion, and a click on any bar settles the final value. The other action is a re-vote, which keeps the topic and clears the cards. The final value shows in the topic list and can be corrected there.

**A protected room.** The link opens the table behind one password field. A wrong password says so and nothing else; the room's name and who is in it stay hidden until the password is right. The admin sets, changes or removes the password in the room's settings and can sign everyone out when it changes.

**A large room.** The table steps down to smaller seats and finally to a grid (rules under "Layout by size"). Spectators stay in the rail. Auto reveal ignores away seats, so one absent person never stalls 29.

**Coming back.** `/room` lists the rooms this device has visited, newest first; each can be removed, and one unused for six months drops off by itself. The same list opens from the room's header as a switcher, so moving between two teams' rooms is two clicks. v1's jump from the home page into the last room is dropped: it surprised people who wanted the home page. The browser tab is titled with the room's name.

**Ending a session.** The summary lists every topic with its final value, spread, number of rounds and duration, with copy as Markdown and export as CSV. A topic without a final value shows its most common card, marked as open.

## Layout by size

The layout follows the width of the room container, by container queries, so the embedded variant gets the right layout too.

| Width | Table | Hand | Panels |
|-|-|-|-|
| 1100 px and more | ring of seats around a superellipse table | docked along the bottom, a shallow arc | one side panel: people, insights, settings |
| 700 to 1099 px | ring, smaller seats | docked | panels open as sheets |
| under 700 px | no ring: a status strip, then a seat grid of four or five columns | bottom sheet with two rows of large cards | full-screen sheets; the result is one |

![Room layout at three container widths](img/layouts.svg)

Seat size steps down at 9 and at 17 players. The grid replaces the ring when the container is under 700 px wide or the room has 25 or more players. A Table/Grid switch overrides the automatic choice and replaces v1's "prefer card view".

Seats are spaced by arc length around the table edge, with the viewer always at the bottom centre. The geometry is therefore a pure function of seat count and container size, and it is tested without a browser.

## The reveal

The reveal is the only choreographed sequence. It takes at most 1.6 seconds:

![The reveal in four frames: voting, flip, sort, result](img/reveal.svg)

1. Cards flip in seat order, 320 ms each, the stagger scaled so that 30 seats finish as fast as 6.
2. The cards leave their seats and sort into columns by value in the centre of the table. The histogram is made of the cards themselves; each seat keeps a small chip with its value.
3. The summary line appears: consensus, near consensus (only neighbouring cards), or split with the lowest and highest seat named. Median and most common value are shown; the average only for numeric decks, and smaller.
4. On consensus the cards gather into one stack, confetti fires once, the room's streak counts up.

Enter, Space or a click on the table skips to the end state. With reduced motion the cards swap faces without movement and the histogram simply appears. Distance between cards is measured in deck positions, so the rules work for T-shirt sizes as well as numbers.

## Motion, sound, touch

- **Motion** runs on transform and opacity only, in CSS, with durations and easings as tokens (`fast` 120 ms, `base` 220 ms, `slow` 400 ms). A JavaScript animation library is added only if the table prototype shows a need CSS cannot meet. Nothing animates in a loop.
- **Sound** is five short samples: card placed, reveal, consensus, poke, someone joined. Off for new users, one toggle, remembered on the device. Users who had sound on in v1 keep it.
- **Haptics** are a 10 ms tick on Android when a card lands. iOS offers none to web pages; nothing depends on it.
- **Reactions** are emoji thrown at a seat: an arc, a small bounce, gone. One every two seconds per person, never stored. The same mechanism carries the poke. A competitor's operator calls throwing things their most loved feature; it costs one ephemeral message type.

## Game feel without fatigue

A tool opened every day must not perform every day. The rules:

- Celebration happens only on consensus, once per round.
- Streaks ("4 in a row") are a small counter, never a popup.
- Round badges ("fastest round", "widest spread") appear in the session summary, not during play.
- **Calm mode**, per person, turns off reactions, confetti, sound and streaks. A room setting can disable reactions for everyone.

A personal record lives only on the device: rounds played, how often you matched the most common card, whether you tend to vote higher or lower than your teams. It is computed in the browser from what your own seat saw and is never sent anywhere.

## Decks and facilitation

- **Decks** are data: Fibonacci (default, as v1), modified Fibonacci, T-shirt, powers of two, and custom values; `?` (abstain) and a break card are available in each. Every card carries a number behind its label, and T-shirt sizes map onto the Fibonacci numbers, so history and statistics compare across decks.
- **Topics.** Type a topic or paste a list, one per line. A line that starts with a ticket key ("SHOP-123 Checkout redesign") or is a tracker link keeps that reference, so the result can find its way back later. The queue feeds the round bar, survives the weekend, and holds up to 200 topics.
- **Timer.** Optional countdown of 30, 60 or 120 seconds as a ring on the round bar. When it runs out with auto reveal off, nothing happens. With auto reveal on, it starts the same cancellable three-second ring as the last vote does.

Not at launch, in the order they are likely to come:

- webhooks that send each result to an address the admin sets, including Slack and Teams
- a route that lets a script or an automation fill a room's queue
- a Jira app that frames the room on an issue or a board and writes the story points back
- a wheel that picks who speaks first
- asynchronous rounds
- a second language
- an AI seat
- the owner's silent observer seat for support, which needs a line in the privacy page before it exists

None of these changes a table or the protocol when it arrives: the topic already carries its tracker reference, and every result already leaves the room in one shape (`ARCHITECTURE.md`, "Built for what comes next").

## Insights

- **In the room:** rounds per session, share of rounds with consensus, typical spread, time to reveal, how often each card wins. Built from basalt-ui's chart kinds: bars, lines, a weekday-by-hour heatmap, sparklines in stat cards.
- **Public statistics page** at `/analytics`, as today but honest: totals, rounds per week, card popularity, consensus rate, when the world estimates, tables open right now. v1 shows invented fallback numbers when its database is down; v9 shows the last known figures with their date.

## Phone, install, embed

- **Phone.** The layout is the under-700 px row above. Every card is reachable with one thumb, and names in the seat grid wrap rather than truncate. The socket drops when the browser is backgrounded; coming back restores the seat without a prompt.
- **Install.** The room app is installable. Opened from the home screen it starts at `/room`. Offline it shows the shell and says so; it never queues a vote.
- **Embed.** `?embed=1` drops the site chrome so the room fits a Jira panel, a Teams tab, a Miro board or a wiki page; all of them run embedded apps in frames. The embedding page can hand the room its topics and receives each result, so a host can write the estimate into its own ticket. Room settings show the snippet to copy. Inside a frame the browser keeps storage apart, and Safari forgets it between launches, so a returning person may be asked for the name again and gets the old seat back by giving it.

## Accessibility

Seats are a list in DOM order with arrow-key movement; the ring is presentation. A live region announces progress ("7 of 9 voted") and the result, never anything that would hint at a vote before the reveal. A voted seat is marked by shape, not colour alone. Every action has a key, listed in the command palette (`Cmd+K`). Contrast comes from basalt-ui's derived tokens. Reduced motion is honoured by the system setting and by calm mode.

## Copy

Product copy follows the `broad` register of the voice guide:

- Labels are verb plus object: "Copy invite link", "Reveal cards", "Start new round".
- An error says what happened and what to do.
- An empty state points at the first action.
- One word per thing everywhere: room, seat, round, card, reveal, topic.

## The marketing site

Static pages whose only JavaScript is the 4 kB analytics script, except one island: the landing page's hero is a live table played by scripted participants. "Sit down" turns the demo into a real room. Light and dark follow the system and can be switched, on the site and in the room.

| Page | Job |
|-|-|
| `/` | the demo, the five claims, how a round works, open source and self-hosting, questions |
| `/guide` and `/guides/*` | planning poker explained, then one page per practice: decks, when a spread means split the story, running a large room |
| `/vs/*` | honest comparison pages, each fact checked on the day it is written |
| `/analytics` | public statistics |
| `/blog` | articles from a content collection, each closing with its questions and answers as structured data |
| `/docs` | every feature explained for users, with a static search; the contributor's overview stays in the repository |
| `/roadmap` | changelog from releases, and what is next; replaces the Todoist-backed page |
| `/self-hosting` | one compose file |
| `/privacy`, `/imprint`, `/contact` | what is measured and how, in plain words; the imprint as it stands |

Every existing URL keeps its path. Each page gets its own title, description, canonical link, social image and structured data, none of which v1 has.

## What changes for a v1 user

| v1 | v9 |
|-|-|
| Room by name in the URL | unchanged |
| Fibonacci 1 to 21 only | default deck, plus three more and custom, with `?` to abstain |
| A round ends at the reveal | the team settles a final value, kept per topic |
| Anyone with the link gets in | unchanged by default; a password is optional |
| No owner of a room | a room key for its creator, needed only for the password and for deleting the room |
| "Show votes" only when everyone has voted | reveal any time after the first vote, with a confirmation when seats are still thinking |
| Auto flip exists on the server without a switch | a setting, with a cancellable countdown |
| Spectator, kick, leave, rename | unchanged, subject to the facilitator lock when it is on |
| Table or card view | Table or Grid, chosen automatically by size, switchable |
| Elapsed-time counter | kept, plus the optional countdown |
| Four sounds, on by default | five sounds, off for new users |
| Confetti on a unanimous vote | kept, joined by the streak counter |
| Room statistics in the sidebar | the Insights panel |
| Home page jumps into the last room | recent rooms at `/room` and as a switcher in the room |
| Name and settings in localStorage | read once and kept |
| Feedback form | unchanged |
