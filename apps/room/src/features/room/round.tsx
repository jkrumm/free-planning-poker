import type { RoomClientState } from '@fpp/room-client'
import { type Command, SPECIAL_CARDS, type View } from '@fpp/room-core/types'
import { activeTopicOf, currentRound, distribution, ownSeat } from '@fpp/room-core/view'
import { plural } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { useAppEnv } from '../../app-env.tsx'

/** The seconds left until `endsAt`, ticking while there is a countdown. */
function useSecondsLeft(endsAt: number | undefined): number | undefined {
  const env = useAppEnv()
  const { timers } = env.ports
  const [now, setNow] = useState(() => timers.now())
  useEffect(() => {
    if (endsAt === undefined) return
    let handle: unknown
    const tick = () => {
      setNow(timers.now())
      handle = timers.setTimeout(tick, 250)
    }
    tick()
    return () => timers.clearTimeout(handle)
  }, [endsAt, timers])
  return endsAt === undefined ? undefined : Math.max(0, Math.ceil((endsAt - now) / 1000))
}

/** The round of the active topic: the deck while voting, the result and the final value after the reveal. */
export function Round(props: {
  readonly view: View
  readonly state: RoomClientState
  readonly run: (command: Command) => Promise<void>
}) {
  const { t } = useLingui()
  const { view, state, run } = props
  const round = currentRound(view)
  const topic = activeTopicOf(view)
  const me = ownSeat(view)
  const isPlayer = me?.role === 'player'
  const secondsLeft = useSecondsLeft(round.countdown?.endsAt)
  const players = view.seats.filter((seat) => seat.role === 'player').length
  const voted =
    round.votes.length +
    (state.ownVote !== null && !round.votes.some((vote) => vote.seat === view.self) ? 1 : 0)
  const own =
    state.ownVote?.card ?? round.votes.find((vote) => vote.seat === view.self)?.card?.label
  const counts = distribution(round.deck, round.votes)
  const topicName = topic?.title ?? t`Untitled topic`
  const roundNo = round.no
  const id = round.id
  const final = topic?.final ?? null
  const finalLabel = final?.label

  return (
    <section aria-labelledby="round-heading" data-testid="round" data-state={round.state}>
      <h2 id="round-heading">{t`Round ${roundNo}`}</h2>
      <p data-testid="round-topic">{topicName}</p>
      <p data-testid="vote-meter">
        {plural(players, {
          one: `${voted} of # player voted`,
          other: `${voted} of # players voted`,
        })}
      </p>
      {round.state === 'voting' ? (
        <>
          {isPlayer ? (
            <div role="group" aria-label={t`Your cards`} data-testid="deck">
              {[...round.deck.cards, ...SPECIAL_CARDS].map((card) => (
                <button
                  key={card.label}
                  type="button"
                  data-testid="card"
                  data-card={card.label}
                  aria-pressed={own === card.label}
                  onClick={() =>
                    void run({ type: 'poker.vote', payload: { round: id, card: card.label } })
                  }
                >
                  {card.label}
                </button>
              ))}
            </div>
          ) : (
            <p>{t`You are watching. Become a player to vote.`}</p>
          )}
          {isPlayer ? (
            <button
              type="button"
              data-testid="clear-vote"
              onClick={() => void run({ type: 'poker.clearVote', payload: { round: id } })}
            >
              {t`Clear my vote`}
            </button>
          ) : null}
          {isPlayer ? (
            <button
              type="button"
              data-testid="reveal"
              onClick={() => void run({ type: 'poker.reveal', payload: { round: id } })}
            >
              {t`Reveal cards`}
            </button>
          ) : null}
          {secondsLeft === undefined ? null : (
            <p role="timer" data-testid="countdown">
              {plural(secondsLeft, {
                one: 'Revealing in # second',
                other: 'Revealing in # seconds',
              })}{' '}
              <button
                type="button"
                data-testid="cancel-reveal"
                onClick={() => void run({ type: 'poker.cancelReveal', payload: { round: id } })}
              >
                {t`Cancel the reveal`}
              </button>
            </p>
          )}
        </>
      ) : (
        <>
          <ul data-testid="result">
            {counts.map((count) => {
              const votes = count.count
              return (
                <li key={count.label} data-testid="result-card" data-card={count.label}>
                  {count.label} {plural(votes, { one: '# vote', other: '# votes' })}
                </li>
              )
            })}
          </ul>
          {final === null ? null : (
            <p data-testid="final-value-result" data-card={final.label}>
              {t`Final value ${finalLabel}`}
            </p>
          )}
          <div role="group" aria-label={t`Set the final value`} data-testid="final-values">
            {round.deck.cards.map((card) => (
              <button
                key={card.label}
                type="button"
                data-testid="final-value"
                data-card={card.label}
                onClick={() =>
                  void run({ type: 'poker.settle', payload: { round: id, card: card.label } })
                }
              >
                {card.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            data-testid="revote"
            onClick={() => void run({ type: 'poker.revote', payload: { round: id } })}
          >
            {t`Vote again`}
          </button>
        </>
      )}
      <button
        type="button"
        data-testid="next-topic"
        onClick={() => void run({ type: 'topic.next', payload: { round: id } })}
      >
        {t`Next topic`}
      </button>
    </section>
  )
}
