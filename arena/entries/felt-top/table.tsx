/**
 * The felt table. Seats sit on the rim of an oval (the viewer at the bottom centre) when the box is wide and holds at
 * most twelve seats; otherwise they form a grid. Each seat's card lies face down until the reveal, turns in seat order,
 * and then either sits in a histogram of the spread or, on consensus, gathers into one stack on the felt.
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
import { motionVars } from './motion.ts'
import styles from './table.module.css'

const RING_MIN_WIDTH = 720
const RING_MAX_SEATS = 12

/** Custom properties for an inline style; the stylesheet reads them. */
const vars = (values: Record<string, string | number>): CSSProperties => values as CSSProperties

const round2 = (value: number): number => Math.round(value * 100) / 100

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

/** A seat's place on the rim, in percent of the table's box: the viewer at the bottom, the others clockwise. */
function ringPlace(index: number, self: number, count: number): { x: number; y: number } {
  const step = (((index - self) % count) + count) % count
  const angle = Math.PI / 2 + (2 * Math.PI * step) / count
  return { x: round2(50 + 41 * Math.cos(angle)), y: round2(50 + 36 * Math.sin(angle)) }
}

export function FeltTable({
  view,
  now,
  size,
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
  const result = revealed ? outcomeOf(round) : null
  const counts = revealed ? distribution(round.deck, round.votes) : []
  const played = counts.filter((count) => count.count > 0)
  const peak = Math.max(1, ...played.map((count) => count.count))
  const settleable = counts.filter((count) => count.value !== null)
  const hand: readonly Card[] = [...round.deck.cards, ...SPECIAL_CARDS]
  const seconds =
    round.countdown === null ? null : Math.max(0, Math.ceil((round.countdown.endsAt - now) / 1000))
  const decided = topic?.final?.round === round.id ? topic.final : null
  const seatCount = view.seats.length
  const ring = size.width >= RING_MIN_WIDTH && seatCount <= RING_MAX_SEATS
  const self = Math.max(
    0,
    view.seats.findIndex((seat) => seat.index === view.self),
  )
  const phase = revealed ? 'revealed' : seconds === null ? 'voting' : 'countdown'
  const gathers = ring && result?.outcome === 'consensus'
  const drawn = preferences.calm ? [] : effects
  const status =
    revealed && result !== null
      ? messages.outcome(result)
      : seconds !== null
        ? messages.countdown(seconds)
        : messages.progress({ voted, players: players.length })

  return (
    <section
      className={styles.root}
      aria-label={messages.table}
      data-phase={phase}
      data-outcome={result?.outcome ?? 'none'}
      data-motion={preferences.reducedMotion ? 'off' : 'on'}
      style={vars(motionVars(seatCount))}
    >
      <header className={styles.head}>
        <h2 className={styles.topic}>{topic?.title ?? messages.untitledTopic}</h2>
        <p className={styles.state} aria-live="polite">
          <span>{messages.round(round.no)}</span>
          <span className={revealed ? styles.outcome : undefined}>{status}</span>
          {decided === null ? null : <span>{messages.decided(decided.label)}</span>}
        </p>
      </header>

      <div className={ring ? `${styles.area} ${styles.ring}` : `${styles.area} ${styles.grid}`}>
        <div className={styles.felt} aria-hidden="true" />

        <div className={styles.middle}>
          {center}
          {revealed && result !== null && result.outcome !== 'consensus' ? (
            <ul className={styles.spread}>
              {played.map((count) => (
                <li
                  key={count.label}
                  className={styles.column}
                  style={vars({ '--share': count.count / peak })}
                >
                  <span className={styles.bar} aria-hidden="true" />
                  <span className={styles.tally}>{messages.tally(count)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {drawn
            .filter((effect) => effect.to === null)
            .map((effect) => (
              <span key={effect.id} className={styles.tableEffect} aria-hidden="true">
                {effect.emoji}
              </span>
            ))}
        </div>

        <ol className={styles.seats}>
          {view.seats.map((seat, index) => {
            const vote = round.votes.find((candidate) => candidate.seat === seat.index)
            const seatStatus = statusOf(seat, vote, round)
            const up = vote !== undefined && vote.card !== null
            const place = ringPlace(index, self, seatCount)
            const thrown = drawn.filter((effect) => effect.to === seat.index)
            return (
              <li
                key={seat.index}
                className={styles.seat}
                data-seat={seat.index}
                data-status={seatStatus}
                style={ring ? vars({ '--x': place.x, '--y': place.y }) : undefined}
                aria-label={messages.seat({
                  name: seat.name,
                  self: seat.index === view.self,
                  status: seatStatus,
                })}
              >
                <span
                  className={gathers && up ? `${styles.slot} ${styles.gathered}` : styles.slot}
                  style={vars({ '--order': index })}
                >
                  {vote === undefined ? null : (
                    <span className={styles.flip} data-face={up ? 'up' : 'down'}>
                      <span
                        className={styles.back}
                        role={up ? undefined : 'img'}
                        aria-label={up ? undefined : messages.cardBack}
                        aria-hidden={up ? 'true' : undefined}
                      />
                      {vote.card === null ? null : (
                        <span
                          className={styles.front}
                          role="img"
                          aria-label={messages.card(vote.card)}
                          data-card={vote.card.label}
                          data-card-of={seat.index}
                        >
                          {vote.card.label}
                        </span>
                      )}
                    </span>
                  )}
                </span>
                <span className={styles.name} aria-hidden="true">
                  {seat.name}
                </span>
                <span className={styles.status} aria-hidden="true">
                  {messages.status(seatStatus)}
                </span>
                {thrown.map((effect) => (
                  <span key={effect.id} className={styles.effect} aria-hidden="true">
                    {effect.emoji}
                  </span>
                ))}
              </li>
            )
          })}
        </ol>
      </div>

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
                className={styles.handCard}
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
