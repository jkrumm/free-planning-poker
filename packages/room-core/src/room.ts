/**
 * The room as one aggregate (docs/v9/ARCHITECTURE.md, How a change happens): `decide` judges a command against the
 * state and returns its events or a rejection, `evolve` applies one event and is the only place state changes, and
 * `step` runs one command through both, returning the events to publish and the effects to run. All of it is pure:
 * time and new ids arrive in `ctx`.
 */
import { DECKS, DEFAULT_DECK_ID } from './decks.ts'
import { decideKernel, decideKernelServer, type KernelActivity } from './kernel/kernel.decide.ts'
import { evolveKernel, seatOf } from './kernel/kernel.evolve.ts'
import {
  decidePoker,
  decidePokerServer,
  followPoker,
  hasReveal,
  isPokerCommand,
  pokerEffects,
} from './poker/poker.decide.ts'
import { evolvePoker } from './poker/poker.evolve.ts'
import { publish } from './project.ts'
import { LIMITS } from './protocol/names.ts'
import type { Access, Event, NackReason, ServerCommand, Settings } from './protocol/types.ts'
import type { Ctx, DomainEvent, Effect, Input, Rejection, RoomState } from './state.ts'
import type { AccessCode, Slug } from './values.ts'

export const DEFAULT_SETTINGS: Settings = {
  deck: DECKS[DEFAULT_DECK_ID],
  autoReveal: false,
  revealCountdown: 3,
  timer: 0,
}

const activity: KernelActivity = {
  currentRound: (state) => state.activity.current,
  hasReveal,
}

/**
 * A new room: no seats, one untitled active topic and its first round. That round has no timer; the room's timer
 * runs from the next round on.
 */
export function initialState(
  room: {
    readonly slug: Slug
    readonly name: string
    readonly access?: Access
    readonly code?: AccessCode | null
    readonly settings?: Settings
  },
  ctx: Ctx,
): RoomState {
  const settings = room.settings ?? DEFAULT_SETTINGS
  if (room.access === 'locked' && (room.code ?? null) === null)
    throw new Error('a locked room needs its access code')
  const topic = ctx.newId()
  const round = ctx.newId()
  const access = room.access ?? 'open'
  return {
    room: {
      slug: room.slug,
      name: room.name,
      access,
      code: access === 'locked' ? (room.code ?? null) : null,
      settings,
    },
    seats: [],
    nextSeat: 0,
    topics: [{ id: topic, title: null, url: null, ref: null, state: 'active', final: null }],
    activity: {
      kind: 'poker',
      no: 1,
      current: round,
      rounds: [
        {
          id: round,
          topic,
          no: 1,
          attempt: 1,
          deck: settings.deck,
          state: 'voting',
          startedAt: ctx.now,
          revealedAt: null,
          timerEndsAt: null,
          countdown: null,
          armed: true,
          votes: [],
        },
      ],
    },
    applied: [],
  }
}

const isServerPoker = (
  command: ServerCommand,
): command is Extract<ServerCommand, { type: `poker.${string}` }> =>
  command.type.startsWith('poker.')

/** Judges one command: the events it causes, the activity's follow-ups included, or a rejection. */
export function decide(state: RoomState, input: Input, ctx: Ctx): DomainEvent[] | Rejection {
  let primary: DomainEvent[] | Rejection
  if (input.by === 'server') {
    const { command } = input
    primary = isServerPoker(command)
      ? decidePokerServer(state, command, ctx)
      : decideKernelServer(state, command as Exclude<ServerCommand, { type: `poker.${string}` }>)
  } else {
    if (seatOf(state, input.by) === undefined) return { reject: 'not_seated' }
    const { by, command } = input
    primary = isPokerCommand(command)
      ? decidePoker(state, { by, command }, ctx)
      : decideKernel(state, { by, command }, ctx, activity)
  }
  if (!Array.isArray(primary) || primary.length === 0) return primary
  const after = primary.reduce(evolve, state)
  return [...primary, ...followPoker(after, primary, ctx)]
}

/** Applies one event. The only place the room changes; `step` adds only the id of the command to its log. */
export function evolve(state: RoomState, event: DomainEvent): RoomState {
  const kernel = evolveKernel(state, event)
  const poker = evolvePoker(kernel.activity, event)
  const nextSeat =
    event.type === 'seat.joined'
      ? Math.max(kernel.nextSeat, event.payload.seat.index + 1)
      : kernel.nextSeat
  if (kernel === state && poker === state.activity && nextSeat === state.nextSeat) return state
  return { ...kernel, activity: poker, nextSeat }
}

export type StepResult =
  | {
      readonly ok: true
      /** The command's id was applied before: acknowledge it again, publish nothing. */
      readonly duplicate: boolean
      readonly state: RoomState
      /** What to publish, in order, each with the next `seq`. */
      readonly events: readonly Event[]
      readonly effects: readonly Effect[]
    }
  | { readonly ok: false; readonly reason: NackReason; readonly state: RoomState }

const commandKey = (input: Input): string | undefined =>
  input.by === 'server' ? undefined : `${input.by}:${input.id}`

/**
 * Runs one command to the end. The state returned is new only when the whole command succeeded; if anything throws,
 * the caller still holds the state it passed in, untouched.
 */
export function step(state: RoomState, input: Input, ctx: Ctx): StepResult {
  const key = commandKey(input)
  if (key !== undefined && state.applied.includes(key))
    return { ok: true, duplicate: true, state, events: [], effects: [] }

  const decided = decide(state, input, ctx)
  if (!Array.isArray(decided)) return { ok: false, reason: (decided as Rejection).reject, state }

  let next = state
  const effects: Effect[] = []
  for (const event of decided) {
    const before = next
    next = evolve(before, event)
    effects.push(...pokerEffects(before, event, next))
  }
  // Every accepted command is remembered, one that changed nothing included, so its repeat cannot apply later.
  if (key !== undefined)
    next = { ...next, applied: [...next.applied, key].slice(-LIMITS.appliedLog) }
  return { ok: true, duplicate: false, state: next, events: decided.map(publish), effects }
}
