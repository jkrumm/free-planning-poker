/**
 * The protocol's Zod schemas: where a frame enters the server it is parsed once with these and trusted after that.
 * Value objects go through their own parsers (values.ts, decks.ts). Every schema's output is checked against its type
 * in types.ts at the bottom of this file, so the two cannot drift.
 */
import { z } from 'zod'
import { type Card, type Deck, parseCard, parseDeck } from '../decks.ts'
import {
  type AccessCode,
  parseAccessCode,
  parseSeatIndex,
  parseSlug,
  parseTopicRef,
  type SeatIndex,
  type Slug,
  TRACKER_SOURCES,
  type TopicRef,
} from '../values.ts'
import { LIMITS, NACK_REASONS } from './names.ts'
import type * as T from './types.ts'

/** A schema whose only constructor is a value object's parser. */
const valueOf = <V>(parse: (input: unknown) => V | undefined, what: string) =>
  z.unknown().transform((input, ctx): V => {
    const parsed = parse(input)
    if (parsed === undefined) {
      ctx.issues.push({ code: 'custom', message: `invalid ${what}`, input })
      return z.NEVER
    }
    return parsed
  })

export const SlugSchema = valueOf<Slug>(parseSlug, 'slug')
export const SeatIndexSchema = valueOf<SeatIndex>(parseSeatIndex, 'seat index')
export const CardSchema = valueOf<Card>(parseCard, 'card')
export const DeckSchema = valueOf<Deck>(parseDeck, 'deck')
export const TopicRefSchema = valueOf<TopicRef>(parseTopicRef, 'topic reference')
export const AccessCodeSchema = valueOf<AccessCode>(parseAccessCode, 'access code')

const id = z.uuid()
const at = z.int().nonnegative()
const label = z.string().min(1).max(8)
const seatName = z.string().trim().min(1).max(32)
const avatar = z.string().min(1).max(64)
const roomName = z.string().trim().min(1).max(60)
const title = z.string().trim().min(1).max(300).nullable()
const url = z
  .url({ protocol: /^https?$/ })
  .max(2048)
  .nullable()
const messageId = z.string().min(1).max(64)

const RoleSchema = z.enum(['player', 'spectator'])
const PresenceSchema = z.enum(['active', 'away', 'reconnecting', 'gone'])
const AccessSchema = z.enum(['open', 'locked'])
const TimerSchema = z.union([z.literal(0), z.literal(30), z.literal(60), z.literal(120)])
const revealCountdown = z.int().min(0).max(LIMITS.revealCountdownMax)

export const SettingsSchema = z.object({
  deck: DeckSchema,
  autoReveal: z.boolean(),
  revealCountdown,
  timer: TimerSchema,
})

export const SeatSchema = z.object({
  index: SeatIndexSchema,
  name: seatName,
  avatar,
  role: RoleSchema,
  presence: PresenceSchema,
})

const DecidedBySchema = z.enum(['agreed', 'settled'])

export const TopicInputSchema = z.object({ title, url, ref: TopicRefSchema.nullable() })

export const TopicSchema = TopicInputSchema.extend({
  id,
  state: z.enum(['queued', 'active', 'done', 'skipped']),
  final: z.object({ label, value: z.number(), decidedBy: DecidedBySchema, round: id }).nullable(),
})

const CountdownSchema = z.object({ endsAt: at, cause: z.enum(['votes', 'timer']) })
const RoundStateSchema = z.enum(['voting', 'revealed'])

export const RoundViewSchema = z.object({
  id,
  topic: id,
  no: z.int().positive(),
  attempt: z.int().positive(),
  deck: DeckSchema,
  state: RoundStateSchema,
  startedAt: at,
  revealedAt: at.nullable(),
  timerEndsAt: at.nullable(),
  countdown: CountdownSchema.nullable(),
  armed: z.boolean(),
  votes: z.array(z.object({ seat: SeatIndexSchema, card: CardSchema.nullable() })),
})

export const ViewSchema = z.object({
  self: SeatIndexSchema,
  room: z.object({
    slug: SlugSchema,
    name: roomName,
    access: AccessSchema,
    code: AccessCodeSchema.nullable(),
    settings: SettingsSchema,
  }),
  seats: z.array(SeatSchema),
  topics: z.array(TopicSchema),
  activity: z.object({
    kind: z.literal('poker'),
    current: id,
    rounds: z.array(RoundViewSchema),
  }),
})

// The result contract.

const ResultTopicSchema = z.object({
  id,
  title,
  url,
  source: z.enum(TRACKER_SOURCES).nullable(),
  externalId: z.string().nullable(),
  externalKey: z.string().nullable(),
  externalSite: z.string().nullable(),
})

const ResultRoundSchema = z.object({
  id,
  no: z.int().positive(),
  attempt: z.int().positive(),
  deck: z.enum(['fibonacci', 'modified-fibonacci', 't-shirt', 'powers-of-two', 'custom']),
  voters: z.int().nonnegative(),
  consensus: z.boolean(),
  distribution: z.array(
    z.object({ label, value: z.number().nullable(), count: z.int().positive() }),
  ),
})

const resultBase = {
  v: z.literal(1),
  id,
  at: z.iso.datetime(),
  room: z.object({ slug: SlugSchema, name: roomName }),
  topic: ResultTopicSchema,
  round: ResultRoundSchema,
}

export const RevealedResultSchema = z.object({ type: z.literal('poker.revealed'), ...resultBase })
export const DecidedResultSchema = z.object({
  type: z.literal('topic.decided'),
  ...resultBase,
  final: z.object({ label, value: z.number(), decidedBy: DecidedBySchema }),
})

// Commands and events: one object per type, discriminated by `type`.

const def = <K extends string, P extends z.ZodType>(type: K, payload: P) =>
  z.object({ type: z.literal(type), payload })

const round = z.object({ round: id })

export const CommandSchema = z.discriminatedUnion('type', [
  def('poker.vote', z.object({ round: id, card: label })),
  def('poker.clearVote', round),
  def('poker.reveal', round),
  def('poker.cancelReveal', round),
  def('poker.revote', round),
  def('poker.settle', z.object({ round: id, card: label })),
  def('topic.add', z.object({ topics: z.array(TopicInputSchema).min(1).max(LIMITS.openTopics) })),
  def('topic.update', z.object({ topic: id, title, url, ref: TopicRefSchema.nullable() })),
  def('topic.move', z.object({ topic: id, index: z.int().nonnegative() })),
  def('topic.remove', z.object({ topic: id })),
  def('topic.next', z.object({ round: id, to: id.exactOptional() })),
  def('seat.rename', z.object({ name: seatName })),
  def('seat.setRole', z.object({ seat: SeatIndexSchema, role: RoleSchema })),
  def('seat.setPresence', z.object({ presence: z.enum(['active', 'away']) })),
  def('seat.kick', z.object({ seat: SeatIndexSchema })),
  def('seat.leave', z.object({})),
  def(
    'room.setSettings',
    z.object({
      deck: DeckSchema.exactOptional(),
      autoReveal: z.boolean().exactOptional(),
      revealCountdown: revealCountdown.exactOptional(),
      timer: TimerSchema.exactOptional(),
    }),
  ),
  def('room.setTitle', z.object({ name: roomName })),
])

/** Commands the server issues to itself; never parsed from a client. */
export const ServerCommandSchema = z.discriminatedUnion('type', [
  def('seat.join', z.object({ name: seatName, avatar, role: RoleSchema })),
  def(
    'seat.setConnection',
    z.object({ seat: SeatIndexSchema, presence: z.enum(['active', 'reconnecting', 'gone']) }),
  ),
  def('room.setAccess', z.object({ access: AccessSchema, code: AccessCodeSchema.nullable() })),
  def('room.setSlug', z.object({ slug: SlugSchema })),
  def('poker.countdownElapsed', round),
  def('poker.timerElapsed', round),
])

export const EventSchema = z.discriminatedUnion('type', [
  def(
    'poker.roundStarted',
    z.object({
      round: z.object({
        id,
        topic: id,
        no: z.int().positive(),
        attempt: z.int().positive(),
        deck: DeckSchema,
        startedAt: at,
        timerEndsAt: at.nullable(),
      }),
    }),
  ),
  def('poker.voted', z.object({ round: id, seat: SeatIndexSchema })),
  def('poker.voteCleared', z.object({ round: id, seat: SeatIndexSchema })),
  def(
    'poker.countdownStarted',
    z.object({ round: id, endsAt: at, cause: z.enum(['votes', 'timer']) }),
  ),
  def('poker.countdownCancelled', z.object({ round: id, armed: z.boolean() })),
  def(
    'poker.revealed',
    z.object({
      round: id,
      at,
      by: SeatIndexSchema.nullable(),
      votes: z.array(z.object({ seat: SeatIndexSchema, card: CardSchema })),
      result: RevealedResultSchema,
    }),
  ),
  def('topic.added', z.object({ topics: z.array(TopicSchema) })),
  def('topic.updated', z.object({ topic: id, title, url, ref: TopicRefSchema.nullable() })),
  def('topic.moved', z.object({ topic: id, index: z.int().nonnegative() })),
  def('topic.removed', z.object({ topic: id })),
  def('topic.activated', z.object({ topic: id })),
  def('topic.closed', z.object({ topic: id, state: z.enum(['done', 'skipped']) })),
  def('topic.decided', z.object({ result: DecidedResultSchema })),
  def('seat.joined', z.object({ seat: SeatSchema })),
  def('seat.renamed', z.object({ seat: SeatIndexSchema, name: seatName })),
  def('seat.roleChanged', z.object({ seat: SeatIndexSchema, role: RoleSchema })),
  def('seat.presenceChanged', z.object({ seat: SeatIndexSchema, presence: PresenceSchema })),
  def('seat.left', z.object({ seat: SeatIndexSchema })),
  def('seat.kicked', z.object({ seat: SeatIndexSchema, by: SeatIndexSchema })),
  def('room.settingsChanged', z.object({ settings: SettingsSchema })),
  def('room.titleChanged', z.object({ name: roomName })),
  def('room.accessChanged', z.object({ access: AccessSchema, code: AccessCodeSchema.nullable() })),
  def('room.slugChanged', z.object({ slug: SlugSchema })),
])

export const FxSchema = z.discriminatedUnion('type', [
  def('seat.react', z.object({ emoji: z.string().min(1).max(16), to: SeatIndexSchema.nullable() })),
])

// Frames.

export const HelloFrameSchema = z.object({
  frame: z.literal('hello'),
  v: z.int().positive(),
  build: z.string().min(1).max(64),
  name: seatName,
  avatar,
  seatToken: z.string().min(1).max(256).exactOptional(),
  lastSeq: z.int().nonnegative().exactOptional(),
  code: z.string().min(1).max(256).exactOptional(),
  device: z.string().min(1).max(128).exactOptional(),
  embed: z.string().min(1).max(32).exactOptional(),
})

export const WelcomeFrameSchema = z.object({
  frame: z.literal('welcome'),
  v: z.int().positive(),
  build: z.string().min(1).max(64),
  seat: SeatIndexSchema,
  seatToken: z.string().min(1).max(256),
  seq: z.int().nonnegative(),
  view: ViewSchema,
})

export const CmdFrameSchema = z.intersection(
  z.object({
    frame: z.literal('cmd'),
    id: messageId,
    traceparent: z.string().max(64).exactOptional(),
  }),
  CommandSchema,
)

export const AckFrameSchema = z.object({ frame: z.literal('ack'), id: messageId })
export const NackFrameSchema = z.object({
  frame: z.literal('nack'),
  id: messageId,
  reason: z.enum(NACK_REASONS),
})
export const EvtFrameSchema = z.intersection(
  z.object({ frame: z.literal('evt'), seq: z.int().nonnegative() }),
  EventSchema,
)
export const FxFrameSchema = z.intersection(
  z.object({ frame: z.literal('fx'), seat: SeatIndexSchema.exactOptional() }),
  FxSchema,
)
export const PingFrameSchema = z.object({ frame: z.literal('ping') })
export const PongFrameSchema = z.object({ frame: z.literal('pong') })

export const ClientFrameSchema = z.union([
  HelloFrameSchema,
  CmdFrameSchema,
  FxFrameSchema,
  PingFrameSchema,
  PongFrameSchema,
])

export const ServerFrameSchema = z.union([
  WelcomeFrameSchema,
  AckFrameSchema,
  NackFrameSchema,
  EvtFrameSchema,
  FxFrameSchema,
  PingFrameSchema,
  PongFrameSchema,
])

/** Each frame's schema by its name, for a reader that knows which frame to expect. */
export const FRAME_SCHEMAS = {
  hello: HelloFrameSchema,
  welcome: WelcomeFrameSchema,
  cmd: CmdFrameSchema,
  ack: AckFrameSchema,
  nack: NackFrameSchema,
  evt: EvtFrameSchema,
  fx: FxFrameSchema,
  ping: PingFrameSchema,
  pong: PongFrameSchema,
} as const

// Compile-time drift check: each schema's output and its type in types.ts accept the same values.
type DeepReadonly<V> = V extends (...args: never[]) => unknown
  ? V
  : V extends object
    ? { readonly [K in keyof V]: DeepReadonly<V[K]> }
    : V
type Same<A, B> = [DeepReadonly<A>] extends [DeepReadonly<B>]
  ? [DeepReadonly<B>] extends [DeepReadonly<A>]
    ? true
    : false
  : false
const same = <A, B>(proof: Same<A, B>) => proof

same<z.output<typeof SettingsSchema>, T.Settings>(true)
same<z.output<typeof SeatSchema>, T.Seat>(true)
same<z.output<typeof TopicSchema>, T.Topic>(true)
same<z.output<typeof ViewSchema>, T.View>(true)
same<z.output<typeof RevealedResultSchema>, T.RevealedResult>(true)
same<z.output<typeof DecidedResultSchema>, T.DecidedResult>(true)
same<z.output<typeof CommandSchema>, T.Command>(true)
same<z.output<typeof ServerCommandSchema>, T.ServerCommand>(true)
same<z.output<typeof EventSchema>, T.Event>(true)
same<z.output<typeof FxSchema>, T.Fx>(true)
same<z.output<typeof ClientFrameSchema>, T.ClientFrame>(true)
same<z.output<typeof ServerFrameSchema>, T.ServerFrame>(true)
