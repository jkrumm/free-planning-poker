/**
 * Properties of the room over generated sessions (docs/plan.yaml, v9-room-core, change 4). One generator plays whole
 * sessions of 1 to 30 players and 0 to 20 spectators; after every step the session asserts (a) and (e) to (k), and
 * the probes in a session assert (b), (c) and (d). fast-check prints the seed and path of a failing run, and
 * `fc.assert(..., { seed, path })` replays it.
 */
import { describe, expect, test } from 'bun:test'
import * as fc from 'fast-check'
import { DECKS, findCard, SPECIAL_CARDS } from '../src/decks.ts'
import { seatedIn } from '../src/kernel/kernel.evolve.ts'
import { check } from '../src/check.ts'
import { project } from '../src/project.ts'
import { LIMITS } from '../src/protocol/names.ts'
import type { Command, Event, ServerCommand, View } from '../src/protocol/types.ts'
import { DEFAULT_SETTINGS, step, type StepResult } from '../src/room.ts'
import type { Effect, Input, RoomState } from '../src/state.ts'
import { evolveView, withOwnVote } from '../src/view.ts'
import type { SeatIndex } from '../src/values.ts'
import { newRoom, type Room } from './support.ts'

const RUNS = 1000

// One operation of a session. Numbers pick among what the room holds at that moment, so every op means something.
type Op =
  | { k: 'vote'; seat: number; card: number }
  | { k: 'clear'; seat: number }
  | { k: 'reveal'; seat: number }
  | { k: 'cancel'; seat: number }
  | { k: 'revote'; seat: number }
  | { k: 'settle'; seat: number; round: number; card: number }
  | { k: 'next'; seat: number; to: number }
  | { k: 'add'; seat: number; n: number }
  | { k: 'remove'; seat: number; topic: number }
  | { k: 'move'; seat: number; topic: number; index: number }
  | { k: 'update'; seat: number; topic: number }
  | { k: 'join'; role: 'player' | 'spectator' }
  | { k: 'leave'; seat: number }
  | { k: 'kick'; seat: number; target: number }
  | { k: 'role'; seat: number; target: number; role: 'player' | 'spectator' }
  | { k: 'presence'; seat: number; presence: 'active' | 'away' }
  | { k: 'connection'; seat: number; presence: 'active' | 'reconnecting' | 'gone' }
  | { k: 'settings'; seat: number; autoReveal: boolean; countdown: number; timer: 0 | 30 | 60 }
  | { k: 'tick'; ms: number }
  // Every active player votes, from one or two cards: rounds complete, countdowns start, consensus happens.
  | { k: 'voteAll'; card: number; spread: boolean }
  // Probes: each must change nothing.
  | { k: 'revealAgain'; seat: number }
  | { k: 'foreignVote'; seat: number; card: number; round: number }
  | { k: 'repeat'; back: number }

const pick = fc.nat(1000)
const opArb: fc.Arbitrary<Op> = fc.oneof(
  { weight: 12, arbitrary: fc.record({ k: fc.constant('vote' as const), seat: pick, card: pick }) },
  { weight: 2, arbitrary: fc.record({ k: fc.constant('clear' as const), seat: pick }) },
  { weight: 4, arbitrary: fc.record({ k: fc.constant('reveal' as const), seat: pick }) },
  { weight: 1, arbitrary: fc.record({ k: fc.constant('cancel' as const), seat: pick }) },
  { weight: 2, arbitrary: fc.record({ k: fc.constant('revote' as const), seat: pick }) },
  {
    weight: 3,
    arbitrary: fc.record({
      k: fc.constant('settle' as const),
      seat: pick,
      round: pick,
      card: pick,
    }),
  },
  { weight: 3, arbitrary: fc.record({ k: fc.constant('next' as const), seat: pick, to: pick }) },
  {
    weight: 2,
    arbitrary: fc.record({
      k: fc.constant('add' as const),
      seat: pick,
      n: fc.integer({ min: 1, max: 4 }),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ k: fc.constant('remove' as const), seat: pick, topic: pick }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ k: fc.constant('move' as const), seat: pick, topic: pick, index: pick }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ k: fc.constant('update' as const), seat: pick, topic: pick }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      k: fc.constant('join' as const),
      role: fc.constantFrom('player' as const, 'spectator' as const),
    }),
  },
  { weight: 1, arbitrary: fc.record({ k: fc.constant('leave' as const), seat: pick }) },
  {
    weight: 1,
    arbitrary: fc.record({ k: fc.constant('kick' as const), seat: pick, target: pick }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      k: fc.constant('role' as const),
      seat: pick,
      target: pick,
      role: fc.constantFrom('player' as const, 'spectator' as const),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      k: fc.constant('presence' as const),
      seat: pick,
      presence: fc.constantFrom('active' as const, 'away' as const),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      k: fc.constant('connection' as const),
      seat: pick,
      presence: fc.constantFrom('active' as const, 'reconnecting' as const, 'gone' as const),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      k: fc.constant('settings' as const),
      seat: pick,
      autoReveal: fc.boolean(),
      countdown: fc.integer({ min: 0, max: 3 }),
      timer: fc.constantFrom(0 as const, 30 as const, 60 as const),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      k: fc.constant('tick' as const),
      ms: fc.integer({ min: 0, max: 70_000 }),
    }),
  },
  {
    weight: 4,
    arbitrary: fc.record({ k: fc.constant('voteAll' as const), card: pick, spread: fc.boolean() }),
  },
  { weight: 2, arbitrary: fc.record({ k: fc.constant('revealAgain' as const), seat: pick }) },
  {
    weight: 2,
    arbitrary: fc.record({
      k: fc.constant('foreignVote' as const),
      seat: pick,
      card: pick,
      round: pick,
    }),
  },
  { weight: 2, arbitrary: fc.record({ k: fc.constant('repeat' as const), back: pick }) },
)

const sessionArb = fc.record({
  seed: fc.nat(),
  autoReveal: fc.boolean(),
  // The whole range, weighted towards small tables, where every seat's vote matters to the reveal.
  players: fc.oneof(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: LIMITS.players })),
  spectators: fc.oneof(
    fc.integer({ min: 0, max: 2 }),
    fc.integer({ min: 0, max: LIMITS.spectators }),
  ),
  ops: fc.array(opArb, { minLength: 1, maxLength: 60 }),
})

type Session = {
  seed: number
  autoReveal: boolean
  players: number
  spectators: number
  ops: Op[]
}

const at = <T>(list: readonly T[], i: number): T | undefined =>
  list.length === 0 ? undefined : list[i % list.length]

/** Freezes what is not frozen yet: a step that mutates an earlier state throws in strict mode. */
function freeze(value: unknown): void {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return
  Object.freeze(value)
  for (const inner of Object.values(value)) freeze(inner)
}

type Sent = { input: Extract<Input, { by: SeatIndex }>; accepted: boolean }

/** The same room, the log of command ids aside: what "changes nothing" means for an accepted command. */
function sameRoom(a: RoomState, b: RoomState): boolean {
  return (Object.keys(a) as (keyof RoomState)[]).every(
    (key) => key === 'applied' || a[key] === b[key],
  )
}

/** Plays a session and calls `observe` after every step with what it did. */
class Player {
  readonly room: Room
  readonly names = new Set<string>()
  readonly sent: Sent[] = []
  private serial = 0

  constructor(readonly session: Session) {
    this.room = newRoom(session.seed, (state) => ({
      ...state,
      room: {
        ...state.room,
        settings: { ...DEFAULT_SETTINGS, deck: DECKS.fibonacci, autoReveal: session.autoReveal },
      },
    }))
  }

  get state() {
    return this.room.state
  }

  /** Mostly a player, so most commands are judged on their merits; one pick in ten is any seat. */
  seat(i: number): SeatIndex | undefined {
    const players = this.state.seats.filter((s) => s.role === 'player')
    const from = i % 10 === 0 || players.length === 0 ? this.state.seats : players
    return at(from, Math.floor(i / 10))?.index
  }

  joinInput(role: 'player' | 'spectator'): Input {
    this.serial += 1
    const name = `seat-name-${this.serial}`
    this.names.add(name)
    return { by: 'server', command: { type: 'seat.join', payload: { name, avatar: 'a', role } } }
  }

  seatInput(by: SeatIndex | undefined, command: Command): Input | undefined {
    if (by === undefined) return undefined
    this.serial += 1
    return { by, id: `m${this.serial}`, command }
  }

  serverInput(command: ServerCommand): Input {
    return { by: 'server', command }
  }

  /** The inputs one op stands for (a tick may fire two timers). */
  inputs(op: Op): { input: Input; probe?: 'unchanged' | 'duplicate' }[] {
    const state = this.state
    const round = state.activity.rounds.find((r) => r.id === state.activity.current)!
    const deckCards = [...round.deck.cards, ...SPECIAL_CARDS]
    switch (op.k) {
      case 'vote':
        return one(
          this.seatInput(this.seat(op.seat), {
            type: 'poker.vote',
            payload: { round: round.id, card: at(deckCards, op.card)!.label },
          }),
        )
      case 'clear':
        return one(
          this.seatInput(this.seat(op.seat), {
            type: 'poker.clearVote',
            payload: { round: round.id },
          }),
        )
      case 'reveal':
        return one(
          this.seatInput(this.seat(op.seat), {
            type: 'poker.reveal',
            payload: { round: round.id },
          }),
        )
      case 'cancel':
        return one(
          this.seatInput(this.seat(op.seat), {
            type: 'poker.cancelReveal',
            payload: { round: round.id },
          }),
        )
      case 'revote':
        return one(
          this.seatInput(this.seat(op.seat), {
            type: 'poker.revote',
            payload: { round: round.id },
          }),
        )
      case 'settle': {
        const target = at(state.activity.rounds, op.round)!
        const card = at(target.deck.cards, op.card)!
        return one(
          this.seatInput(this.seat(op.seat), {
            type: 'poker.settle',
            payload: { round: target.id, card: card.label },
          }),
        )
      }
      case 'next': {
        const queued = state.topics.filter((t) => t.state === 'queued')
        const to = op.to % 3 === 0 ? at(queued, op.to)?.id : undefined
        return one(
          this.seatInput(this.seat(op.seat), {
            type: 'topic.next',
            payload: to === undefined ? { round: round.id } : { round: round.id, to },
          }),
        )
      }
      case 'add': {
        const topics = Array.from({ length: op.n }, (_, i) => ({
          title: `topic-title-${this.serial}-${i}`,
          url: i % 2 === 0 ? 'https://example.com/a' : null,
          ref: null,
        }))
        return one(this.seatInput(this.seat(op.seat), { type: 'topic.add', payload: { topics } }))
      }
      case 'remove': {
        const topic = at(state.topics, op.topic)!
        return one(
          this.seatInput(this.seat(op.seat), {
            type: 'topic.remove',
            payload: { topic: topic.id },
          }),
        )
      }
      case 'move': {
        const topic = at(state.topics, op.topic)!
        return one(
          this.seatInput(this.seat(op.seat), {
            type: 'topic.move',
            payload: { topic: topic.id, index: op.index % (state.topics.length + 1) },
          }),
        )
      }
      case 'update': {
        const topic = at(state.topics, op.topic)!
        return one(
          this.seatInput(this.seat(op.seat), {
            type: 'topic.update',
            payload: { topic: topic.id, title: `renamed-${this.serial}`, url: null, ref: null },
          }),
        )
      }
      case 'join':
        return one(this.joinInput(op.role))
      case 'leave':
        return one(this.seatInput(this.seat(op.seat), { type: 'seat.leave', payload: {} }))
      case 'kick': {
        const target = this.seat(op.target)
        if (target === undefined) return []
        return one(
          this.seatInput(this.seat(op.seat), { type: 'seat.kick', payload: { seat: target } }),
        )
      }
      case 'role': {
        const target = this.seat(op.target)
        if (target === undefined) return []
        return one(
          this.seatInput(this.seat(op.seat), {
            type: 'seat.setRole',
            payload: { seat: target, role: op.role },
          }),
        )
      }
      case 'presence':
        return one(
          this.seatInput(this.seat(op.seat), {
            type: 'seat.setPresence',
            payload: { presence: op.presence },
          }),
        )
      case 'connection': {
        const seat = this.seat(op.seat)
        if (seat === undefined) return []
        return one(
          this.serverInput({
            type: 'seat.setConnection',
            payload: { seat, presence: op.presence },
          }),
        )
      }
      case 'settings':
        return one(
          this.seatInput(this.seat(op.seat), {
            type: 'room.setSettings',
            payload: { autoReveal: op.autoReveal, revealCountdown: op.countdown, timer: op.timer },
          }),
        )
      case 'voteAll': {
        const active = state.seats.filter((s) => s.role === 'player' && s.presence === 'active')
        return active.flatMap((s, i) =>
          one(
            this.seatInput(s.index, {
              type: 'poker.vote',
              payload: {
                round: round.id,
                card: at(round.deck.cards, op.card + (op.spread && i % 2 === 1 ? 1 : 0))!.label,
              },
            }),
          ),
        )
      }
      case 'tick': {
        this.room.clock.advance(op.ms)
        return [
          {
            input: this.serverInput({
              type: 'poker.countdownElapsed',
              payload: { round: round.id },
            }),
          },
          { input: this.serverInput({ type: 'poker.timerElapsed', payload: { round: round.id } }) },
        ]
      }
      case 'revealAgain': {
        const revealed = state.activity.rounds.filter((r) => r.state === 'revealed')
        const target = at(revealed, op.seat)
        if (target === undefined) return []
        const input = this.seatInput(this.seat(op.seat), {
          type: 'poker.reveal',
          payload: { round: target.id },
        })
        return input === undefined ? [] : [{ input, probe: 'unchanged' }]
      }
      case 'foreignVote': {
        const others = state.activity.rounds.filter((r) => r.id !== round.id).map((r) => r.id)
        // A round of this room that is not the current one, or one the room never had.
        const target = at(others, op.round) ?? this.room.clock.newId()
        const input = this.seatInput(this.seat(op.seat), {
          type: 'poker.vote',
          payload: { round: target, card: at(deckCards, op.card)!.label },
        })
        return input === undefined ? [] : [{ input, probe: 'unchanged' }]
      }
      case 'repeat': {
        // Any accepted command, one that changed nothing included.
        const applied = this.sent.filter((s) => s.accepted)
        const earlier = at(applied, op.back)
        if (earlier === undefined) return []
        return [{ input: earlier.input, probe: 'duplicate' }]
      }
    }
  }
}

const one = (input: Input | undefined) => (input === undefined ? [] : [{ input }])

const fail = (what: string): never => {
  throw new Error(what)
}

const HIDDEN_KEYS = new Set(['seat', 'seats', 'index', 'self', 'by', 'votes'])

/** (i): a result names no seat and carries no participant's name. */
function assertAnonymous(result: unknown, names: ReadonlySet<string>): void {
  const walk = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      if (names.has(value)) throw new Error(`a result carries the display name ${value} at ${path}`)
      return
    }
    if (typeof value !== 'object' || value === null) return
    for (const [key, inner] of Object.entries(value)) {
      if (HIDDEN_KEYS.has(key)) throw new Error(`a result carries ${path}.${key}`)
      walk(inner, `${path}.${key}`)
    }
  }
  walk(result, 'result')
}

/** (a): no seat's view holds another seat's card of a round that is still voting. */
function assertSecret(state: RoomState): void {
  // With no card in a voting round there is nothing to leak; skip the projections (most join steps).
  if (!state.activity.rounds.some((round) => round.state === 'voting' && round.votes.length > 0))
    return
  for (const seat of state.seats) {
    const view = project(state, seat.index)
    for (const round of view.activity.rounds) {
      if (round.state !== 'voting') continue
      for (const vote of round.votes) {
        if (vote.seat !== seat.index && vote.card !== null)
          throw new Error(
            `seat ${seat.index} sees seat ${vote.seat}'s card in voting round ${round.id}`,
          )
      }
    }
  }
}

function assertPublishedSecret(events: readonly Event[]): void {
  for (const event of events) {
    if (event.type === 'poker.voted' && Object.keys(event.payload).length !== 2)
      throw new Error(`poker.voted carries more than its round and seat: ${JSON.stringify(event)}`)
  }
}

function assertStructure(state: RoomState): void {
  // (e) limits.
  if (seatedIn(state, 'player') > LIMITS.players) fail('(e) more than 30 players')
  if (seatedIn(state, 'spectator') > LIMITS.spectators) fail('(e) more than 20 spectators')
  // (g) at most one active topic, every round's topic exists.
  if (state.topics.filter((t) => t.state === 'active').length > 1) fail('(g) two active topics')
  const topics = new Set(state.topics.map((t) => t.id))
  for (const round of state.activity.rounds)
    if (!topics.has(round.topic)) fail(`(g) round ${round.id} has no topic`)
  // (h) a decision exists only for a topic with a revealed round.
  for (const topic of state.topics) {
    if (topic.final === null) continue
    if (!state.activity.rounds.some((r) => r.topic === topic.id && r.state === 'revealed'))
      fail(`(h) topic ${topic.id} is decided without a revealed round`)
  }
  // (j) the whole state's invariants.
  const problems = check(state)
  if (problems.length > 0) fail(`(j) ${problems.join('; ')}`)
}

function assertResults(
  events: readonly Event[],
  effects: readonly Effect[],
  names: ReadonlySet<string>,
) {
  for (const event of events) {
    if (event.type === 'poker.revealed' || event.type === 'topic.decided')
      assertAnonymous(event.payload.result, names)
  }
  for (const effect of effects) {
    if (effect.type === 'persistRound' || effect.type === 'persistDecision')
      assertAnonymous(effect.result, names)
  }
}

/** (f): a client that folds the published events over its welcome view holds what `project` gives it. */
class Viewers {
  private readonly views = new Map<SeatIndex, View>()

  follow(state: RoomState, input: Input, result: StepResult) {
    if (!result.ok) return
    for (const [seat, view] of this.views) {
      let next = result.events.reduce(evolveView, view)
      const command = input.by === seat ? input.command : undefined
      if (command?.type === 'poker.vote' && result.events.length > 0) {
        const { payload } = command
        const round = state.activity.rounds.find((r) => r.id === payload.round)
        const card = round && findCard(round.deck, payload.card)
        if (round && card) next = withOwnVote(next, round.id, card)
      }
      this.views.set(seat, next)
    }
    for (const seat of this.views.keys()) {
      if (!result.state.seats.some((s) => s.index === seat)) this.views.delete(seat)
    }
    // Keep up to three seats followed: the first, the last and a spectator if there is one.
    const wanted = [
      result.state.seats[0],
      result.state.seats.at(-1),
      result.state.seats.find((s) => s.role === 'spectator'),
    ]
    for (const seat of wanted) {
      if (seat !== undefined && !this.views.has(seat.index))
        this.views.set(seat.index, project(result.state, seat.index))
    }
    for (const [seat, view] of this.views) {
      const projected = project(result.state, seat)
      // The serialised forms agree in nearly every step; the deep comparison runs, and reports, when they do not.
      if (JSON.stringify(view) !== JSON.stringify(projected)) expect(view).toEqual(projected)
    }
  }
}

function play(session: Session): void {
  const player = new Player(session)
  const viewers = new Viewers()
  const run = (input: Input, probe?: 'unchanged' | 'duplicate') => {
    const before = player.state
    freeze(before)
    // (k): evolve never throws on what decide produced; step runs both, so a throw fails here.
    const result = step(before, input, player.room.clock.ctx())
    if (probe === 'unchanged') {
      // (b) a second reveal and (c) a vote naming another round change nothing.
      expect(sameRoom(result.state, before)).toBe(true)
      if (result.ok) expect(result.events).toEqual([])
    }
    if (probe === 'duplicate') {
      // (d) a command id already applied changes nothing.
      expect(result.ok && result.duplicate).toBe(true)
      expect(result.state).toBe(before)
    }
    if (input.by !== 'server' && probe === undefined)
      player.sent.push({ input, accepted: result.ok && !result.duplicate })
    player.room.state = result.state
    if (result.ok) {
      assertPublishedSecret(result.events)
      assertResults(result.events, result.effects, player.names)
    }
    assertSecret(result.state)
    assertStructure(result.state)
    viewers.follow(before, input, result)
  }

  for (let i = 0; i < session.players; i++) run(player.joinInput('player'))
  for (let i = 0; i < session.spectators; i++) run(player.joinInput('spectator'))
  for (const op of session.ops) for (const { input, probe } of player.inputs(op)) run(input, probe)
}

describe('generated sessions', () => {
  test(
    `(a) secrecy with (b)–(k) on the same sessions, ${RUNS} runs`,
    () => {
      fc.assert(fc.property(sessionArb, play), { numRuns: RUNS })
    },
    { timeout: 60_000 },
  )
})

// A model-based test: a small model of one topic's voting, checked against the room after every command.
type Model = { votes: Map<number, string>; revealed: boolean; decided: boolean; attempt: number }
type Real = { room: Room; seats: SeatIndex[] }

const CARDS = ['1', '2', '3', '5', '8', '?']

class VoteCommand implements fc.Command<Model, Real> {
  constructor(
    readonly seat: number,
    readonly card: string,
  ) {}
  check = () => true
  run(model: Model, real: Real) {
    const seat = real.seats[this.seat % real.seats.length]!
    const round = real.room.state.activity.current
    const result = stepSeat(real, seat, { type: 'poker.vote', payload: { round, card: this.card } })
    if (model.revealed) expect(result.ok ? 'ok' : result.reason).toBe('round_closed')
    else {
      expect(result.ok).toBe(true)
      model.votes.set(seat, this.card)
    }
    agree(model, real)
  }
  toString = () => `vote(${this.seat}, ${this.card})`
}

class ClearCommand implements fc.Command<Model, Real> {
  constructor(readonly seat: number) {}
  check = () => true
  run(model: Model, real: Real) {
    const seat = real.seats[this.seat % real.seats.length]!
    const round = real.room.state.activity.current
    const result = stepSeat(real, seat, { type: 'poker.clearVote', payload: { round } })
    if (model.revealed) expect(result.ok).toBe(false)
    else model.votes.delete(seat)
    agree(model, real)
  }
  toString = () => `clear(${this.seat})`
}

class RevealCommand implements fc.Command<Model, Real> {
  check = () => true
  run(model: Model, real: Real) {
    const round = real.room.state.activity.current
    const result = stepSeat(real, real.seats[0]!, { type: 'poker.reveal', payload: { round } })
    if (model.revealed) expect(result.ok && result.events.length).toBe(0)
    else if (model.votes.size === 0) expect(result.ok ? 'ok' : result.reason).toBe('no_votes')
    else {
      model.revealed = true
      const labels = new Set(model.votes.values())
      model.decided = labels.size === 1 && !labels.has('?')
    }
    agree(model, real)
  }
  toString = () => 'reveal'
}

class RevoteCommand implements fc.Command<Model, Real> {
  check = () => true
  run(model: Model, real: Real) {
    const round = real.room.state.activity.current
    const result = stepSeat(real, real.seats[0]!, { type: 'poker.revote', payload: { round } })
    if (!model.revealed) expect(result.ok ? 'ok' : result.reason).toBe('not_revealed')
    else if (model.decided) expect(result.ok ? 'ok' : result.reason).toBe('topic_decided')
    else {
      expect(result.ok).toBe(true)
      model.revealed = false
      model.votes.clear()
      model.attempt += 1
    }
    agree(model, real)
  }
  toString = () => 'revote'
}

let modelIds = 0
function stepSeat(real: Real, by: SeatIndex, command: Command): StepResult {
  modelIds += 1
  const result = step(
    real.room.state,
    { by, id: `model-${modelIds}`, command },
    real.room.clock.ctx(),
  )
  real.room.state = result.state
  return result
}

function agree(model: Model, real: Real) {
  const state = real.room.state
  const round = state.activity.rounds.find((r) => r.id === state.activity.current)!
  expect(round.state).toBe(model.revealed ? 'revealed' : 'voting')
  expect(round.attempt).toBe(model.attempt)
  const votes = new Map(round.votes.map((vote) => [vote.seat as number, vote.card.label]))
  expect(votes).toEqual(model.votes)
  expect(check(state)).toEqual([])
}

describe('model-based', () => {
  test('voting, clearing, revealing and voting again follow the model', () => {
    const commands = [
      fc
        .tuple(fc.nat(7), fc.constantFrom(...CARDS))
        .map(([seat, card]) => new VoteCommand(seat, card)),
      fc.nat(7).map((seat) => new ClearCommand(seat)),
      fc.constant(new RevealCommand()),
      fc.constant(new RevoteCommand()),
    ]
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        fc.commands(commands, { maxCommands: 60 }),
        (n, cmds) => {
          const room = newRoom(n)
          const seats: SeatIndex[] = []
          for (let i = 0; i < n; i++) {
            const result = step(
              room.state,
              {
                by: 'server',
                command: {
                  type: 'seat.join',
                  payload: { name: `p${i}`, avatar: 'a', role: 'player' },
                },
              },
              room.clock.ctx(),
            )
            room.state = result.state
            seats.push(room.state.seats.at(-1)!.index)
          }
          const setup = () => ({
            model: {
              votes: new Map<number, string>(),
              revealed: false,
              decided: false,
              attempt: 1,
            },
            real: { room, seats },
          })
          fc.modelRun(setup, cmds)
        },
      ),
      { numRuns: 300 },
    )
  })
})

export type { ServerCommand }
