/**
 * The room kernel's rules: who may join, change a seat, run the room and edit the topic queue. What it needs from the
 * activity comes in as `KernelActivity`, so the kernel imports no activity.
 */
import { activeTopic, fits, type Kernel, openTopics, seatOf, topicOf } from './kernel.evolve.ts'
import { LIMITS } from '../protocol/names.ts'
import type {
  Presence,
  Role,
  RoundId,
  Seat,
  ServerCommand,
  SeatCommand,
  RoomCommand,
  Topic,
  TopicCommand,
  TopicId,
} from '../protocol/types.ts'
import type { Ctx, DomainEvent, Rejection, RoomState } from '../state.ts'
import type { SeatIndex } from '../values.ts'

/** What the kernel asks of the room's activity. */
export type KernelActivity = {
  /** The round a `topic.next` must name. */
  readonly currentRound: (state: RoomState) => RoundId
  /** Whether a topic had a reveal: moving on marks it `done`, otherwise `skipped`. */
  readonly hasReveal: (state: RoomState, topic: TopicId) => boolean
}

const reject = (reason: Rejection['reject']): Rejection => ({ reject: reason })

const roomFor = (kernel: Kernel, role: Role): Rejection | undefined => {
  if (fits(kernel, role)) return undefined
  return reject(role === 'player' ? 'players_full' : 'spectators_full')
}

const untitled = (ctx: Ctx): Topic => ({
  id: ctx.newId(),
  title: null,
  url: null,
  ref: null,
  state: 'queued',
  final: null,
})

type SeatInput = {
  readonly by: SeatIndex
  readonly command: SeatCommand | TopicCommand | RoomCommand
}

/** Decides a kernel command from a seat. The caller has checked that the seat exists. */
export function decideKernel(
  state: RoomState,
  { by, command }: SeatInput,
  ctx: Ctx,
  activity: KernelActivity,
): DomainEvent[] | Rejection {
  const me = seatOf(state, by)
  if (me === undefined) return reject('not_seated')
  const player = me.role === 'player'

  switch (command.type) {
    case 'seat.rename': {
      if (command.payload.name === me.name) return []
      return [{ type: 'seat.renamed', payload: { seat: by, name: command.payload.name } }]
    }
    case 'seat.setPresence': {
      if (command.payload.presence === me.presence) return []
      return [
        { type: 'seat.presenceChanged', payload: { seat: by, presence: command.payload.presence } },
      ]
    }
    case 'seat.leave':
      return [{ type: 'seat.left', payload: { seat: by } }]
    case 'seat.setRole': {
      const { seat, role } = command.payload
      if (seat !== by && !player) return reject('forbidden')
      const target = seatOf(state, seat)
      if (target === undefined) return reject('seat_unknown')
      if (target.role === role) return []
      if (target.presence !== 'gone') {
        const full = roomFor(state, role)
        if (full) return full
      }
      return [{ type: 'seat.roleChanged', payload: { seat, role } }]
    }
    case 'seat.kick': {
      if (!player) return reject('forbidden')
      if (seatOf(state, command.payload.seat) === undefined) return reject('seat_unknown')
      return [{ type: 'seat.kicked', payload: { seat: command.payload.seat, by } }]
    }
  }

  // Everything below runs the room: players only (docs/v9/ARCHITECTURE.md, Room model).
  if (!player) return reject('forbidden')

  switch (command.type) {
    case 'room.setSettings': {
      const settings = { ...state.room.settings, ...command.payload }
      const same =
        settings.deck === state.room.settings.deck ||
        JSON.stringify(settings.deck) === JSON.stringify(state.room.settings.deck)
      if (
        same &&
        settings.autoReveal === state.room.settings.autoReveal &&
        settings.revealCountdown === state.room.settings.revealCountdown &&
        settings.timer === state.room.settings.timer
      )
        return []
      return [{ type: 'room.settingsChanged', payload: { settings } }]
    }
    case 'room.setTitle': {
      if (command.payload.name === state.room.name) return []
      return [{ type: 'room.titleChanged', payload: { name: command.payload.name } }]
    }
    case 'topic.add': {
      if (openTopics(state) + command.payload.topics.length > LIMITS.openTopics)
        return reject('queue_full')
      const topics = command.payload.topics.map((input): Topic => ({
        id: ctx.newId(),
        title: input.title,
        url: input.url,
        ref: input.ref,
        state: 'queued',
        final: null,
      }))
      return [{ type: 'topic.added', payload: { topics } }]
    }
    case 'topic.update': {
      const topic = topicOf(state, command.payload.topic)
      if (topic === undefined) return reject('topic_unknown')
      const { title, url, ref } = command.payload
      if (
        title === topic.title &&
        url === topic.url &&
        JSON.stringify(ref) === JSON.stringify(topic.ref)
      )
        return []
      return [{ type: 'topic.updated', payload: command.payload }]
    }
    case 'topic.move': {
      const from = state.topics.findIndex((topic) => topic.id === command.payload.topic)
      if (from === -1) return reject('topic_unknown')
      const index = Math.min(command.payload.index, state.topics.length - 1)
      if (index === from) return []
      return [{ type: 'topic.moved', payload: { topic: command.payload.topic, index } }]
    }
    case 'topic.remove': {
      const topic = topicOf(state, command.payload.topic)
      if (topic === undefined) return reject('topic_unknown')
      if (topic.state !== 'queued') return reject('topic_not_queued')
      return [{ type: 'topic.removed', payload: { topic: topic.id } }]
    }
    case 'topic.next':
      return next(state, command.payload, ctx, activity)
  }
}

function next(
  state: RoomState,
  payload: { readonly round: RoundId; readonly to?: TopicId },
  ctx: Ctx,
  activity: KernelActivity,
): DomainEvent[] | Rejection {
  if (payload.round !== activity.currentRound(state)) return reject('round_closed')
  const active = activeTopic(state)
  if (active === undefined) throw new Error('a room has an active topic')

  let target: Topic | undefined
  if (payload.to !== undefined) {
    target = topicOf(state, payload.to)
    if (target === undefined) return reject('topic_unknown')
    if (target.state !== 'queued') return reject('topic_not_queued')
  } else {
    target = state.topics.find((topic) => topic.state === 'queued')
  }

  const events: DomainEvent[] = [
    {
      type: 'topic.closed',
      payload: {
        topic: active.id,
        state: activity.hasReveal(state, active.id) ? 'done' : 'skipped',
      },
    },
  ]
  if (target === undefined) {
    target = untitled(ctx)
    events.push({ type: 'topic.added', payload: { topics: [target] } })
  }
  events.push({ type: 'topic.activated', payload: { topic: target.id } })
  return events
}

/** Decides a kernel command the server issues. */
export function decideKernelServer(
  state: RoomState,
  command: Extract<ServerCommand, { type: `seat.${string}` | `room.${string}` }>,
): DomainEvent[] | Rejection {
  switch (command.type) {
    case 'seat.join': {
      const full = roomFor(state, command.payload.role)
      if (full) return full
      const seat: Seat = {
        index: state.nextSeat as SeatIndex,
        name: command.payload.name,
        avatar: command.payload.avatar,
        role: command.payload.role,
        presence: 'active',
      }
      return [{ type: 'seat.joined', payload: { seat } }]
    }
    case 'seat.setConnection': {
      const seat = seatOf(state, command.payload.seat)
      if (seat === undefined) return reject('seat_unknown')
      const presence: Presence = command.payload.presence
      if (seat.presence === presence) return []
      if (seat.presence === 'gone') {
        const full = roomFor(state, seat.role)
        if (full) return full
      }
      return [{ type: 'seat.presenceChanged', payload: { seat: seat.index, presence } }]
    }
    case 'room.setAccess': {
      const { access, code } = command.payload
      if (access === state.room.access && code === state.room.code) return []
      return [
        {
          type: 'room.accessChanged',
          payload: { access, code: access === 'locked' ? code : null },
        },
      ]
    }
    case 'room.setSlug': {
      if (command.payload.slug === state.room.slug) return []
      return [{ type: 'room.slugChanged', payload: { slug: command.payload.slug } }]
    }
  }
}
