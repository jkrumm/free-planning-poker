/**
 * The activity `poker`'s rules (invariant 16): votes, the reveal, the countdown and the timer, the final value. It
 * reacts to the kernel's events (a topic activated starts a round, a seat that leaves can complete a round) and says
 * which effects a step has.
 */
import { findCard } from '../decks.ts'
import { activeTopic, seatOf, seatedIn } from '../kernel/kernel.evolve.ts'
import type {
  CountdownCause,
  PokerCommand,
  RoundId,
  ServerCommand,
  Topic,
  TopicId,
} from '../protocol/types.ts'
import { buildDecidedResult, buildRevealedResult, type ResultInput } from '../result.ts'
import type { Ctx, DomainEvent, Effect, Rejection, RoomState, Round } from '../state.ts'
import type { SeatIndex } from '../values.ts'

const reject = (reason: Rejection['reject']): Rejection => ({ reject: reason })

export const currentRound = (state: RoomState): Round => {
  const round = roundOf(state, state.activity.current)
  if (round === undefined) throw new Error('a room has a current round')
  return round
}

const roundOf = (state: RoomState, id: RoundId): Round | undefined =>
  state.activity.rounds.find((round) => round.id === id)

const topicOf = (state: RoomState, id: TopicId): Topic => {
  const topic = state.topics.find((candidate) => candidate.id === id)
  if (topic === undefined) throw new Error(`round of an unknown topic ${id}`)
  return topic
}

export const hasReveal = (state: RoomState, topic: TopicId): boolean =>
  state.activity.rounds.some((round) => round.topic === topic && round.state === 'revealed')

/** Every active player has voted, and there is at least one. Away and disconnected seats never block. */
export function allActiveVoted(state: RoomState, round: Round): boolean {
  const active = state.seats.filter((seat) => seat.role === 'player' && seat.presence === 'active')
  return (
    active.length > 0 &&
    active.every((seat) => round.votes.some((vote) => vote.seat === seat.index))
  )
}

export const isPokerCommand = (command: { readonly type: string }): command is PokerCommand =>
  command.type.startsWith('poker.')

function resultInput(state: RoomState, round: Round, ctx: Ctx): ResultInput {
  return {
    id: ctx.newId(),
    at: ctx.now,
    room: { slug: state.room.slug, name: state.room.name },
    topic: topicOf(state, round.topic),
    round,
  }
}

function reveal(state: RoomState, round: Round, by: SeatIndex | null, ctx: Ctx): DomainEvent[] {
  const input = resultInput(state, round, ctx)
  const result = buildRevealedResult(input)
  const events: DomainEvent[] = [
    {
      type: 'poker.revealed',
      payload: { round: round.id, at: ctx.now, by, votes: round.votes, result },
    },
  ]
  const only = result.round.distribution[0]
  if (result.round.consensus && only !== undefined && only.value !== null) {
    const final = { label: only.label, value: only.value, decidedBy: 'agreed' as const }
    events.push({
      type: 'topic.decided',
      payload: { result: buildDecidedResult({ ...input, id: ctx.newId(), final }) },
    })
  }
  return events
}

function roundStarted(state: RoomState, topic: TopicId, attempt: number, ctx: Ctx): DomainEvent {
  const { deck, timer } = state.room.settings
  return {
    type: 'poker.roundStarted',
    payload: {
      round: {
        id: ctx.newId(),
        topic,
        no: state.activity.no + 1,
        attempt,
        deck,
        startedAt: ctx.now,
        timerEndsAt: timer > 0 ? ctx.now + timer * 1000 : null,
      },
    },
  }
}

function startCountdown(
  state: RoomState,
  round: Round,
  cause: CountdownCause,
  ctx: Ctx,
): DomainEvent[] {
  const seconds = state.room.settings.revealCountdown
  if (seconds === 0) return reveal(state, round, null, ctx)
  return [
    {
      type: 'poker.countdownStarted',
      payload: { round: round.id, endsAt: ctx.now + seconds * 1000, cause },
    },
  ]
}

/** Decides a `poker.*` command from a seat: players only. */
export function decidePoker(
  state: RoomState,
  { by, command }: { readonly by: SeatIndex; readonly command: PokerCommand },
  ctx: Ctx,
): DomainEvent[] | Rejection {
  const me = seatOf(state, by)
  if (me === undefined) return reject('not_seated')
  if (me.role !== 'player') return reject('forbidden')
  const round = roundOf(state, command.payload.round)
  if (round === undefined) return reject('round_unknown')
  const open = round.id === state.activity.current && round.state === 'voting'

  switch (command.type) {
    case 'poker.vote': {
      if (!open) return reject('round_closed')
      const card = findCard(round.deck, command.payload.card)
      if (card === undefined) return reject('card_unknown')
      const mine = round.votes.find((vote) => vote.seat === by)
      if (mine?.card.label === card.label) return []
      return [{ type: 'poker.voted', payload: { round: round.id, seat: by, card } }]
    }
    case 'poker.clearVote': {
      if (!open) return reject('round_closed')
      if (!round.votes.some((vote) => vote.seat === by)) return []
      return [{ type: 'poker.voteCleared', payload: { round: round.id, seat: by } }]
    }
    case 'poker.reveal': {
      // A second reveal is acknowledged and changes nothing (docs/v9/ARCHITECTURE.md, Races).
      if (round.state === 'revealed') return []
      if (!open) return reject('round_closed')
      if (round.votes.length === 0) return reject('no_votes')
      return reveal(state, round, by, ctx)
    }
    case 'poker.cancelReveal': {
      if (!open) return reject('round_closed')
      if (round.countdown === null) return []
      return [{ type: 'poker.countdownCancelled', payload: { round: round.id, armed: false } }]
    }
    case 'poker.revote': {
      if (round.id !== state.activity.current) return reject('round_closed')
      if (round.state !== 'revealed') return reject('not_revealed')
      const final = topicOf(state, round.topic).final
      if (final?.decidedBy === 'settled' && final.round === round.id) return reject('topic_decided')
      return [roundStarted(state, round.topic, round.attempt + 1, ctx)]
    }
    case 'poker.settle': {
      if (round.state !== 'revealed') return reject('not_revealed')
      const later = state.activity.rounds.some(
        (other) => other.topic === round.topic && other.id !== round.id,
      )
      if (later) return reject('round_closed')
      const card = round.deck.cards.find((candidate) => candidate.label === command.payload.card)
      if (card === undefined || card.value === null) return reject('card_unknown')
      const topic = topicOf(state, round.topic)
      if (
        topic.final?.decidedBy === 'settled' &&
        topic.final.round === round.id &&
        topic.final.label === card.label
      )
        return []
      const final = { label: card.label, value: card.value, decidedBy: 'settled' as const }
      const result = buildDecidedResult({ ...resultInput(state, round, ctx), final })
      return [{ type: 'topic.decided', payload: { result } }]
    }
  }
}

/** Decides a timer that ran out. A stale one (another round, moved on, cancelled) changes nothing. */
export function decidePokerServer(
  state: RoomState,
  command: Extract<ServerCommand, { type: `poker.${string}` }>,
  ctx: Ctx,
): DomainEvent[] {
  const round = currentRound(state)
  if (round.id !== command.payload.round || round.state !== 'voting' || round.votes.length === 0)
    return []
  switch (command.type) {
    case 'poker.countdownElapsed':
      if (round.countdown === null || ctx.now < round.countdown.endsAt) return []
      return reveal(state, round, null, ctx)
    case 'poker.timerElapsed': {
      const { autoReveal } = state.room.settings
      if (round.timerEndsAt === null || ctx.now < round.timerEndsAt) return []
      if (!autoReveal || !round.armed || round.countdown !== null) return []
      return startCountdown(state, round, 'timer', ctx)
    }
  }
}

/** A countdown keeps running while auto reveal is on and armed and its cause still holds. */
function countdownHolds(state: RoomState, round: Round, cause: CountdownCause): boolean {
  if (!state.room.settings.autoReveal || !round.armed || round.votes.length === 0) return false
  return cause === 'timer' || allActiveVoted(state, round)
}

/**
 * What follows from a command's events in the activity: a newly active topic gets its first round, and auto reveal
 * starts or drops its countdown when the votes, the seats or the settings change.
 */
export function followPoker(
  state: RoomState,
  events: readonly DomainEvent[],
  ctx: Ctx,
): DomainEvent[] {
  const activated = events.find((event) => event.type === 'topic.activated')
  if (activated !== undefined) {
    const topic = activeTopic(state)
    if (topic === undefined) throw new Error('topic.activated leaves an active topic')
    return [roundStarted(state, topic.id, 1, ctx)]
  }
  if (
    events.some((event) => event.type === 'poker.revealed' || event.type === 'poker.roundStarted')
  )
    return []
  const round = currentRound(state)
  if (round.state !== 'voting') return []
  if (round.countdown !== null) {
    if (countdownHolds(state, round, round.countdown.cause)) return []
    return [{ type: 'poker.countdownCancelled', payload: { round: round.id, armed: true } }]
  }
  if (countdownHolds(state, round, 'votes')) return startCountdown(state, round, 'votes', ctx)
  return []
}

/** The effects of one event, given the state before and after it. */
export function pokerEffects(before: RoomState, event: DomainEvent, after: RoomState): Effect[] {
  switch (event.type) {
    case 'poker.roundStarted': {
      const effects: Effect[] = []
      const previous = currentRound(before)
      if (previous.state === 'voting') {
        if (previous.countdown !== null)
          effects.push({ type: 'cancel', timer: 'countdown', round: previous.id })
        if (previous.timerEndsAt !== null)
          effects.push({ type: 'cancel', timer: 'timer', round: previous.id })
      }
      const { id, timerEndsAt } = event.payload.round
      if (timerEndsAt !== null)
        effects.push({ type: 'schedule', timer: 'timer', round: id, at: timerEndsAt })
      return effects
    }
    case 'poker.countdownStarted':
      return [
        {
          type: 'schedule',
          timer: 'countdown',
          round: event.payload.round,
          at: event.payload.endsAt,
        },
      ]
    case 'poker.countdownCancelled':
      return [{ type: 'cancel', timer: 'countdown', round: event.payload.round }]
    case 'poker.revealed': {
      const effects: Effect[] = []
      const was = roundOf(before, event.payload.round)
      if (was !== undefined && was.countdown !== null)
        effects.push({ type: 'cancel', timer: 'countdown', round: event.payload.round })
      if (was !== undefined && was.timerEndsAt !== null)
        effects.push({ type: 'cancel', timer: 'timer', round: event.payload.round })
      const round = roundOf(after, event.payload.round)
      if (round === undefined || round.revealedAt === null)
        throw new Error('poker.revealed leaves a revealed round')
      effects.push({
        type: 'persistRound',
        result: event.payload.result,
        round: {
          id: round.id,
          topic: round.topic,
          no: round.no,
          attempt: round.attempt,
          startedAt: round.startedAt,
          revealedAt: round.revealedAt,
          players: seatedIn(after, 'player'),
          spectators: seatedIn(after, 'spectator'),
          autoReveal: event.payload.by === null,
          votes: event.payload.votes.map(({ seat, card }) => ({
            seat,
            label: card.label,
            value: card.value,
          })),
        },
      })
      return effects
    }
    case 'topic.decided':
      return [{ type: 'persistDecision', result: event.payload.result }]
    default:
      return []
  }
}
