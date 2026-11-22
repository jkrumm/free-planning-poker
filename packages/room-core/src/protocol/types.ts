/**
 * The protocol as TypeScript types, with no Zod: what a browser bundle imports (docs/v9/protocol.md is the reference;
 * docs/v9/ARCHITECTURE.md, Protocol, its summary). The schemas in schema.ts are checked against these types at compile
 * time, so the two cannot drift.
 */
import type { Card, Deck, DeckId } from '../decks.ts'
import type { AccessCode, SeatIndex, Slug, TopicRef, TrackerSource } from '../values.ts'

export type TopicId = string
export type RoundId = string

export type Role = 'player' | 'spectator'
export type Presence = 'active' | 'away' | 'reconnecting' | 'gone'
export type Access = 'open' | 'locked'
export type TopicState = 'queued' | 'active' | 'done' | 'skipped'
export type RoundState = 'voting' | 'revealed'
export type TimerSeconds = 0 | 30 | 60 | 120

export type Settings = {
  readonly deck: Deck
  readonly autoReveal: boolean
  /** Seconds between the last vote (or the timer) and an automatic reveal; 0 reveals at once. */
  readonly revealCountdown: number
  /** The round timer in seconds; 0 is off. */
  readonly timer: TimerSeconds
}

export type Seat = {
  readonly index: SeatIndex
  readonly name: string
  readonly avatar: string
  readonly role: Role
  readonly presence: Presence
}

export type DecidedBy = 'agreed' | 'settled'

/** The value a topic settled on: a card's label and its number, and the round it was decided on. */
export type Final = {
  readonly label: string
  readonly value: number
  readonly decidedBy: DecidedBy
  readonly round: RoundId
}

/** What a topic is before it has an id: a pasted line, a typed title, an import. */
export type TopicInput = {
  /** `null` for an untitled topic. */
  readonly title: string | null
  readonly url: string | null
  readonly ref: TopicRef | null
}

export type Topic = TopicInput & {
  readonly id: TopicId
  readonly state: TopicState
  readonly final: Final | null
}

export type CountdownCause = 'votes' | 'timer'
export type Countdown = { readonly endsAt: number; readonly cause: CountdownCause }

/** A round as every seat may see it; `card` is `null` for another seat's hidden vote. */
export type VoteView = { readonly seat: SeatIndex; readonly card: Card | null }

export type RoundView = {
  readonly id: RoundId
  readonly topic: TopicId
  /** Counts rounds in the room. */
  readonly no: number
  /** Counts rounds of this topic. */
  readonly attempt: number
  readonly deck: Deck
  readonly state: RoundState
  readonly startedAt: number
  readonly revealedAt: number | null
  readonly timerEndsAt: number | null
  readonly countdown: Countdown | null
  /** Auto reveal may still fire in this round; a cancelled countdown disarms it. */
  readonly armed: boolean
  readonly votes: readonly VoteView[]
}

export type PokerView = {
  readonly kind: 'poker'
  /** The round of the active topic. */
  readonly current: RoundId
  /** The latest revealed round of each topic still in the room, and the current round: what `poker.settle` names. */
  readonly rounds: readonly RoundView[]
}

export type RoomInfo = {
  readonly slug: Slug
  readonly name: string
  readonly access: Access
  /** Shown to every seat (docs/v9/ARCHITECTURE.md, Room model: the lock is not a vault). */
  readonly code: AccessCode | null
  readonly settings: Settings
}

/** What one seat sees, built by `project` on the server and kept current by `evolveView` on the client. */
export type View = {
  readonly self: SeatIndex
  readonly room: RoomInfo
  readonly seats: readonly Seat[]
  readonly topics: readonly Topic[]
  readonly activity: PokerView
}

// The result contract (docs/v9/ARCHITECTURE.md, Built for what comes next): one shape for history, exports, embed
// messages and webhooks. It never carries a display name of a participant or a seat index.

export type ResultTopic = {
  readonly id: TopicId
  readonly title: string | null
  readonly url: string | null
  readonly source: TrackerSource | null
  readonly externalId: string | null
  readonly externalKey: string | null
  readonly externalSite: string | null
}

export type ResultCount = {
  readonly label: string
  readonly value: number | null
  readonly count: number
}

export type ResultRound = {
  readonly id: RoundId
  readonly no: number
  readonly attempt: number
  readonly deck: DeckId
  readonly voters: number
  readonly consensus: boolean
  readonly distribution: readonly ResultCount[]
}

export type RevealedResult = {
  readonly type: 'poker.revealed'
  readonly v: 1
  /** UUID v7, the same on every retry. */
  readonly id: string
  /** ISO 8601. */
  readonly at: string
  readonly room: { readonly slug: Slug; readonly name: string }
  readonly topic: ResultTopic
  readonly round: ResultRound
}

export type DecidedResult = Omit<RevealedResult, 'type'> & {
  readonly type: 'topic.decided'
  readonly final: { readonly label: string; readonly value: number; readonly decidedBy: DecidedBy }
}

// Commands a seat sends in a `cmd` frame. Every type starts with its owner's name.

type Def<T extends string, P> = { readonly type: T; readonly payload: P }
type Empty = Record<string, never>

export type PokerCommand =
  | Def<'poker.vote', { readonly round: RoundId; readonly card: string }>
  | Def<'poker.clearVote', { readonly round: RoundId }>
  | Def<'poker.reveal', { readonly round: RoundId }>
  | Def<'poker.cancelReveal', { readonly round: RoundId }>
  | Def<'poker.revote', { readonly round: RoundId }>
  | Def<'poker.settle', { readonly round: RoundId; readonly card: string }>

export type TopicCommand =
  | Def<'topic.add', { readonly topics: readonly TopicInput[] }>
  | Def<
      'topic.update',
      {
        readonly topic: TopicId
        readonly title: string | null
        readonly url: string | null
        readonly ref: TopicRef | null
      }
    >
  | Def<'topic.move', { readonly topic: TopicId; readonly index: number }>
  | Def<'topic.remove', { readonly topic: TopicId }>
  | Def<'topic.next', { readonly round: RoundId; readonly to?: TopicId }>

export type SeatCommand =
  | Def<'seat.rename', { readonly name: string }>
  | Def<'seat.setRole', { readonly seat: SeatIndex; readonly role: Role }>
  | Def<'seat.setPresence', { readonly presence: 'active' | 'away' }>
  | Def<'seat.kick', { readonly seat: SeatIndex }>
  | Def<'seat.leave', Empty>

export type RoomCommand =
  | Def<
      'room.setSettings',
      {
        readonly deck?: Deck
        readonly autoReveal?: boolean
        readonly revealCountdown?: number
        readonly timer?: TimerSeconds
      }
    >
  | Def<'room.setTitle', { readonly name: string }>

export type Command = PokerCommand | TopicCommand | SeatCommand | RoomCommand
export type CommandType = Command['type']

/**
 * Commands only the server issues: a seat minted at `hello`, a connection lost or regained, the lock and the address
 * changed over HTTP, a countdown or timer that ran out. They never arrive in a `cmd` frame.
 */
export type ServerCommand =
  | Def<'seat.join', { readonly name: string; readonly avatar: string; readonly role: Role }>
  | Def<
      'seat.setConnection',
      { readonly seat: SeatIndex; readonly presence: 'active' | 'reconnecting' | 'gone' }
    >
  | Def<'room.setAccess', { readonly access: Access; readonly code: AccessCode | null }>
  | Def<'room.setSlug', { readonly slug: Slug }>
  | Def<'poker.countdownElapsed', { readonly round: RoundId }>
  | Def<'poker.timerElapsed', { readonly round: RoundId }>

export type ServerCommandType = ServerCommand['type']

// Events, the same for every seat. They mirror the commands in the past tense.

export type PokerEvent =
  | Def<
      'poker.roundStarted',
      {
        readonly round: {
          readonly id: RoundId
          readonly topic: TopicId
          readonly no: number
          readonly attempt: number
          readonly deck: Deck
          readonly startedAt: number
          readonly timerEndsAt: number | null
        }
      }
    >
  /** Names the seat, never the value (invariant 4). */
  | Def<'poker.voted', { readonly round: RoundId; readonly seat: SeatIndex }>
  | Def<'poker.voteCleared', { readonly round: RoundId; readonly seat: SeatIndex }>
  | Def<
      'poker.countdownStarted',
      { readonly round: RoundId; readonly endsAt: number; readonly cause: CountdownCause }
    >
  /** `armed: false` when a player cancelled it: auto reveal stays off for the round. */
  | Def<'poker.countdownCancelled', { readonly round: RoundId; readonly armed: boolean }>
  | Def<
      'poker.revealed',
      {
        readonly round: RoundId
        readonly at: number
        /** `null` for an automatic reveal. */
        readonly by: SeatIndex | null
        readonly votes: readonly { readonly seat: SeatIndex; readonly card: Card }[]
        readonly result: RevealedResult
      }
    >

export type TopicEvent =
  | Def<'topic.added', { readonly topics: readonly Topic[] }>
  | Def<
      'topic.updated',
      {
        readonly topic: TopicId
        readonly title: string | null
        readonly url: string | null
        readonly ref: TopicRef | null
      }
    >
  | Def<'topic.moved', { readonly topic: TopicId; readonly index: number }>
  | Def<'topic.removed', { readonly topic: TopicId }>
  | Def<'topic.activated', { readonly topic: TopicId }>
  | Def<'topic.closed', { readonly topic: TopicId; readonly state: 'done' | 'skipped' }>
  | Def<'topic.decided', { readonly result: DecidedResult }>

export type SeatEvent =
  | Def<'seat.joined', { readonly seat: Seat }>
  | Def<'seat.renamed', { readonly seat: SeatIndex; readonly name: string }>
  | Def<'seat.roleChanged', { readonly seat: SeatIndex; readonly role: Role }>
  | Def<'seat.presenceChanged', { readonly seat: SeatIndex; readonly presence: Presence }>
  | Def<'seat.left', { readonly seat: SeatIndex }>
  | Def<'seat.kicked', { readonly seat: SeatIndex; readonly by: SeatIndex }>

export type RoomEvent =
  | Def<'room.settingsChanged', { readonly settings: Settings }>
  | Def<'room.titleChanged', { readonly name: string }>
  | Def<'room.accessChanged', { readonly access: Access; readonly code: AccessCode | null }>
  | Def<'room.slugChanged', { readonly slug: Slug }>

export type Event = PokerEvent | TopicEvent | SeatEvent | RoomEvent
export type EventType = Event['type']

/** Why a command was refused, from a closed list (docs/v9/protocol.md, Rejection reasons). */
export type NackReason =
  | 'invalid'
  | 'not_seated'
  | 'forbidden'
  | 'seat_unknown'
  | 'players_full'
  | 'spectators_full'
  | 'round_unknown'
  | 'round_closed'
  | 'not_revealed'
  | 'no_votes'
  | 'card_unknown'
  | 'topic_unknown'
  | 'topic_not_queued'
  | 'topic_decided'
  | 'queue_full'
  | 'rate_limited'
  | 'internal'

// Fx: ephemeral, no seq, never stored (invariant 8).

export type Fx = Def<'seat.react', { readonly emoji: string; readonly to: SeatIndex | null }>
export type FxType = Fx['type']

// Frames. Every frame is a JSON object named by `frame`.

export type HelloFrame = {
  readonly frame: 'hello'
  readonly v: number
  readonly build: string
  readonly name: string
  readonly avatar: string
  readonly seatToken?: string
  readonly lastSeq?: number
  readonly code?: string
  readonly device?: string
  readonly embed?: string
}

export type WelcomeFrame = {
  readonly frame: 'welcome'
  readonly v: number
  readonly build: string
  readonly seat: SeatIndex
  readonly seatToken: string
  readonly seq: number
  readonly view: View
}

export type CmdFrame = {
  readonly frame: 'cmd'
  /** The client message id: a repeat is answered again and applied once. */
  readonly id: string
  readonly traceparent?: string
} & Command

export type AckFrame = { readonly frame: 'ack'; readonly id: string }
export type NackFrame = { readonly frame: 'nack'; readonly id: string; readonly reason: NackReason }
export type EvtFrame = { readonly frame: 'evt'; readonly seq: number } & Event

/** From a client, `seat` is absent; from the server, it names the sender. */
export type FxFrame = { readonly frame: 'fx'; readonly seat?: SeatIndex } & Fx
export type PingFrame = { readonly frame: 'ping' }
export type PongFrame = { readonly frame: 'pong' }

export type ClientFrame = HelloFrame | CmdFrame | FxFrame | PingFrame | PongFrame
export type ServerFrame =
  | WelcomeFrame
  | AckFrame
  | NackFrame
  | EvtFrame
  | FxFrame
  | PingFrame
  | PongFrame
export type FrameName = (ClientFrame | ServerFrame)['frame']
