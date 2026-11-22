# The table brief

You are building one entry in the table arena of Free Planning Poker, an open-source planning poker app: a team opens a room, everyone picks a card in secret, the cards are revealed together. Your entry is the table: the surface where the seats sit, the cards are played and the reveal happens. Several entries are built against this same brief, each in its own direction, and the owner picks the pieces he keeps. This file is everything you need; you do not have to read anything else in the repository.

**Before you write code, state your direction in one line** (for example "a felt table under a lamp", "paper and ink", "arcade cabinet") and put it in your manifest. Commit to it. An entry that hedges between directions loses to one that commits.

## The goal

A round should feel like a real game of cards, not like a form: cards that are dealt, placed and turned, a reveal that is an event, a look that is professional enough for a work meeting. It has to hold for 2 people and for 30, on a wall screen and on a 360 px phone, in light and dark, and for a person who has turned motion off.

## What is fixed

**The contract.** Your entry is one React component and one manifest, exported from `arena/entries/<name>/index.tsx` as `entry`. The component gets what one person sees of the room and reports what that person wants to do. It knows no socket, no store and no server, so the same component later runs in the room, in the arena and on the landing page.

**The scenarios.** The arena plays the same scripted sessions to every entry, frame by frame:

| Dimension | Values |
|-|-|
| Seats | 2, 5, 9, 16, 30 |
| Phase | voting, countdown, unanimous reveal, split reveal, second vote, settled |
| People | someone away, someone reconnecting, spectators (more of them in larger rooms) |
| Container | 360 × 640 (phone), 1280 × 800 (laptop), 1920 × 1080 (wall screen) |
| Preferences | light and dark, reduced motion on and off |

**The floor.** The scorecard checks each rule; an entry that fails one is not judged further.

| Rule | How the scorecard checks it |
|-|-|
| Seats and cards are real elements in reading order with accessible names | one element with `data-seat="<index>"` per seat, in the DOM order of `view.seats`, each with a non-empty accessible name; after a reveal, every played card is an element with `data-card="<label>"` and `data-card-of="<seat index>"` and an accessible name |
| Everything can be done from the keyboard | it tabs through your table and presses Enter (then Space) on every stop; every intent type must be reported at least once (vote, clear, reveal in voting; cancel in the countdown; settle, revote, next after a reveal; react anywhere) |
| With reduced motion the reveal shows its end state at once | a screenshot two frames after the reveal equals one taken 1.6 s later |
| At 30 seats the reveal keeps a median frame of at most 20 ms | Chrome's CPU slowed four times, every frame of the 2 s after the reveal measured, on the laptop and the phone container |
| At most 60 kB gzip of your own code | your directory built with every package left out |
| No colour literal outside the tokens | your source is scanned for hex colours, colour functions (`rgb(`, `oklch(`, …) and named colours; `color-mix()` of two tokens is fine |
| Imports only the contract and stays inside its directory | no relative import leaves your directory; no import of the room client, the server code or the simulator |

Beside the floor, the scorecard fails when the entry throws in any scenario, container or theme, when two runs of one scenario differ (read no clock but `now` and no chance), and when two copies of the entry side by side in the gallery's compare mode do not show the same frame.

## What is free

Everything else. The shape of the table, the cards, how a card travels, what the reveal does with the cards, light, depth, sound, a canvas layer under the elements. A starting point you may replace: seats in a ring around a table with the viewer at the bottom centre on wide containers, a grid of seats on a phone or at 25 people and more; the hand docked at the bottom. The reveal: cards flip in seat order (staggered so 30 seats finish as fast as 6), sort into columns by value so the cards themselves form a histogram, then a summary line (consensus, near consensus, or split from the lowest to the highest value); on consensus the cards gather into one stack. Whatever you do, the result must lead with the spread, the reveal must end within 1.6 seconds, and nothing may animate in a loop.

## The contract

The types live in `@fpp/table/contract`. Read `packages/table/src/contract.ts`: every field has a comment. In short:

| Prop | What it is |
|-|-|
| `view` | What this person sees (`View` from `@fpp/room-core/types`): `self` (their seat index), `room` (name, settings, deck), `seats` (index, name, role `player` or `spectator`, presence `active`, `away`, `reconnecting` or `gone`), `topics` (the active one has `state: 'active'`, a decided one a `final`), `activity.rounds` and `activity.current` (the current round's `state` is `voting` or `revealed`, `votes` lists who voted; another seat's `card` is `null` until the reveal, your own is set; `countdown` is set while an automatic reveal counts down) |
| `now` | The room's clock in ms. Count the countdown against it, never against `Date.now()` |
| `size` | Your box in CSS pixels. The host renders you into exactly this box with `overflow: hidden` and `container-type: size`, so container queries work; scroll inside yourself if you must |
| `preferences` | `calm` (no reactions, no confetti, no sound), `reducedMotion` (no movement at all), `sound` (you may play sounds), `theme` |
| `messages` | Every word you show or announce, already in the person's language: labels, accessible names, counts, the outcome line. You write no visible string yourself |
| `onIntent` | Report what the person does: `vote` (with a card), `clear`, `reveal`, `cancel` (the countdown), `settle` (with a card that has a number), `revote`, `next`, `react` (an emoji at a seat or at the table). Intents name no round: the host fills it in |
| `center` | Optional content the room puts at the table's centre, such as an invitation while someone sits alone. Draw it when given |
| `effects` | Reactions and pokes in flight: `{ id, kind, from, to, emoji, at }`. Draw them or ignore them, but survive any number, including one aimed at a seat that has left |

Two helpers you may import: `distribution(deck, votes)` from `@fpp/room-core/view` (votes per card in deck order) and `SPECIAL_CARDS` from `@fpp/room-core/types` (`?` and `☕`, offered after the deck's cards). Your imports are limited to React, `motion`, `@fpp/table/contract`, `@fpp/room-core/types`, `@fpp/room-core/view` and files in your directory.

A minimal entry:

```tsx
// arena/entries/my-entry/index.tsx
import type { Entry, TableProps } from '@fpp/table/contract'
import styles from './table.module.css'

function Table({ view, messages, onIntent }: TableProps) {
  const round = view.activity.rounds.find((candidate) => candidate.id === view.activity.current)!
  return (
    <section className={styles.table} aria-label={messages.table}>
      <ul>
        {view.seats.map((seat) => {
          const vote = round.votes.find((candidate) => candidate.seat === seat.index)
          const status = vote === undefined ? 'waiting' : round.state === 'revealed' ? 'revealed' : 'voted'
          return (
            <li key={seat.index} data-seat={seat.index} aria-label={messages.seat({ name: seat.name, self: seat.index === view.self, status })}>
              {seat.name}
              {vote?.card ? (
                <span data-card={vote.card.label} data-card-of={seat.index} role="img" aria-label={messages.card(vote.card)}>
                  {vote.card.label}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
      {round.deck.cards.map((card) => (
        <button key={card.label} type="button" aria-label={messages.voteFor({ card, selected: false })} onClick={() => onIntent({ type: 'vote', card })}>
          {card.label}
        </button>
      ))}
    </section>
  )
}

export const entry: Entry = {
  manifest: { name: 'my-entry', direction: 'One line that names your direction', author: 'As the prompt names you', dependencies: [] },
  Table,
}
```

The reference entry, `arena/entries/reference`, is the same idea complete: every intent, every status, the countdown, the outcome. Copy it to start: `cp -r arena/entries/reference arena/entries/<name>`, then change `manifest.name` to `<name>`. `author` is the name the prompt gives you, or `unnamed`. It is plain on purpose and is never a candidate.

## How to build it

- **Styles.** Use CSS modules (`*.module.css`), so your class names cannot collide with another entry shown beside yours. Use logical properties (`margin-inline-start`, `inset-inline`), never left and right: the room will be translated into right-to-left languages.
- **Colours and type** come from the tokens below, as CSS variables, never as values.
- **Motion.** Animate `transform` and `opacity`. Keep every duration and easing of your entry in one file (`motion.ts`), built on the motion tokens. basalt-ui's motion guideline (basalt-ui Issue 2529) and its seam for a bespoke surface (Issue 2530) are not in the installed release yet; until they are, the tokens and that one file are the rule. The motion tokens are `0ms` under reduced motion, but also read `preferences.reducedMotion` and render the end state directly: the scorecard fails a reveal that still moves. The `motion` library (14.14.0) is installed for you; CSS alone is equally welcome. The React Compiler is not on in the arena.
- **Sound** plays only when `preferences.sound` is on and `calm` is off. Assets count towards your 60 kB.
- **Text** only from `messages`. Card labels, seat names and topic titles come from the view and are shown as they are.
- **Large rooms.** 30 seats is a real case: names of 20 characters, a Chinese name, three spectators, two people away. Test it first, not last.

### Tokens

The arena defines these for light and dark on your box.

| Kind | Tokens |
|-|-|
| Surfaces | `--basalt-canvas`, `--basalt-inset`, `--basalt-card`, `--basalt-raised` |
| Text | `--basalt-ink`, `--basalt-ink-muted`, `--basalt-ink-faint` |
| Lines and states | `--basalt-hairline`, `--basalt-input`, `--basalt-hover`, `--basalt-selected`, `--basalt-scrim` |
| Accent | `--basalt-brand` (as text), `--basalt-brand-fill` (as fill), `--basalt-on-brand` (text on that fill) |
| Status | `--basalt-good`, `--basalt-warn`, `--basalt-bad`, `--basalt-info` |
| The game | `--fpp-felt`, `--fpp-card-face`, `--fpp-card-back`, `--fpp-glow` |
| Depth and shape | `--basalt-shadow-raised`, `--basalt-shadow-overlay`, `--basalt-radius-card`, `--basalt-radius-ctrl`, `--basalt-radius-chip`, `--basalt-hit` (44 px touch target) |
| Type | `--basalt-font-sans`, `--basalt-font-head`, `--basalt-font-mono`, `--basalt-text-xs` to `--basalt-text-display`, `--basalt-weight-body`, `-medium`, `-strong` |
| Motion | `--basalt-dur-fast` (150 ms), `--basalt-dur-base` (250 ms), `--basalt-dur-slow` (400 ms), `--basalt-ease`, `--basalt-ease-enter`, `--basalt-ease-exit`, `--basalt-spring`, `--basalt-spring-bouncy`, `--basalt-stagger` |

A shade you need and do not see is a `color-mix()` of two tokens, e.g. `color-mix(in srgb, var(--fpp-felt) 80%, var(--basalt-ink))`. These are the names of the owner's design system, basalt-ui 3; when it is installed, the real values replace the arena's, and your entry keeps working.

## Running it

Do this from the repository root, after `bun install`:

| Command | What it does |
|-|-|
| `make arena` | builds the gallery with every entry and renders every entry through every frame of every scenario (fails on a crash), about 5 s |
| `bun run --filter @fpp/arena preview` | serves the built gallery for a person to look at: choose the entry, the scenario and the container, play, pause, step and scrub, compare two entries side by side; the address bar holds the whole selection |
| `make arena-score ENTRY=<name>` | the scorecard, about 2 minutes: writes `arena/scores/<name>/index.html` with every end-state screenshot, recordings of the split reveal at 9 and 30 seats, frame times, axe's accessibility findings, your bytes and the floor; exits non-zero when a rule of the floor or one of the checks beside it fails; `arena/scores/<name>/score.json` says which, with the scenario and the element |
| `make check-fast` | format, lint, types and the unit tests of the repository; must pass before you open the pull request |
| `make fmt` | formats every file when the format check fails |

If you cannot watch a browser, read the screenshots under `arena/scores/<name>/shots/` (one per scenario, container and theme): they are what the owner sees first. Never start a dev server that keeps running.

## Submitting

- One directory, `arena/entries/<name>` (lowercase letters, digits and dashes), and one pull request into `master`. Nothing outside the directory changes. The one exception is a package you need that is not installed: add it with an exact version to `arena/package.json`, commit the `bun.lock` change, and list it in `manifest.dependencies` as `name@version`.
- The pull request says your direction in its first line, then the floor table from your scorecard and the frame times, and attaches three screenshots: `laptop-light/30-split-reveal.png`, `phone-dark/9-voting.png` and `wall-light/5-unanimous-reveal.png`.
- CI scores every entry a pull request changes and keeps the scorecards as the artifact `arena-scores`.
- Commit messages follow `<type>: <subject>`, at most 80 characters, with no scope: for example `feat: a felt table under a lamp`.

## How entries are judged

1. The floor, by machine: an entry that fails it is out.
2. The scorecard's numbers, read side by side: frame times, bytes, accessibility findings.
3. The owner, in the gallery and on his phone. Does it feel like a round of cards? Does it read at 30 seats? Does it hold on a phone? Does the reveal land?

The pick may take the table from one entry and the reveal from another, so a strong piece in an entry that is weak elsewhere still counts. Make one thing excellent rather than everything adequate.
