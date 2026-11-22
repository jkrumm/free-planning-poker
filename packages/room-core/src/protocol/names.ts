/**
 * The protocol's names and numbers as runtime values, with no Zod: version, frame, command, event, fx and rejection
 * names, close codes, limits. Each list is checked against its type below, so a name added to one and not the other
 * fails `tsc`.
 */
import type {
  CommandType,
  EventType,
  FrameName,
  FxType,
  NackReason,
  ServerCommandType,
} from './types.ts'

export const PROTOCOL_VERSION = 1

/** The owners a command or event type may start with (invariant 16). */
export const OWNERS = ['poker', 'topic', 'seat', 'room'] as const

export const FRAME_NAMES = [
  'hello',
  'welcome',
  'cmd',
  'ack',
  'nack',
  'evt',
  'fx',
  'ping',
  'pong',
] as const satisfies readonly FrameName[]

export const COMMAND_TYPES = [
  'poker.vote',
  'poker.clearVote',
  'poker.reveal',
  'poker.cancelReveal',
  'poker.revote',
  'poker.settle',
  'topic.add',
  'topic.update',
  'topic.move',
  'topic.remove',
  'topic.next',
  'seat.rename',
  'seat.setRole',
  'seat.setPresence',
  'seat.kick',
  'seat.leave',
  'room.setSettings',
  'room.setTitle',
] as const satisfies readonly CommandType[]

export const SERVER_COMMAND_TYPES = [
  'seat.join',
  'seat.setConnection',
  'room.setAccess',
  'room.setSlug',
  'poker.countdownElapsed',
  'poker.timerElapsed',
] as const satisfies readonly ServerCommandType[]

export const EVENT_TYPES = [
  'poker.roundStarted',
  'poker.voted',
  'poker.voteCleared',
  'poker.countdownStarted',
  'poker.countdownCancelled',
  'poker.revealed',
  'topic.added',
  'topic.updated',
  'topic.moved',
  'topic.removed',
  'topic.activated',
  'topic.closed',
  'topic.decided',
  'seat.joined',
  'seat.renamed',
  'seat.roleChanged',
  'seat.presenceChanged',
  'seat.left',
  'seat.kicked',
  'room.settingsChanged',
  'room.titleChanged',
  'room.accessChanged',
  'room.slugChanged',
] as const satisfies readonly EventType[]

export const FX_TYPES = ['seat.react'] as const satisfies readonly FxType[]

export const NACK_REASONS = [
  'invalid',
  'not_seated',
  'forbidden',
  'seat_unknown',
  'players_full',
  'spectators_full',
  'round_unknown',
  'round_closed',
  'not_revealed',
  'no_votes',
  'card_unknown',
  'topic_unknown',
  'topic_not_queued',
  'topic_decided',
  'queue_full',
  'rate_limited',
  'internal',
] as const satisfies readonly NackReason[]

/** Close codes of the room socket, in the application range (docs/v9/protocol.md, Close codes). */
export const CLOSE_CODES = {
  version_unsupported: 4001,
  draining: 4002,
  kicked: 4003,
  expired: 4004,
  access_required: 4005,
  rate_limited: 4008,
} as const

export const LIMITS = {
  players: 30,
  spectators: 20,
  /** Queued and active topics in one room. */
  openTopics: 200,
  /** Applied command ids a room remembers to answer a repeat without applying it again. */
  appliedLog: 256,
  revealCountdownMax: 10,
} as const

// Every member of each union is listed: these fail to compile when a type gains a name its list lacks.
type Missing<All, Listed> = Exclude<All, Listed>
const complete = <T extends never>(): T | undefined => undefined
complete<Missing<FrameName, (typeof FRAME_NAMES)[number]>>()
complete<Missing<CommandType, (typeof COMMAND_TYPES)[number]>>()
complete<Missing<ServerCommandType, (typeof SERVER_COMMAND_TYPES)[number]>>()
complete<Missing<EventType, (typeof EVENT_TYPES)[number]>>()
complete<Missing<FxType, (typeof FX_TYPES)[number]>>()
complete<Missing<NackReason, (typeof NACK_REASONS)[number]>>()
