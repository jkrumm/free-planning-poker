/**
 * The invariants of a whole room, asserted after every step in the tests and the simulator. `decide` refuses what
 * would break one; this catches what slipped past it. Returns every violation found, empty when the room is sound.
 */
import { findCard } from './decks.ts'
import { activeTopic, openTopics, seatedIn } from './kernel/kernel.evolve.ts'
import { LIMITS } from './protocol/names.ts'
import type { RoomState } from './state.ts'

const TIMERS = new Set([0, 30, 60, 120])

export function check(state: RoomState): string[] {
  const problems: string[] = []
  const fail = (problem: string) => problems.push(problem)

  // Seats and limits.
  const indices = state.seats.map((seat) => seat.index)
  if (new Set(indices).size !== indices.length) fail('two seats share an index')
  if (indices.some((index) => index >= state.nextSeat)) fail('a seat index is not below nextSeat')
  if (seatedIn(state, 'player') > LIMITS.players) fail('more than 30 players')
  if (seatedIn(state, 'spectator') > LIMITS.spectators) fail('more than 20 spectators')

  // Room.
  const { settings } = state.room
  if (
    !Number.isInteger(settings.revealCountdown) ||
    settings.revealCountdown < 0 ||
    settings.revealCountdown > LIMITS.revealCountdownMax
  )
    fail('reveal countdown out of range')
  if (!TIMERS.has(settings.timer)) fail('timer not one of 0, 30, 60, 120')
  if ((state.room.access === 'locked') !== (state.room.code !== null))
    fail('a locked room has a code and an open one none')
  if (state.applied.length > LIMITS.appliedLog) fail('the applied log is over its bound')

  // Topics.
  const topicIds = state.topics.map((topic) => topic.id)
  if (new Set(topicIds).size !== topicIds.length) fail('two topics share an id')
  const active = state.topics.filter((topic) => topic.state === 'active')
  if (active.length !== 1) fail(`${active.length} active topics, not one`)
  if (openTopics(state) > LIMITS.openTopics) fail('more than 200 open topics')

  // Rounds.
  const { rounds, current } = state.activity
  const topics = new Set(topicIds)
  const now = rounds.find((round) => round.id === current)
  if (now === undefined) fail('the current round is missing')
  else if (now.topic !== activeTopic(state)?.id)
    fail('the current round is not on the active topic')
  if (new Set(rounds.map((round) => round.id)).size !== rounds.length)
    fail('two rounds share an id')
  for (const round of rounds) {
    const at = `round ${round.id}`
    if (!topics.has(round.topic)) fail(`${at} belongs to no topic`)
    if (round.no > state.activity.no) fail(`${at} has a number above the room's count`)
    const seats = round.votes.map((vote) => vote.seat)
    if (new Set(seats).size !== seats.length) fail(`${at} holds two votes of one seat`)
    for (const vote of round.votes) {
      const card = findCard(round.deck, vote.card.label)
      if (card?.value !== vote.card.value) fail(`${at} holds a card its deck lacks`)
    }
    if (round.state === 'voting') {
      if (round.id !== current) fail(`${at} is voting but not current`)
      if (round.revealedAt !== null) fail(`${at} is voting with a reveal time`)
      for (const vote of round.votes) {
        const seat = state.seats.find((candidate) => candidate.index === vote.seat)
        if (seat?.role !== 'player') fail(`${at} holds a vote of a seat that is no player`)
      }
    } else {
      if (round.revealedAt === null) fail(`${at} is revealed without a reveal time`)
      if (round.countdown !== null) fail(`${at} is revealed with a countdown`)
      if (round.votes.length === 0) fail(`${at} is revealed without a vote`)
    }
  }

  // Topics against rounds.
  for (const topic of state.topics) {
    const own = rounds.filter((round) => round.topic === topic.id)
    const revealed = own.filter((round) => round.state === 'revealed')
    if (revealed.length > 1) fail(`topic ${topic.id} keeps two revealed rounds`)
    if (topic.state === 'queued' && own.length > 0) fail(`queued topic ${topic.id} has a round`)
    if (topic.state === 'skipped' && revealed.length > 0)
      fail(`skipped topic ${topic.id} had a reveal`)
    if (topic.state === 'done' && revealed.length === 0)
      fail(`done topic ${topic.id} has no revealed round`)
    if (topic.final !== null && revealed.length === 0)
      fail(`topic ${topic.id} is decided without a revealed round`)
  }

  return problems
}
