# v9 product and UX concept

What the rewritten product does and how it feels. `ARCHITECTURE.md` says how it is built and `PLAN.md` in which order; where they disagree with this file on behaviour, this file wins. Competitor facts and platform limits are from `research/r07-ux-competitive.md`, `r06-rendering-motion.md` and `r04-spa-stack.md`.

## Position

Free, no-signup planning poker is a crowded category: about ten new entrants in 24 months, most of them open source. "Free and no account" no longer sets a tool apart. What users complain about is caps (9 rounds, 7 or 10 participants), ads, paywalled basics and dated interfaces. v9 competes on five claims, each one checkable:

| Claim | How it is kept |
|-|-|
| From the landing page to a seat in under 10 seconds | one click, one name field, no account, no dialog wall |
| No cap on rounds or rooms, no ads | unlimited rounds and rooms, 30 players per room where free tiers elsewhere stop at 7 to 10, nothing paid |
| Nobody sees a vote before the reveal, not even in the network tab | the server withholds values until the reveal |
| We cannot recognise you across rooms, and there is no consent banner | no user id and no tracking script. The device stores your name and settings because you set them, your recent rooms and seat tokens because you joined, and nothing else |
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

A room is a URL. Opening `/room/<slug>` seats you after you give a name; the same link is the invitation. Rooms have no owner account. By default every player may reveal, start a round, change settings and remove someone, as in v1, because small teams trust each other. The person who created the room is its first facilitator and can turn on the **facilitator lock**, after which only facilitators run the round. Spectators watch and never block a reveal.

A round has two states. **Voting:** players pick a card, can change it, and see only who has voted. **Revealed:** values are fixed and the result view is shown; the next step is a new round or a re-vote on the same topic.

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

Avatars are generated from a random seed in a few shapes and token colours, re-rolled in settings. No uploads, no photos.

## Flows

**First visit.** Landing page → "Start planning" → the table appears with your seat already there and its name field focused, prefilled with a suggestion → Enter. The centre of the empty table holds the invitation: copy link, QR code. No modal stands between the click and the table.

**Joining by link.** The table is visible behind a single name field. A returning visitor is seated at once with the stored name.

**A round.** The topic sits in the round bar and is editable in place. Players choose a card with a click, with the keys `1` to `9` and `0` for the first ten cards, or with the arrow keys and Enter for any card. The bar shows "7 of 9 voted" as a segmented meter. After 20 seconds it names who is missing, and any player can poke them. Reveal with the button or Enter; with auto reveal on, a three-second ring starts when the last active player votes, and any player can cancel it.

**Disagreement.** The result says "Spread 3 to 13. Anna voted lowest, Ben highest." with one action: re-vote. A re-vote keeps the topic and clears the cards.

**A large room.** The table steps down to smaller seats and finally to a grid (rules under "Layout by size"). Spectators stay in the rail. Auto reveal ignores away seats, so one absent person never stalls 29.

**Coming back.** `/room` lists the last ten rooms on this device. v1's jump from the home page into the last room is dropped: it surprised people who wanted the home page.

**Ending a session.** The summary lists every topic with its agreed value, spread, number of rounds and duration, with copy as Markdown and export as CSV. A topic nobody agreed on shows its most common card, marked as open.

## Layout by size

The layout follows the width of the room container, by container queries, so the embedded variant gets the right layout too.

| Width | Table | Hand | Panels |
|-|-|-|-|
| 1100 px and more | ring of seats around a superellipse table | docked along the bottom, a shallow arc | one side panel: people, insights, settings |
| 700 to 1099 px | ring, smaller seats | docked | panels open as sheets |
| under 700 px | no ring: a status strip, then a seat grid of four or five columns | bottom sheet with two rows of large cards | full-screen sheets; the result is one |

Seat size steps down at 9 and at 17 players. The grid replaces the ring when the container is under 700 px wide or the room has 25 or more players. A Table/Grid switch overrides the automatic choice and replaces v1's "prefer card view".

Seats are spaced by arc length around the table edge, with the viewer always at the bottom centre. The geometry is therefore a pure function of seat count and container size, and it is tested without a browser.

## The reveal

The reveal is the only choreographed sequence. It takes at most 1.6 seconds:

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

- **Decks** are data: Fibonacci (default, as v1), modified Fibonacci, T-shirt, powers of two, and custom values; `?` and a break card are available in each.
- **Topics.** Type a topic or paste a list, one per line, optionally with a link. The queue feeds the round bar. After a reveal, "Agree on 5" records the team's value and moves to the next topic.
- **Timer.** Optional countdown of 30, 60 or 120 seconds as a ring on the round bar. When it runs out with auto reveal off, nothing happens. With auto reveal on, it starts the same cancellable three-second ring as the last vote does.

Not at launch:

- asynchronous rounds
- import from and sync to Jira, Linear or GitHub
- a second language
- adapters for Teams and Miro on top of the embed mode
- an AI seat
- the owner's silent observer seat for support, which needs a line in the privacy page before it exists

The data model keeps a place for the external reference of a topic, so sync needs no migration.

## Insights

- **In the room:** rounds per session, share of rounds with consensus, typical spread, time to reveal, how often each card wins. Built from basalt-ui's chart kinds: bars, lines, a weekday-by-hour heatmap, sparklines in stat cards.
- **Public statistics page** at `/analytics`, as today but honest: totals, rounds per week, card popularity, consensus rate, when the world estimates, tables open right now. v1 shows invented fallback numbers when its database is down; v9 shows the last known figures with their date.

## Phone, install, embed

- **Phone.** The layout is the under-700 px row above. Every card is reachable with one thumb, and names in the seat grid wrap rather than truncate. The socket drops when the browser is backgrounded; coming back restores the seat without a prompt.
- **Install.** The room app is installable. Opened from the home screen it starts at `/room`. Offline it shows the shell and says so; it never queues a vote.
- **Embed.** `?embed=1` drops the site chrome so the room fits a Teams tab, a Miro panel or a wiki page. Teams, Miro, Slack and Atlassian Forge all run embedded apps in iframes.

## Accessibility

Seats are a list in DOM order with arrow-key movement; the ring is presentation. A live region announces progress ("7 of 9 voted") and the result, never anything that would hint at a vote before the reveal. A voted seat is marked by shape, not colour alone. Every action has a key, listed in the command palette (`Cmd+K`). Contrast comes from basalt-ui's derived tokens. Reduced motion is honoured by the system setting and by calm mode.

## Copy

Product copy follows the `broad` register of the voice guide:

- Labels are verb plus object: "Copy invite link", "Reveal cards", "Start new round".
- An error says what happened and what to do.
- An empty state points at the first action.
- One word per thing everywhere: room, seat, round, card, reveal, topic.

## The marketing site

Static pages with no JavaScript, except one island: the landing page's hero is a live table played by scripted participants. "Sit down" turns the demo into a real room.

| Page | Job |
|-|-|
| `/` | the demo, the five claims, how a round works, open source and self-hosting, questions |
| `/guide` and `/guides/*` | planning poker explained, then one page per practice: decks, when a spread means split the story, running a large room |
| `/vs/*` | honest comparison pages, each fact checked on the day it is written |
| `/analytics` | public statistics |
| `/roadmap` | changelog from releases, and what is next; replaces the Todoist-backed page |
| `/self-hosting` | one compose file |
| `/privacy`, `/imprint`, `/contact` | what is measured and how, in plain words; the imprint as it stands |

Every existing URL keeps its path. Each page gets its own title, description, canonical link, social image and structured data, none of which v1 has.

## What changes for a v1 user

| v1 | v9 |
|-|-|
| Room by name in the URL | unchanged |
| Fibonacci 1 to 21 only | default deck, plus three more and custom |
| "Show votes" only when everyone has voted | reveal any time after the first vote, with a confirmation when seats are still thinking |
| Auto flip exists on the server without a switch | a setting, with a cancellable countdown |
| Spectator, kick, leave, rename | unchanged, subject to the facilitator lock when it is on |
| Table or card view | Table or Grid, chosen automatically by size, switchable |
| Elapsed-time counter | kept, plus the optional countdown |
| Four sounds, on by default | five sounds, off for new users |
| Confetti on a unanimous vote | kept, joined by the streak counter |
| Room statistics in the sidebar | the Insights panel |
| Home page jumps into the last room | recent rooms list at `/room` |
| Name and settings in localStorage | read once and kept |
| Feedback form | unchanged |
