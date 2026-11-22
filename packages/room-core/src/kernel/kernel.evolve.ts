/**
 * The room kernel's state changes: seats, roles, presence, settings, access and the topic queue (invariant 16). Its
 * evolve works on any shape that has a room, seats and topics, so the server's state and a client's view change by
 * the same code. It knows no activity.
 */
import { LIMITS } from '../protocol/names.ts'
import type { Event, Role, RoomInfo, Seat, Topic, TopicId } from '../protocol/types.ts'
import type { DomainEvent } from '../state.ts'
import type { SeatIndex } from '../values.ts'

export type Kernel = {
  readonly room: RoomInfo
  readonly seats: readonly Seat[]
  readonly topics: readonly Topic[]
}

export const seatOf = (kernel: Kernel, index: SeatIndex): Seat | undefined =>
  kernel.seats.find((seat) => seat.index === index)

/** Seats at the table in a role; a `gone` seat has left the table and counts for nothing. */
export const seatedIn = (kernel: Kernel, role: Role): number =>
  kernel.seats.filter((seat) => seat.role === role && seat.presence !== 'gone').length

/** Whether one more seat fits in a role (30 players, 20 spectators). */
export const fits = (kernel: Kernel, role: Role): boolean =>
  seatedIn(kernel, role) < (role === 'player' ? LIMITS.players : LIMITS.spectators)

export const activeTopic = (kernel: Kernel): Topic | undefined =>
  kernel.topics.find((topic) => topic.state === 'active')

export const openTopics = (kernel: Kernel): number =>
  kernel.topics.filter((topic) => topic.state === 'queued' || topic.state === 'active').length

export const topicOf = (kernel: Kernel, id: TopicId): Topic | undefined =>
  kernel.topics.find((topic) => topic.id === id)

const withSeat = (seats: readonly Seat[], index: SeatIndex, change: (seat: Seat) => Seat) =>
  seats.map((seat) => (seat.index === index ? change(seat) : seat))

const withTopic = (topics: readonly Topic[], id: TopicId, change: (topic: Topic) => Topic) =>
  topics.map((topic) => (topic.id === id ? change(topic) : topic))

/** Applies a kernel event; any other event returns the input unchanged. */
export function evolveKernel<K extends Kernel>(kernel: K, event: Event | DomainEvent): K {
  switch (event.type) {
    case 'seat.joined':
      return { ...kernel, seats: [...kernel.seats, event.payload.seat] }
    case 'seat.renamed': {
      const { name } = event.payload
      return {
        ...kernel,
        seats: withSeat(kernel.seats, event.payload.seat, (s) => ({ ...s, name })),
      }
    }
    case 'seat.roleChanged': {
      const { role } = event.payload
      return {
        ...kernel,
        seats: withSeat(kernel.seats, event.payload.seat, (s) => ({ ...s, role })),
      }
    }
    case 'seat.presenceChanged': {
      const { presence } = event.payload
      return {
        ...kernel,
        seats: withSeat(kernel.seats, event.payload.seat, (s) => ({ ...s, presence })),
      }
    }
    case 'seat.left':
    case 'seat.kicked':
      return { ...kernel, seats: kernel.seats.filter((s) => s.index !== event.payload.seat) }
    case 'room.settingsChanged':
      return { ...kernel, room: { ...kernel.room, settings: event.payload.settings } }
    case 'room.titleChanged':
      return { ...kernel, room: { ...kernel.room, name: event.payload.name } }
    case 'room.accessChanged':
      return {
        ...kernel,
        room: { ...kernel.room, access: event.payload.access, code: event.payload.code },
      }
    case 'room.slugChanged':
      return { ...kernel, room: { ...kernel.room, slug: event.payload.slug } }
    case 'topic.added':
      return { ...kernel, topics: [...kernel.topics, ...event.payload.topics] }
    case 'topic.updated': {
      const { title, url, ref } = event.payload
      return {
        ...kernel,
        topics: withTopic(kernel.topics, event.payload.topic, (t) => ({ ...t, title, url, ref })),
      }
    }
    case 'topic.moved': {
      const moving = topicOf(kernel, event.payload.topic)
      if (moving === undefined) return kernel
      const rest = kernel.topics.filter((t) => t.id !== moving.id)
      const index = Math.min(event.payload.index, rest.length)
      return { ...kernel, topics: [...rest.slice(0, index), moving, ...rest.slice(index)] }
    }
    case 'topic.removed':
      return { ...kernel, topics: kernel.topics.filter((t) => t.id !== event.payload.topic) }
    case 'topic.activated':
      return {
        ...kernel,
        topics: withTopic(kernel.topics, event.payload.topic, (t) => ({ ...t, state: 'active' })),
      }
    case 'topic.closed': {
      const { state } = event.payload
      return {
        ...kernel,
        topics: withTopic(kernel.topics, event.payload.topic, (t) => ({ ...t, state })),
      }
    }
    case 'topic.decided': {
      const { result } = event.payload
      const final = { ...result.final, round: result.round.id }
      return {
        ...kernel,
        topics: withTopic(kernel.topics, result.topic.id, (t) => ({ ...t, final })),
      }
    }
    default:
      return kernel
  }
}
