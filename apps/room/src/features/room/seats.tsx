import type { RoomClientState } from '@fpp/room-client'
import { currentRound } from '@fpp/room-core/view'
import type { Command, Seat, View } from '@fpp/room-core/types'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'

const PRESENCE = {
  active: msg`here`,
  away: msg`away`,
  reconnecting: msg`reconnecting`,
  gone: msg`left`,
} as const

/** Every seat in the order the room keeps, with its state; a vote's value only once the round is revealed. */
export function Seats(props: {
  readonly view: View
  readonly state: RoomClientState
  readonly run: (command: Command) => Promise<void>
}) {
  const { t, i18n } = useLingui()
  const { view } = props
  const round = currentRound(view)
  const vote = (seat: Seat) => round.votes.find((candidate) => candidate.seat === seat.index)

  return (
    <section aria-labelledby="seats-heading">
      <h2 id="seats-heading">{t`Seats`}</h2>
      <ul data-testid="seats">
        {view.seats.map((seat) => {
          const mine = seat.index === view.self
          const name = seat.name
          const cast = vote(seat)
          const card = mine ? (props.state.ownVote?.card ?? cast?.card?.label) : cast?.card?.label
          const hasVoted = cast !== undefined || (mine && props.state.ownVote !== null)
          const voteState =
            seat.role === 'spectator'
              ? 'spectator'
              : round.state === 'revealed'
                ? 'revealed'
                : hasVoted
                  ? 'voted'
                  : 'thinking'
          return (
            <li
              key={seat.index}
              data-testid="seat"
              data-seat={seat.index}
              data-role={seat.role}
              data-presence={seat.presence}
              data-state={voteState}
              data-self={mine}
            >
              <span data-testid="seat-name">{seat.name}</span>{' '}
              {mine ? <span>{t`(you)`}</span> : null}{' '}
              <span data-testid="seat-role">
                {seat.role === 'spectator' ? t`spectator` : t`player`}
              </span>{' '}
              <span data-testid="seat-presence">{i18n._(PRESENCE[seat.presence])}</span>{' '}
              <span data-testid="seat-vote">
                {voteState === 'spectator'
                  ? t`watching`
                  : voteState === 'revealed'
                    ? (card ?? t`no vote`)
                    : voteState === 'voted'
                      ? t`voted`
                      : t`thinking`}
              </span>
              {mine ? null : (
                <>
                  {' '}
                  <button
                    type="button"
                    data-testid="kick"
                    onClick={() =>
                      void props.run({ type: 'seat.kick', payload: { seat: seat.index } })
                    }
                  >
                    {t`Remove ${name}`}
                  </button>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
