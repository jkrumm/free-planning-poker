/**
 * The table's contract (docs/v9/TABLE-BRIEF.md, The contract): what every table entry is given and what it may
 * report. An entry is one React component and one manifest. It knows no socket, no store and no room client, so the
 * same component runs in the arena, in the room and on the landing page.
 */
import type { ComponentType, ReactNode } from 'react'
import type { Card, SeatIndex, View } from '@fpp/room-core/types'

/** The box the host gives the table, in CSS pixels. The entry fills it exactly and scrolls itself if it must. */
export type TableSize = { readonly width: number; readonly height: number }

export type Theme = 'light' | 'dark'

/** The person's preferences. Each is a promise the entry keeps, not a hint. */
export type Preferences = {
  /** No reactions drawn, no confetti, no sound, no streaks. */
  readonly calm: boolean
  /** No movement: the reveal shows its end state at once. */
  readonly reducedMotion: boolean
  /** The entry may play its sounds. */
  readonly sound: boolean
  readonly theme: Theme
}

/**
 * What a table can cause. The host turns an intent into a command for the round the view shows, so an intent names
 * no round. An intent the room refuses (a vote after the reveal) is dropped by the host; the entry need not guard.
 */
export type Intent =
  | { readonly type: 'vote'; readonly card: Card }
  | { readonly type: 'clear' }
  | { readonly type: 'reveal' }
  /** Stop the countdown to an automatic reveal. */
  | { readonly type: 'cancel' }
  /** Decide the revealed round on a card that has a number. */
  | { readonly type: 'settle'; readonly card: Card }
  /** Vote again on the same topic. */
  | { readonly type: 'revote' }
  | { readonly type: 'next' }
  /** Throw an emoji at a seat, or at the table (`null`). */
  | { readonly type: 'react'; readonly emoji: string; readonly to: SeatIndex | null }

export type IntentType = Intent['type']

/** Every intent type, in the order the brief lists them. */
export const INTENT_TYPES: readonly IntentType[] = [
  'vote',
  'clear',
  'reveal',
  'cancel',
  'settle',
  'revote',
  'next',
  'react',
]

/**
 * A short-lived effect aimed at a seat: a reaction or a poke. Never part of the view and never stored. The host keeps
 * one in `effects` for a while after it arrives (`at`) and then drops it; an entry may draw it or ignore it, and must
 * tolerate any number of them, one aimed at a seat that has left included.
 */
export type TableEffect = {
  /** Unique within the stream: a key for the element that draws it. */
  readonly id: string
  readonly kind: 'reaction' | 'poke'
  readonly from: SeatIndex
  /** `null`: at the table, not at a seat. */
  readonly to: SeatIndex | null
  readonly emoji: string
  /** When it arrived, on the clock of `now`. */
  readonly at: number
}

/** How a seat reads, for its accessible name and any text the entry shows beside it. */
export type SeatStatus =
  | 'voted'
  | 'waiting'
  | 'away'
  | 'reconnecting'
  | 'gone'
  | 'spectator'
  | 'revealed'

/** How a revealed round came out (docs/v9/UX.md, The reveal). */
export type Outcome = 'consensus' | 'near' | 'split'

/**
 * Every word a table may show or announce, from the host's message catalogue (rule strings.md): an entry writes no
 * visible string and no accessible name of its own. Counts and numbers arrive already formatted for the person's
 * language; `locale` is there for what the entry formats itself with `Intl`.
 */
export type TableMessages = {
  readonly locale: string
  /** The label of the table as a whole, e.g. "Planning poker table". */
  readonly table: string
  /** A seat's accessible name: "Anna, voted", "Ben (you), waiting". */
  readonly seat: (input: {
    readonly name: string
    readonly self: boolean
    readonly status: SeatStatus
  }) => string
  /** A seat's status on its own, for a visible badge. */
  readonly status: (status: SeatStatus) => string
  /** A card's spoken name: "5", "Abstain", "Break". */
  readonly card: (card: Card) => string
  /** A face-down card on a seat. */
  readonly cardBack: string
  /** The person's hand of cards. */
  readonly hand: string
  /** A card in the hand: "Vote 5", with `selected` when it is the person's vote. */
  readonly voteFor: (input: { readonly card: Card; readonly selected: boolean }) => string
  readonly clear: string
  readonly reveal: string
  readonly cancel: string
  readonly revote: string
  readonly next: string
  /** "Settle on 5". */
  readonly settle: (card: Card) => string
  /** "Throw 👍 at Anna", or at the table when `name` is `null`. */
  readonly react: (input: { readonly emoji: string; readonly name: string | null }) => string
  /** The reactions a person may throw. */
  readonly reactions: readonly string[]
  /** "7 of 9 voted". */
  readonly progress: (input: { readonly voted: number; readonly players: number }) => string
  /** "Revealing in 3". */
  readonly countdown: (seconds: number) => string
  /** "Consensus on 5", "Near consensus", "Split: 2 to 13". */
  readonly outcome: (input: {
    readonly outcome: Outcome
    readonly low: string
    readonly high: string
  }) => string
  readonly median: (value: string) => string
  readonly mostCommon: (value: string) => string
  readonly average: (value: string) => string
  /** "Decided: 5". */
  readonly decided: (label: string) => string
  readonly untitledTopic: string
  /** "Round 3". */
  readonly round: (no: number) => string
  readonly spectators: (count: number) => string
  /** One column of the spread: "3 × 5" (three people played 5). */
  readonly tally: (input: { readonly label: string; readonly count: number }) => string
}

export type TableProps = {
  /** What this seat sees, from `@fpp/room-core`: seats, topics, the rounds; another seat's card only after the reveal. */
  readonly view: View
  /** The room's clock in milliseconds since the epoch: count a countdown against this, never against `Date.now()`. */
  readonly now: number
  readonly size: TableSize
  readonly preferences: Preferences
  readonly messages: TableMessages
  /** The one way out: every action the person takes on the table. */
  readonly onIntent: (intent: Intent) => void
  /** Content the room puts at the table's centre, such as the invitation while a person sits alone. Draw it if given. */
  readonly center?: ReactNode
  /** Reactions and pokes in flight, oldest first. */
  readonly effects: readonly TableEffect[]
}

/** What an entry says about itself. */
export type Manifest = {
  /** The entry's directory name under `arena/entries`: lowercase letters, digits and dashes. */
  readonly name: string
  /** The direction in one line: "a felt table under a lamp". */
  readonly direction: string
  readonly author: string
  /** Every package the entry imports beyond React, `@fpp/table` and `@fpp/room-core`, as `name@version`. */
  readonly dependencies: readonly string[]
}

/** What `arena/entries/<name>/index.tsx` exports as `entry`. */
export type Entry = {
  readonly manifest: Manifest
  readonly Table: ComponentType<TableProps>
}
