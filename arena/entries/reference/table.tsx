/**
 * The reference table: a header with the topic and the round's state, the seats as a list of boxes, the hand, the
 * actions, and after the reveal the spread as a list. Everything it shows comes from the view and the messages.
 */
import type { CSSProperties } from 'react'
import { distribution } from '@fpp/room-core/view'
import {
  SPECIAL_CARDS,
  type Card,
  type RoundView,
  type Seat,
  type VoteView,
} from '@fpp/room-core/types'
import type { Outcome, SeatStatus, TableProps } from '@fpp/table/contract'
import { MOTION } from './motion.ts'
import styles from './table.module.css'

const statusOf = (seat: Seat, vote: VoteView | undefined, round: RoundView): SeatStatus => {
  if (seat.role === 'spectator') return 'spectator'
  if (seat.presence === 'away') return 'away'
  if (seat.presence === 'reconnecting') return 'reconnecting'
  if (seat.presence === 'gone') return 'gone'
  if (round.state === 'revealed') return vote === undefined ? 'waiting' : 'revealed'
  return vote === undefined ? 'waiting' : 'voted'
}

/** Consensus: one card. Near: only neighbouring cards of the deck. Split: anything wider. */
function outcomeOf(round: RoundView): { outcome: Outcome; low: string; high: string } | null {
  const order = round.deck.cards.map((card) => card.label)
  const positions = round.votes
    .map((vote) => (vote.card === null ? -1 : order.indexOf(vote.card.label)))
    .filter((position) => position >= 0)
  if (positions.length === 0) return null
  const low = Math.min(...positions)
  const high = Math.max(...positions)
  const outcome: Outcome = low === high ? 'consensus' : high - low === 1 ? 'near' : 'split'
  return { outcome, low: order[low]!, high: order[high]! }
}

export function ReferenceTable({
  view,
  now,
  messages,
  preferences,
  onIntent,
  center,
  effects,
}: TableProps) {
  const round = view.activity.rounds.find((candidate) => candidate.id === view.activity.current)
  if (round === undefined) return null
  const topic = view.topics.find((candidate) => candidate.id === round.topic)
  const me = view.seats.find((seat) => seat.index === view.self)
  const mine = round.votes.find((vote) => vote.seat === view.self)?.card ?? null
  const revealed = round.state === 'revealed'
  const players = view.seats.filter((seat) => seat.role === 'player')
  const voted = round.votes.length
  const animate = !preferences.reducedMotion
  const result = revealed ? outcomeOf(round) : null
  const counts = revealed ? distribution(round.deck, round.votes) : []
  const settleable = counts.filter((count) => count.value !== null)
  const hand: readonly Card[] = [...round.deck.cards, ...SPECIAL_CARDS]
  const seconds =
    round.countdown === null ? null : Math.max(0, Math.ceil((round.countdown.endsAt - now) / 1000))
  const decided = topic?.final?.round === round.id ? topic.final : null
  const flip = (order: number): CSSProperties => ({
    animationDuration: MOTION.flip.duration,
    animationTimingFunction: MOTION.flip.easing,
    animationDelay: `calc(${order} * ${MOTION.stagger(players.length)})`,
  })

  return (
    <section className={styles.table} aria-label={messages.table}>
      <header className={styles.head}>
        <h2 className={styles.topic}>{topic?.title ?? messages.untitledTopic}</h2>
        <p className={styles.state} aria-live="polite">
          <span>{messages.round(round.no)}</span>
          <span>
            {revealed && result !== null
              ? messages.outcome(result)
              : seconds !== null
                ? messages.countdown(seconds)
                : messages.progress({ voted, players: players.length })}
          </span>
          {decided === null ? null : <span>{messages.decided(decided.label)}</span>}
        </p>
      </header>

      {center === undefined ? null : <div className={styles.center}>{center}</div>}

      <ul className={styles.seats}>
        {view.seats.map((seat) => {
          const vote = round.votes.find((candidate) => candidate.seat === seat.index)
          const status = statusOf(seat, vote, round)
          const order = round.votes.findIndex((candidate) => candidate.seat === seat.index)
          const thrown = preferences.calm
            ? []
            : effects.filter((effect) => effect.to === seat.index)
          return (
            <li
              key={seat.index}
              className={styles.seat}
              data-seat={seat.index}
              data-status={status}
              aria-label={messages.seat({
                name: seat.name,
                self: seat.index === view.self,
                status,
              })}
            >
              <span className={styles.name} aria-hidden="true">
                {seat.name}
              </span>
              <span className={styles.status} aria-hidden="true">
                {messages.status(status)}
              </span>
              {vote === undefined ? null : vote.card === null ? (
                <span className={styles.back} role="img" aria-label={messages.cardBack} />
              ) : (
                <span
                  className={revealed && animate ? `${styles.card} ${styles.flip}` : styles.card}
                  style={revealed && animate ? flip(order) : undefined}
                  data-card={vote.card.label}
                  data-card-of={seat.index}
                  role="img"
                  aria-label={messages.card(vote.card)}
                >
                  {vote.card.label}
                </span>
              )}
              {thrown.map((effect) => (
                <span key={effect.id} className={styles.effect} aria-hidden="true">
                  {effect.emoji}
                </span>
              ))}
            </li>
          )
        })}
      </ul>

      {revealed ? (
        <ul className={styles.spread}>
          {counts.map((count) => (
            <li key={count.label}>{messages.tally(count)}</li>
          ))}
        </ul>
      ) : null}

      <div className={styles.actions}>
        {!revealed && seconds !== null ? (
          <button type="button" onClick={() => onIntent({ type: 'cancel' })}>
            {messages.cancel}
          </button>
        ) : null}
        {!revealed && voted > 0 ? (
          <button type="button" onClick={() => onIntent({ type: 'reveal' })}>
            {messages.reveal}
          </button>
        ) : null}
        {!revealed && mine !== null ? (
          <button type="button" onClick={() => onIntent({ type: 'clear' })}>
            {messages.clear}
          </button>
        ) : null}
        {revealed && decided === null ? (
          <button type="button" onClick={() => onIntent({ type: 'revote' })}>
            {messages.revote}
          </button>
        ) : null}
        {revealed
          ? settleable.map((count) => {
              const card = round.deck.cards.find((candidate) => candidate.label === count.label)
              return card === undefined ? null : (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => onIntent({ type: 'settle', card })}
                >
                  {messages.settle(card)}
                </button>
              )
            })
          : null}
        {revealed ? (
          <button type="button" onClick={() => onIntent({ type: 'next' })}>
            {messages.next}
          </button>
        ) : null}
      </div>

      {!revealed && me?.role === 'player' ? (
        <div className={styles.hand} role="group" aria-label={messages.hand}>
          {hand.map((card) => {
            const selected = mine?.label === card.label
            return (
              <button
                key={card.label}
                type="button"
                className={styles.choice}
                aria-pressed={selected}
                aria-label={messages.voteFor({ card, selected })}
                onClick={() => onIntent({ type: 'vote', card })}
              >
                {card.label}
              </button>
            )
          })}
        </div>
      ) : null}

      {preferences.calm ? null : (
        <div className={styles.reactions}>
          {messages.reactions.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={messages.react({ emoji, name: null })}
              onClick={() => onIntent({ type: 'react', emoji, to: null })}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
