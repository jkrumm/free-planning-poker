/**
 * What leaves the server about a room: `project` builds one seat's view, `publish` turns an applied event into the one
 * every seat receives. These two are the only ways out (invariant 4): before the reveal, no seat sees another seat's
 * card, and no event carries one.
 */
import type { Event, View } from './protocol/types.ts'
import type { DomainEvent, RoomState } from './state.ts'
import type { SeatIndex } from './values.ts'

/** What one seat may see. Throws for a seat the room does not hold: projecting for nobody is a bug. */
export function project(state: RoomState, self: SeatIndex): View {
  if (!state.seats.some((seat) => seat.index === self))
    throw new Error(`no seat ${self} in this room`)
  return {
    self,
    room: state.room,
    seats: state.seats,
    topics: state.topics,
    activity: {
      kind: 'poker',
      current: state.activity.current,
      rounds: state.activity.rounds.map((round) =>
        round.state === 'revealed'
          ? round
          : {
              ...round,
              votes: round.votes.map((vote) => ({
                seat: vote.seat,
                card: vote.seat === self ? vote.card : null,
              })),
            },
      ),
    },
  }
}

/** The event as every seat receives it: `poker.voted` names the seat and never the card. */
export function publish(event: DomainEvent): Event {
  if (event.type === 'poker.voted')
    return {
      type: 'poker.voted',
      payload: { round: event.payload.round, seat: event.payload.seat },
    }
  return event
}
