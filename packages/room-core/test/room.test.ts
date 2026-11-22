/**
 * The rules of section Room model, one at a time, through `step`: seats and limits, roles, votes and reveals, the
 * races of section How a change happens, the final value, the queue, auto reveal, the timer and the effects.
 */
import { describe, expect, test } from 'bun:test'
import { DECKS, parseDeck } from '../src/decks.ts'
import { check } from '../src/check.ts'
import { project, publish } from '../src/project.ts'
import { LIMITS } from '../src/protocol/names.ts'
import { step } from '../src/room.ts'
import type { RoomState } from '../src/state.ts'
import { parseAccessCode, parseSlug, type SeatIndex } from '../src/values.ts'
import {
  current,
  expectRejected,
  join,
  newRoom,
  type Room,
  send,
  server,
  types,
} from './support.ts'

const vote = (room: Room, by: SeatIndex, card: string, round = current(room).id) =>
  send(room, by, { type: 'poker.vote', payload: { round, card } })
const reveal = (room: Room, by: SeatIndex, round = current(room).id) =>
  send(room, by, { type: 'poker.reveal', payload: { round } })
const settle = (room: Room, by: SeatIndex, card: string, round = current(room).id) =>
  send(room, by, { type: 'poker.settle', payload: { round, card } })
const revote = (room: Room, by: SeatIndex, round = current(room).id) =>
  send(room, by, { type: 'poker.revote', payload: { round } })
const next = (room: Room, by: SeatIndex, to?: string) =>
  send(room, by, {
    type: 'topic.next',
    payload: to === undefined ? { round: current(room).id } : { round: current(room).id, to },
  })
const add = (room: Room, by: SeatIndex, ...titles: string[]) =>
  send(room, by, {
    type: 'topic.add',
    payload: { topics: titles.map((title) => ({ title, url: null, ref: null })) },
  })
const settings = (room: Room, by: SeatIndex, change: Record<string, unknown>) =>
  send(room, by, { type: 'room.setSettings', payload: change as never })

function table(n = 2, spectators = 0) {
  const room = newRoom()
  const players = Array.from({ length: n }, (_, i) => join(room, `P${i}`))
  const watchers = Array.from({ length: spectators }, (_, i) => join(room, `S${i}`, 'spectator'))
  return { room, players, watchers }
}

describe('a new room', () => {
  test('has one untitled active topic and a voting first round', () => {
    const room = newRoom()
    expect(room.state.topics).toHaveLength(1)
    expect(room.state.topics[0]).toMatchObject({ title: null, state: 'active' })
    expect(current(room)).toMatchObject({ no: 1, attempt: 1, state: 'voting', votes: [] })
    expect(check(room.state)).toEqual([])
  })
})

describe('seats', () => {
  test('30 players fit, the 31st is refused; 20 spectators fit, the 21st is refused', () => {
    const room = newRoom()
    for (let i = 0; i < LIMITS.players; i++) join(room, `P${i}`)
    expectRejected(
      server(room, { type: 'seat.join', payload: { name: 'X', avatar: 'x', role: 'player' } }),
      'players_full',
    )
    for (let i = 0; i < LIMITS.spectators; i++) join(room, `S${i}`, 'spectator')
    expectRejected(
      server(room, { type: 'seat.join', payload: { name: 'Y', avatar: 'y', role: 'spectator' } }),
      'spectators_full',
    )
  })

  test('a gone seat frees its place, and cannot come back to a full table', () => {
    const room = newRoom()
    const first = join(room, 'P0')
    for (let i = 1; i < LIMITS.players; i++) join(room, `P${i}`)
    server(room, { type: 'seat.setConnection', payload: { seat: first, presence: 'gone' } })
    join(room, 'Late')
    expectRejected(
      server(room, { type: 'seat.setConnection', payload: { seat: first, presence: 'active' } }),
      'players_full',
    )
  })

  test('indices are never reused', () => {
    const { room, players } = table(2)
    send(room, players[1]!, { type: 'seat.leave', payload: {} })
    expect(join(room, 'New')).toBe(2 as SeatIndex)
  })

  test('a command from a seat the room does not hold is refused', () => {
    const room = newRoom()
    expectRejected(vote(room, 7 as SeatIndex, '5'), 'not_seated')
  })
})

describe('roles: every player runs the room, a spectator watches', () => {
  test('a spectator may not vote, reveal, settle, move on, edit the queue, kick or change settings', () => {
    const { room, players, watchers } = table(1, 1)
    const s = watchers[0]!
    vote(room, players[0]!, '5')
    expectRejected(vote(room, s, '5'), 'forbidden')
    expectRejected(reveal(room, s), 'forbidden')
    expectRejected(next(room, s), 'forbidden')
    expectRejected(add(room, s, 'A'), 'forbidden')
    expectRejected(
      send(room, s, { type: 'seat.kick', payload: { seat: players[0]! } }),
      'forbidden',
    )
    expectRejected(settings(room, s, { autoReveal: true }), 'forbidden')
    expectRejected(send(room, s, { type: 'room.setTitle', payload: { name: 'Mine' } }), 'forbidden')
    expectRejected(
      send(room, s, { type: 'seat.setRole', payload: { seat: players[0]!, role: 'spectator' } }),
      'forbidden',
    )
    reveal(room, players[0]!)
    expectRejected(settle(room, s, '5'), 'forbidden')
  })

  test('a spectator may rename itself, become a player and leave', () => {
    const { room, watchers } = table(1, 1)
    const s = watchers[0]!
    expect(types(send(room, s, { type: 'seat.rename', payload: { name: 'Sam' } }))).toEqual([
      'seat.renamed',
    ])
    expect(
      types(send(room, s, { type: 'seat.setRole', payload: { seat: s, role: 'player' } })),
    ).toEqual(['seat.roleChanged'])
    expect(types(send(room, s, { type: 'seat.leave', payload: {} }))).toEqual(['seat.left'])
  })

  test('any player may kick any seat', () => {
    const { room, players } = table(3)
    expect(
      types(send(room, players[2]!, { type: 'seat.kick', payload: { seat: players[0]! } })),
    ).toEqual(['seat.kicked'])
    expect(room.state.seats.map((s) => s.index)).toEqual([players[1]!, players[2]!])
  })
})

describe('votes and the reveal', () => {
  test('a vote counts for the round it names and is refused for any other', () => {
    const { room, players } = table(2)
    const old = current(room).id
    vote(room, players[0]!, '3')
    reveal(room, players[0]!)
    expectRejected(vote(room, players[1]!, '5', old), 'round_closed')
    expectRejected(vote(room, players[1]!, '5', room.clock.newId()), 'round_unknown')
    revote(room, players[0]!)
    expectRejected(vote(room, players[1]!, '5', old), 'round_closed')
  })

  test('a card the deck lacks is refused; the special cards are in every deck', () => {
    const { room, players } = table(1)
    expectRejected(vote(room, players[0]!, '4'), 'card_unknown')
    expect(types(vote(room, players[0]!, '?'))).toEqual(['poker.voted'])
    expect(types(vote(room, players[0]!, '☕'))).toEqual(['poker.voted'])
  })

  test('a vote can change until the reveal; the same card again changes nothing', () => {
    const { room, players } = table(1)
    vote(room, players[0]!, '3')
    vote(room, players[0]!, '8')
    expect(current(room).votes).toEqual([{ seat: players[0]!, card: DECKS.fibonacci.cards[4]! }])
    const before = room.state
    const again = vote(room, players[0]!, '8')
    expect(again.ok && again.events).toEqual([])
    expect(room.state).toBe(before)
  })

  test('a reveal needs one vote', () => {
    const { room, players } = table(1)
    expectRejected(reveal(room, players[0]!), 'no_votes')
  })

  test('two reveals at once: the second is acknowledged and changes nothing', () => {
    const { room, players } = table(2)
    vote(room, players[0]!, '5')
    const round = current(room).id
    expect(types(reveal(room, players[0]!, round))).toContain('poker.revealed')
    const before = room.state
    const second = reveal(room, players[1]!, round)
    expect(second.ok && second.events).toEqual([])
    expect(room.state).toBe(before)
  })

  test('before the reveal a seat sees its own card and only that others voted', () => {
    const { room, players } = table(2)
    vote(room, players[0]!, '5')
    vote(room, players[1]!, '8')
    const mine = project(room.state, players[0]!)
    const round = mine.activity.rounds.find((r) => r.id === mine.activity.current)!
    expect(round.votes).toEqual([
      { seat: players[0]!, card: DECKS.fibonacci.cards[3]! },
      { seat: players[1]!, card: null },
    ])
    reveal(room, players[0]!)
    const after = project(room.state, players[0]!)
    expect(after.activity.rounds.at(-1)!.votes.every((v) => v.card !== null)).toBe(true)
  })

  test('poker.voted is published without the card', () => {
    const { room, players } = table(1)
    const result = vote(room, players[0]!, '5')
    expect(result.ok && result.events).toEqual([
      { type: 'poker.voted', payload: { round: current(room).id, seat: players[0]! } },
    ])
    const applied = {
      type: 'poker.voted' as const,
      payload: { round: 'r', seat: players[0]!, card: DECKS.fibonacci.cards[0]! },
    }
    expect(publish(applied)).toEqual({
      type: 'poker.voted',
      payload: { round: 'r', seat: players[0]! },
    })
  })

  test('a seat that leaves or becomes a spectator takes its hidden vote along', () => {
    const { room, players } = table(3)
    vote(room, players[0]!, '5')
    vote(room, players[1]!, '8')
    send(room, players[0]!, { type: 'seat.leave', payload: {} })
    send(room, players[1]!, {
      type: 'seat.setRole',
      payload: { seat: players[1]!, role: 'spectator' },
    })
    expect(current(room).votes).toEqual([])
  })
})

describe('the final value', () => {
  test('a unanimous reveal carries the decision in the same step', () => {
    const { room, players } = table(2)
    vote(room, players[0]!, '5')
    vote(room, players[1]!, '5')
    expect(types(reveal(room, players[0]!))).toEqual(['poker.revealed', 'topic.decided'])
    expect(room.state.topics[0]!.final).toMatchObject({ label: '5', value: 5, decidedBy: 'agreed' })
  })

  test('a unanimous "?" or a split decides nothing', () => {
    const { room, players } = table(2)
    vote(room, players[0]!, '?')
    vote(room, players[1]!, '?')
    expect(types(reveal(room, players[0]!))).toEqual(['poker.revealed'])
    revote(room, players[0]!)
    vote(room, players[0]!, '3')
    vote(room, players[1]!, '5')
    expect(types(reveal(room, players[0]!))).toEqual(['poker.revealed'])
  })

  test('settle needs a revealed round and an estimate card; a later settle corrects it', () => {
    const { room, players } = table(2)
    vote(room, players[0]!, '3')
    expectRejected(settle(room, players[0]!, '3'), 'not_revealed')
    vote(room, players[1]!, '8')
    reveal(room, players[0]!)
    expectRejected(settle(room, players[0]!, '?'), 'card_unknown')
    expectRejected(settle(room, players[0]!, '4'), 'card_unknown')
    expect(types(settle(room, players[0]!, '5'))).toEqual(['topic.decided'])
    expect(types(settle(room, players[1]!, '8'))).toEqual(['topic.decided'])
    expect(room.state.topics[0]!.final).toMatchObject({
      label: '8',
      value: 8,
      decidedBy: 'settled',
    })
  })

  test('decide, then vote again on the same round: the second is refused', () => {
    const { room, players } = table(2)
    vote(room, players[0]!, '3')
    vote(room, players[1]!, '8')
    reveal(room, players[0]!)
    const round = current(room).id
    settle(room, players[0]!, '5', round)
    expectRejected(revote(room, players[1]!, round), 'topic_decided')
  })

  test('vote again, then decide on the old round: the second is refused', () => {
    const { room, players } = table(2)
    vote(room, players[0]!, '3')
    reveal(room, players[0]!)
    const round = current(room).id
    revote(room, players[1]!, round)
    expectRejected(settle(room, players[0]!, '3', round), 'round_closed')
  })

  test('a decided topic can be corrected after the room moved on', () => {
    const { room, players } = table(1)
    vote(room, players[0]!, '5')
    reveal(room, players[0]!)
    const round = current(room).id
    next(room, players[0]!)
    expect(types(settle(room, players[0]!, '8', round))).toEqual(['topic.decided'])
    expect(room.state.topics[0]).toMatchObject({ state: 'done', final: { label: '8' } })
  })
})

describe('the topic queue', () => {
  test('moving on marks a revealed topic done, an unrevealed one skipped, and opens the next queued', () => {
    const { room, players } = table(1)
    add(room, players[0]!, 'A', 'B')
    expect(types(next(room, players[0]!))).toEqual([
      'topic.closed',
      'topic.activated',
      'poker.roundStarted',
    ])
    expect(room.state.topics.map((t) => [t.title, t.state])).toEqual([
      [null, 'skipped'],
      ['A', 'active'],
      ['B', 'queued'],
    ])
    vote(room, players[0]!, '5')
    reveal(room, players[0]!)
    next(room, players[0]!)
    expect(room.state.topics.map((t) => t.state)).toEqual(['skipped', 'done', 'active'])
  })

  test('with an empty queue, moving on opens a new untitled topic', () => {
    const { room, players } = table(1)
    expect(types(next(room, players[0]!))).toEqual([
      'topic.closed',
      'topic.added',
      'topic.activated',
      'poker.roundStarted',
    ])
    expect(room.state.topics.map((t) => [t.title, t.state])).toEqual([
      [null, 'skipped'],
      [null, 'active'],
    ])
  })

  test('move on to a chosen queued topic; a stale move on is refused', () => {
    const { room, players } = table(2)
    add(room, players[0]!, 'A', 'B')
    const b = room.state.topics[2]!.id
    const round = current(room).id
    next(room, players[0]!, b)
    expect(room.state.topics.find((t) => t.state === 'active')?.title).toBe('B')
    expectRejected(
      send(room, players[1]!, { type: 'topic.next', payload: { round } }),
      'round_closed',
    )
    expectRejected(next(room, players[1]!, b), 'topic_not_queued')
  })

  test('only a queued topic is removed; the queue holds 200 open topics', () => {
    const { room, players } = table(1)
    const active = room.state.topics[0]!.id
    expectRejected(
      send(room, players[0]!, { type: 'topic.remove', payload: { topic: active } }),
      'topic_not_queued',
    )
    expect(
      types(add(room, players[0]!, ...Array.from({ length: 199 }, (_, i) => `T${i}`))),
    ).toEqual(['topic.added'])
    expectRejected(add(room, players[0]!, 'one too many'), 'queue_full')
  })

  test('move and update', () => {
    const { room, players } = table(1)
    add(room, players[0]!, 'A', 'B')
    const b = room.state.topics[2]!.id
    send(room, players[0]!, { type: 'topic.move', payload: { topic: b, index: 0 } })
    expect(room.state.topics[0]!.title).toBe('B')
    send(room, players[0]!, {
      type: 'topic.update',
      payload: { topic: b, title: 'B2', url: null, ref: null },
    })
    expect(room.state.topics[0]!.title).toBe('B2')
  })

  test('topic and round ids are UUID v7 from ctx', () => {
    const { room, players } = table(1)
    add(room, players[0]!, 'A')
    next(room, players[0]!)
    const v7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    for (const topic of room.state.topics) expect(topic.id).toMatch(v7)
    expect(current(room).id).toMatch(v7)
  })
})

describe('a repeated command', () => {
  test('the same id is acknowledged again and applied once', () => {
    const { room, players } = table(1)
    send(
      room,
      players[0]!,
      { type: 'poker.vote', payload: { round: current(room).id, card: '3' } },
      'same',
    )
    vote(room, players[0]!, '8')
    const before = room.state
    const again = send(
      room,
      players[0]!,
      { type: 'poker.vote', payload: { round: current(room).id, card: '3' } },
      'same',
    )
    expect(again.ok && again.duplicate).toBe(true)
    expect(room.state).toBe(before)
    expect(current(room).votes[0]!.card.label).toBe('8')
  })

  test('the room remembers the latest 256 ids', () => {
    const { room, players } = table(1)
    for (let i = 0; i < 300; i++) vote(room, players[0]!, i % 2 === 0 ? '3' : '5')
    expect(room.state.applied).toHaveLength(LIMITS.appliedLog)
  })
})

function auto(n: number, countdown = 3) {
  const t = table(n)
  settings(t.room, t.players[0]!, { autoReveal: true, revealCountdown: countdown })
  return t
}

describe('auto reveal', () => {
  test('fires when every active player has voted; away seats never block', () => {
    const { room, players } = auto(3)
    send(room, players[2]!, { type: 'seat.setPresence', payload: { presence: 'away' } })
    vote(room, players[0]!, '5')
    const last = vote(room, players[1]!, '8')
    expect(types(last)).toEqual(['poker.voted', 'poker.countdownStarted'])
    expect(last.ok && last.effects).toEqual([
      {
        type: 'schedule',
        timer: 'countdown',
        round: current(room).id,
        at: room.clock.now() + 3000,
      },
    ])
    room.clock.advance(3000)
    const fired = server(room, {
      type: 'poker.countdownElapsed',
      payload: { round: current(room).id },
    })
    expect(types(fired)).toEqual(['poker.revealed'])
    const persisted = fired.ok ? fired.effects.find((e) => e.type === 'persistRound') : undefined
    expect(persisted).toMatchObject({
      round: {
        autoReveal: true,
        players: 3,
        spectators: 0,
        votes: [
          { seat: players[0]!, label: '5', value: 5 },
          { seat: players[1]!, label: '8', value: 8 },
        ],
      },
    })
  })

  test('a countdown that has not run out changes nothing', () => {
    const { room, players } = auto(1)
    vote(room, players[0]!, '5')
    const early = server(room, {
      type: 'poker.countdownElapsed',
      payload: { round: current(room).id },
    })
    expect(early.ok && early.events).toEqual([])
  })

  test('a vote changed during the countdown is accepted and the countdown runs on', () => {
    const { room, players } = auto(2)
    vote(room, players[0]!, '5')
    vote(room, players[1]!, '5')
    expect(types(vote(room, players[1]!, '8'))).toEqual(['poker.voted'])
    expect(current(room).countdown).not.toBeNull()
  })

  test('a cancelled countdown keeps auto reveal off for the round', () => {
    const { room, players } = auto(2)
    vote(room, players[0]!, '5')
    vote(room, players[1]!, '5')
    expect(
      types(
        send(room, players[0]!, {
          type: 'poker.cancelReveal',
          payload: { round: current(room).id },
        }),
      ),
    ).toEqual(['poker.countdownCancelled'])
    expect(types(vote(room, players[1]!, '8'))).toEqual(['poker.voted'])
    expect(current(room)).toMatchObject({ countdown: null, armed: false })
  })

  test('a cleared vote cancels the countdown, and voting again restarts it', () => {
    const { room, players } = auto(2)
    vote(room, players[0]!, '5')
    vote(room, players[1]!, '5')
    const cleared = send(room, players[1]!, {
      type: 'poker.clearVote',
      payload: { round: current(room).id },
    })
    expect(types(cleared)).toEqual(['poker.voteCleared', 'poker.countdownCancelled'])
    expect(cleared.ok && cleared.effects).toEqual([
      { type: 'cancel', timer: 'countdown', round: current(room).id },
    ])
    expect(types(vote(room, players[1]!, '3'))).toEqual(['poker.voted', 'poker.countdownStarted'])
  })

  test('a countdown of 0 reveals at once', () => {
    const { room, players } = auto(1, 0)
    expect(types(vote(room, players[0]!, '5'))).toEqual([
      'poker.voted',
      'poker.revealed',
      'topic.decided',
    ])
  })

  test('the last player leaving can complete the round', () => {
    const { room, players } = auto(2)
    vote(room, players[0]!, '5')
    expect(types(send(room, players[1]!, { type: 'seat.leave', payload: {} }))).toEqual([
      'seat.left',
      'poker.countdownStarted',
    ])
  })
})

describe('the timer', () => {
  test('a round starts with the timer, and its end starts the countdown when auto reveal is on', () => {
    const { room, players } = table(2)
    settings(room, players[0]!, { timer: 30, autoReveal: true })
    const started = next(room, players[0]!)
    const round = current(room)
    expect(round.timerEndsAt).toBe(room.clock.now() + 30_000)
    expect(started.ok && started.effects).toEqual([
      { type: 'schedule', timer: 'timer', round: round.id, at: round.timerEndsAt! },
    ])
    vote(room, players[0]!, '5')
    room.clock.advance(30_000)
    const ended = server(room, { type: 'poker.timerElapsed', payload: { round: round.id } })
    expect(ended.ok && ended.events).toEqual([
      {
        type: 'poker.countdownStarted',
        payload: { round: round.id, endsAt: room.clock.now() + 3000, cause: 'timer' },
      },
    ])
  })

  test('with auto reveal off, the end of the timer changes nothing', () => {
    const { room, players } = table(1)
    settings(room, players[0]!, { timer: 30 })
    next(room, players[0]!)
    vote(room, players[0]!, '5')
    room.clock.advance(30_000)
    const ended = server(room, { type: 'poker.timerElapsed', payload: { round: current(room).id } })
    expect(ended.ok && ended.events).toEqual([])
  })

  test('a reveal cancels a running timer', () => {
    const { room, players } = table(1)
    settings(room, players[0]!, { timer: 60 })
    next(room, players[0]!)
    vote(room, players[0]!, '5')
    const revealed = reveal(room, players[0]!)
    expect(revealed.ok && revealed.effects.map((e) => e.type)).toEqual([
      'cancel',
      'persistRound',
      'persistDecision',
    ])
  })
})

describe('settings, title, access and address', () => {
  test('a new deck applies to the current round only while it has no vote', () => {
    const { room, players } = table(1)
    settings(room, players[0]!, { deck: DECKS['t-shirt'] })
    expect(current(room).deck.id).toBe('t-shirt')
    vote(room, players[0]!, 'M')
    settings(room, players[0]!, {
      deck: parseDeck({
        id: 'custom',
        cards: [
          { label: 'S', value: 1 },
          { label: 'L', value: 3 },
        ],
      })!,
    })
    expect(current(room).deck.id).toBe('t-shirt')
    revote(room, players[0]!) // not revealed yet
    reveal(room, players[0]!)
    revote(room, players[0]!)
    expect(current(room).deck.id).toBe('custom')
  })

  test('the same settings again change nothing', () => {
    const { room, players } = table(1)
    const result = settings(room, players[0]!, { autoReveal: false })
    expect(result.ok && result.events).toEqual([])
  })

  test('the lock and the address arrive as events from the server', () => {
    const room = newRoom()
    const code = parseAccessCode('k7m2qx')!
    expect(
      types(server(room, { type: 'room.setAccess', payload: { access: 'locked', code } })),
    ).toEqual(['room.accessChanged'])
    expect(room.state.room).toMatchObject({ access: 'locked', code })
    server(room, { type: 'room.setAccess', payload: { access: 'open', code } })
    expect(room.state.room).toMatchObject({ access: 'open', code: null })
    server(room, { type: 'room.setSlug', payload: { slug: parseSlug('482913')! } })
    expect(room.state.room.slug).toBe(parseSlug('482913')!)
    expect(check(room.state)).toEqual([])
  })
})

describe('a step that throws', () => {
  test('leaves the room as it was', () => {
    const { room, players } = table(1)
    vote(room, players[0]!, '5')
    const before: RoomState = room.state
    const snapshot = JSON.stringify(before)
    const failing = {
      now: room.clock.now(),
      newId: () => {
        throw new Error('no ids today')
      },
    }
    expect(() =>
      step(
        before,
        {
          by: players[0]!,
          id: 'x',
          command: { type: 'poker.reveal', payload: { round: current(room).id } },
        },
        failing,
      ),
    ).toThrow('no ids today')
    expect(JSON.stringify(before)).toBe(snapshot)
  })
})

describe('check', () => {
  test('finds a broken room', () => {
    const { room, players } = table(1)
    vote(room, players[0]!, '5')
    const broken: RoomState = {
      ...room.state,
      topics: room.state.topics.map((t) => ({ ...t, state: 'queued' as const })),
    }
    expect(check(broken).length).toBeGreaterThan(0)
  })
})
