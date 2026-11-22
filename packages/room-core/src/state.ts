/**
 * The room's state on the server and the shapes around the reducer: context, inputs, rejections, effects. State is
 * plain data, copied as it is into the snapshot (docs/v9/ARCHITECTURE.md, How a change happens). It holds hidden
 * votes, so it never leaves the server: a seat sees `project(state, seat)`.
 */
import type { Card } from './decks.ts'
import type {
  Command,
  DecidedResult,
  Event,
  NackReason,
  RevealedResult,
  RoomInfo,
  RoundId,
  RoundView,
  Seat,
  ServerCommand,
  Topic,
  TopicId,
} from './protocol/types.ts'
import type { SeatIndex } from './values.ts'

/** A round with every vote's card: the server's copy. */
export type Round = Omit<RoundView, 'votes'> & {
  readonly votes: readonly { readonly seat: SeatIndex; readonly card: Card }[]
}

export type PokerState = {
  readonly kind: 'poker'
  /** The highest round number so far in the room. */
  readonly no: number
  /** The round of the active topic. */
  readonly current: RoundId
  /** The latest revealed round of each topic still in the room, and the current round. */
  readonly rounds: readonly Round[]
}

export type RoomState = {
  readonly room: RoomInfo
  readonly seats: readonly Seat[]
  /** The index the next seat gets; indices are never reused while the room is live. */
  readonly nextSeat: number
  /** The queue in display order. Exactly one topic is `active`. */
  readonly topics: readonly Topic[]
  readonly activity: PokerState
  /** Keys (`<seat>:<id>`) of the latest accepted commands, newest last, kept by `step`: a repeat is acknowledged and changes nothing. */
  readonly applied: readonly string[]
}

/** What the reducer receives from outside: the time, and a source of new UUID v7 ids. */
export type Ctx = {
  /** Milliseconds since the epoch. */
  readonly now: number
  readonly newId: () => string
}

export type Input =
  | { readonly by: SeatIndex; readonly id: string; readonly command: Command }
  | { readonly by: 'server'; readonly command: ServerCommand }

export type Rejection = { readonly reject: NackReason }

/**
 * An event as the server applies it. It equals the published event except `poker.voted`, which carries the card;
 * `publish` drops it before anything leaves the server.
 */
export type DomainEvent =
  | Exclude<Event, { readonly type: 'poker.voted' }>
  | {
      readonly type: 'poker.voted'
      readonly payload: { readonly round: RoundId; readonly seat: SeatIndex; readonly card: Card }
    }

/** One vote as `round_vote` stores it: the seat's index, never its name. */
export type RoundVote = {
  readonly seat: SeatIndex
  readonly label: string
  readonly value: number | null
}

/** A revealed round as history stores it, beside its result. */
export type RoundRecord = {
  readonly id: RoundId
  readonly topic: TopicId
  readonly no: number
  readonly attempt: number
  readonly startedAt: number
  readonly revealedAt: number
  readonly players: number
  readonly spectators: number
  readonly autoReveal: boolean
  readonly votes: readonly RoundVote[]
}

export type Timer = 'countdown' | 'timer'

/** What the runtime does after a step: start or stop a timer, store a result. */
export type Effect =
  | {
      readonly type: 'schedule'
      readonly timer: Timer
      readonly round: RoundId
      readonly at: number
    }
  | { readonly type: 'cancel'; readonly timer: Timer; readonly round: RoundId }
  | { readonly type: 'persistRound'; readonly result: RevealedResult; readonly round: RoundRecord }
  | { readonly type: 'persistDecision'; readonly result: DecidedResult }
