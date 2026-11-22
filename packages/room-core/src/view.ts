/**
 * The client's side of the room: `evolveView` applies a published event to a seat's view, and gives the same view as
 * `project` on the server's new state. The one thing an event cannot tell a client is its own hidden card; the client
 * keeps it from its own command with `withOwnVote`.
 */
import type { Card } from './decks.ts'
import { evolveKernel } from './kernel/kernel.evolve.ts'
import { evolveRounds } from './poker/poker.evolve.ts'
import type { Event, RoundId, RoundView, Seat, Topic, View } from './protocol/types.ts'

export function evolveView(view: View, event: Event): View {
  const kernel = evolveKernel(view, event)
  const rounds = evolveRounds<Card | null>(view.activity, event, (previous, applied) =>
    applied.type === 'poker.voted' && applied.payload.seat === view.self
      ? (previous ?? null)
      : null,
  )
  if (kernel === view && rounds === view.activity) return view
  return { ...kernel, activity: { kind: 'poker', current: rounds.current, rounds: rounds.rounds } }
}

/** Sets this seat's own card in a round, as its `poker.vote` sent it: before or after the event arrives. */
export function withOwnVote(view: View, round: RoundId, card: Card): View {
  return {
    ...view,
    activity: {
      ...view.activity,
      rounds: view.activity.rounds.map((candidate) => {
        if (candidate.id !== round || candidate.state !== 'voting') return candidate
        const mine = candidate.votes.some((vote) => vote.seat === view.self)
        const votes = mine
          ? candidate.votes.map((vote) => (vote.seat === view.self ? { ...vote, card } : vote))
          : [...candidate.votes, { seat: view.self, card }]
        return { ...candidate, votes }
      }),
    },
  }
}

// Selectors.

export const currentRound = (view: View): RoundView => {
  const round = view.activity.rounds.find((candidate) => candidate.id === view.activity.current)
  if (round === undefined) throw new Error('a view has a current round')
  return round
}

export const ownSeat = (view: View): Seat | undefined =>
  view.seats.find((seat) => seat.index === view.self)

export const activeTopicOf = (view: View): Topic | undefined =>
  view.topics.find((topic) => topic.state === 'active')

/** The latest round of a topic: what `poker.settle` and `poker.revote` name. */
export const latestRound = (view: View, topic: Topic['id']): RoundView | undefined =>
  view.activity.rounds.findLast((round) => round.topic === topic)
