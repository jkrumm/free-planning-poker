/**
 * The ports of the room runtime (docs/v9/ARCHITECTURE.md, Server: the port table). Each is a plain interface with one
 * production adapter in `apps/api` and one in-memory adapter in `@fpp/room-core/sim`. Store and history return
 * promises and the runtime never waits on them inside a step; everything timed goes through `Clock`.
 */
import type {
  Access,
  DecidedResult,
  NackReason,
  RevealedResult,
  ServerFrame,
  Settings,
} from '../protocol/types.ts'
import type { RoundRecord } from '../state.ts'
import type { AccessCode, SeatIndex, Slug } from '../values.ts'
import type { RoomSnapshot } from './snapshot.ts'

/** The transport's id of one socket. */
export type ConnectionId = string

/** The API's id of a room (its numeric id as text): the number and the name of a room lead to one key. */
export type RoomKey = string

export type Transport = {
  /** One frame to one socket. */
  readonly send: (conn: ConnectionId, frame: ServerFrame) => void
  /** Adds a socket to the room's topic, after its `welcome`. */
  readonly subscribe: (conn: ConnectionId, room: RoomKey) => void
  readonly unsubscribe: (conn: ConnectionId, room: RoomKey) => void
  /** One frame to every socket subscribed to the room. */
  readonly publish: (room: RoomKey, frame: ServerFrame) => void
  /** Closes a socket with a code. The adapter may still report it through `closed`; the runtime ignores that. */
  readonly close: (conn: ConnectionId, code: number) => void
}

/** An opaque handle of a scheduled call. */
export type TimerHandle = unknown

export type Clock = {
  /** Milliseconds since the epoch. */
  readonly now: () => number
  /** Runs `run` once at `at` (at once if it has passed). */
  readonly schedule: (at: number, run: () => void) => TimerHandle
  readonly cancel: (handle: TimerHandle) => void
}

export type IdSource = {
  /** A UUID v7 at the clock's time. */
  readonly newId: () => string
  /** `n` random bytes, from a cryptographic source in production. */
  readonly bytes: (n: number) => Uint8Array
}

export type Secrets = {
  /** SHA-256 of a seat token as lower-case hex. A token has 256 random bits, so nothing here needs a slow hash. */
  readonly hash: (token: string) => string
}

/** What a room's row holds when no live snapshot is left: a cold start begins from it. */
export type ColdRoom = {
  readonly slug: Slug
  readonly name: string
  readonly access: Access
  readonly code: AccessCode | null
  readonly settings: Settings
  readonly accessEpoch: number
}

export type RoomClaim =
  | { readonly kind: 'missing' }
  | {
      readonly kind: 'found'
      readonly room: ColdRoom
      /**
       * The live snapshot this runtime once exported, or null when there is none or it expired. One that
       * `importSnapshot` cannot read (another version wrote it) starts the room cold from `room`.
       */
      readonly snapshot: unknown
    }

export type Ownership = 'owned' | 'lost'

export type RoomStore = {
  /** Takes ownership of a room (invariant 12) and returns what to start it from. */
  readonly claim: (room: RoomKey) => Promise<RoomClaim>
  /** Writes the live snapshot where this process still owns the room. */
  readonly write: (room: RoomKey, snapshot: RoomSnapshot) => Promise<Ownership>
  /** Writes the snapshot a last time and gives the room up. */
  readonly release: (room: RoomKey, snapshot: RoomSnapshot) => Promise<Ownership>
}

export type History = {
  /** A revealed round with its votes, by seat index. */
  readonly round: (
    room: RoomKey,
    entry: { readonly result: RevealedResult; readonly round: RoundRecord },
  ) => Promise<void> | void
  readonly decision: (room: RoomKey, result: DecidedResult) => Promise<void> | void
  /**
   * A device estimated on a UTC day (`YYYY-MM-DD`): a seat's first vote of the day. The adapter stores a keyed hash
   * of the device id; the id goes nowhere else (invariant 5).
   */
  readonly estimatingDay: (entry: {
    readonly day: string
    readonly device: string
  }) => Promise<void> | void
}

/** Where a failure was caught: the frame or the timer the runtime was handling. */
export type RuntimeAction = 'hello' | 'cmd' | 'fx' | 'timer' | 'store' | 'history'

/** The command a span covers: its type from the protocol's closed set, the room's numeric id, the seat's index. */
export type CommandInfo = {
  readonly type: string
  readonly room: RoomKey
  readonly seat: SeatIndex
  /** The frame's W3C `traceparent`, when the client sent one: the span continues that trace. */
  readonly traceparent: string | undefined
}

/** How a command ended: accepted, refused with a reason, or a bug the runtime caught. */
export type CommandOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: NackReason | 'internal' }

/** What happened to a room that an operator may want to count. */
export type RuntimeEvent = 'room_loaded' | 'room_released' | 'room_lost' | 'round_revealed'

/**
 * The runtime's telemetry. The adapter maps these onto the names of `@fpp/telemetry`; nothing passed here carries a
 * name, a code, a vote value or a device id (invariant 11): only enums, counts, durations, a room's numeric id and a
 * seat's index.
 */
export type RuntimeTelemetry = {
  /** A bug, caught once at the boundary: the room is unchanged and a command's sender got `nack internal`. */
  readonly failure: (error: unknown, at: { readonly action: RuntimeAction }) => void
  /** A socket the runtime closed, by its close code. */
  readonly closed: (code: number) => void
  /** Runs one accepted-or-refused command inside its span; the adapter times it and records its outcome. */
  readonly command: (info: CommandInfo, run: () => CommandOutcome) => void
  /** Runs the publish of one event to a room, timed. */
  readonly fanout: (run: () => void) => void
  /** A frame refused before it became a command: it did not parse, or its sender was over the rate limit. */
  readonly rejected: (reason: NackReason) => void
  /** A socket came back with its seat token. */
  readonly resumed: () => void
  readonly event: (event: RuntimeEvent) => void
  /** A room left this process, with the seats it had. */
  readonly roomEnded: (seats: number) => void
  /** Draining took this many milliseconds on the runtime's clock. */
  readonly handoff: (ms: number) => void
}

export type RuntimePorts = {
  readonly transport: Transport
  readonly clock: Clock
  readonly ids: IdSource
  readonly secrets: Secrets
  readonly store: RoomStore
  readonly history: History
  readonly telemetry: RuntimeTelemetry
}
