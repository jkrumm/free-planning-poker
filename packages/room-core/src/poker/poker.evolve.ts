/**
 * The activity `poker`'s state changes: rounds, votes, countdown, reveal. The server's state (every card known) and a
 * client's view (another seat's card hidden until the reveal) change by the same code.
 */
import type { Card } from '../decks.ts'
import type { Event, RoundId, RoundView } from '../protocol/types.ts'
import type { DomainEvent, PokerState, Round } from '../state.ts'
import type { SeatIndex } from '../values.ts'

type RoundOf<C> = Omit<RoundView, 'votes'> & {
  readonly votes: readonly { readonly seat: SeatIndex; readonly card: C }[]
}
type Rounds<C> = { readonly current: RoundId; readonly rounds: readonly RoundOf<C>[] }

/**
 * Applies an event to the rounds; the server's (cards known) and a view's (other seats' cards hidden) differ only in
 * `voted`, which says what card a `poker.voted` leaves for its seat.
 */
export function evolveRounds<C extends Card | null>(
  part: Rounds<C>,
  event: Event | DomainEvent,
  voted: (previous: C | undefined, event: Event | DomainEvent) => C,
): Rounds<C> {
  const change = (id: RoundId, apply: (round: RoundOf<C>) => RoundOf<C>): Rounds<C> => ({
    current: part.current,
    rounds: part.rounds.map((round) => (round.id === id ? apply(round) : round)),
  })
  const dropVote = (seat: SeatIndex): Rounds<C> =>
    change(part.current, (round) =>
      round.state === 'voting'
        ? { ...round, votes: round.votes.filter((vote) => vote.seat !== seat) }
        : round,
    )

  switch (event.type) {
    case 'poker.roundStarted': {
      const started = event.payload.round
      const kept = part.rounds.filter(
        (round) => !(round.id === part.current && round.state === 'voting'),
      )
      const round: RoundOf<C> = {
        ...started,
        state: 'voting',
        revealedAt: null,
        countdown: null,
        armed: true,
        votes: [],
      }
      return { current: started.id, rounds: [...kept, round] }
    }
    case 'poker.voted': {
      const { seat } = event.payload
      return change(event.payload.round, (round) => {
        const mine = round.votes.find((vote) => vote.seat === seat)
        const card = voted(mine?.card, event)
        const votes =
          mine === undefined
            ? [...round.votes, { seat, card }]
            : round.votes.map((vote) => (vote.seat === seat ? { seat, card } : vote))
        return { ...round, votes }
      })
    }
    case 'poker.voteCleared':
      return change(event.payload.round, (round) => ({
        ...round,
        votes: round.votes.filter((vote) => vote.seat !== event.payload.seat),
      }))
    case 'poker.countdownStarted': {
      const countdown = { endsAt: event.payload.endsAt, cause: event.payload.cause }
      return change(event.payload.round, (round) => ({ ...round, countdown }))
    }
    case 'poker.countdownCancelled':
      return change(event.payload.round, (round) => ({
        ...round,
        countdown: null,
        armed: round.armed && event.payload.armed,
      }))
    case 'poker.revealed': {
      const { round: id, at, votes } = event.payload
      const revealed = part.rounds.find((round) => round.id === id)
      if (revealed === undefined) return part
      return {
        current: part.current,
        rounds: part.rounds
          .filter((round) => round.id === id || round.topic !== revealed.topic)
          .map((round) =>
            round.id === id
              ? {
                  ...round,
                  state: 'revealed',
                  revealedAt: at,
                  countdown: null,
                  // A revealed card is visible to every seat, on the server and in every view.
                  votes: votes as unknown as RoundOf<C>['votes'],
                }
              : round,
          ),
      }
    }
    case 'seat.left':
    case 'seat.kicked':
      return dropVote(event.payload.seat)
    case 'seat.roleChanged':
      return event.payload.role === 'spectator' ? dropVote(event.payload.seat) : part
    case 'room.settingsChanged': {
      const { deck } = event.payload.settings
      return change(part.current, (round) =>
        round.state === 'voting' && round.votes.length === 0 ? { ...round, deck } : round,
      )
    }
    case 'topic.removed':
      return {
        current: part.current,
        rounds: part.rounds.filter((round) => round.topic !== event.payload.topic),
      }
    default:
      return part
  }
}

/** The server's copy: a `poker.voted` carries its card. */
export function evolvePoker(poker: PokerState, event: DomainEvent): PokerState {
  const next = evolveRounds<Card>(poker, event, (_previous, applied) => {
    if (applied.type === 'poker.voted' && 'card' in applied.payload) return applied.payload.card
    throw new Error('the server applies poker.voted with its card')
  })
  if (next === poker) return poker
  const no = event.type === 'poker.roundStarted' ? event.payload.round.no : poker.no
  return { kind: 'poker', no, current: next.current, rounds: next.rounds as readonly Round[] }
}
