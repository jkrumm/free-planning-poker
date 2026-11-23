/**
 * Ten days of rounds, votes, rooms and estimating days for the rollup tests, with what each day must roll up to,
 * computed by hand. 2026-06-01 is a Monday. The edges are on purpose: a round at exactly 00:00:00 belongs to its own
 * day, one at 23:59:59 to the day it is in; a v1 room is not counted as created; a custom deck's cards have no label.
 */
import type { DbClient } from '../src/db/client.ts'
import { createRoom } from '../src/db/rooms.ts'
import { insertRound } from '../src/db/rounds.ts'
import { upsertTopics } from '../src/db/topics.ts'
import { hashVisitor, recordEstimatingDay } from '../src/db/visitors.ts'

type Count = { readonly label: string; readonly count: number }
type FixtureRound = {
  readonly room: 'r1' | 'r2'
  readonly at: string
  readonly deck: string
  readonly cards: readonly Count[]
  readonly consensus: boolean
}

const ROUNDS: readonly FixtureRound[] = [
  {
    room: 'r1',
    at: '2026-06-01T09:10:00Z',
    deck: 'fibonacci',
    cards: [{ label: '5', count: 3 }],
    consensus: true,
  },
  {
    room: 'r1',
    at: '2026-06-01T09:50:00Z',
    deck: 'fibonacci',
    cards: [
      { label: '3', count: 1 },
      { label: '5', count: 2 },
    ],
    consensus: false,
  },
  {
    room: 'r1',
    at: '2026-06-01T14:00:00Z',
    deck: 't-shirt',
    cards: [
      { label: 'M', count: 2 },
      { label: 'L', count: 1 },
    ],
    consensus: false,
  },
  {
    room: 'r1',
    at: '2026-06-03T00:00:00Z',
    deck: 'fibonacci',
    cards: [{ label: '1', count: 2 }],
    consensus: true,
  },
  {
    room: 'r2',
    at: '2026-06-03T23:59:59Z',
    deck: 'fibonacci',
    cards: [
      { label: '8', count: 2 },
      { label: '?', count: 1 },
    ],
    consensus: false,
  },
  {
    room: 'r2',
    at: '2026-06-04T00:00:00Z',
    deck: 'custom',
    cards: [{ label: 'Foo', count: 2 }],
    consensus: true,
  },
  {
    room: 'r1',
    at: '2026-06-06T12:00:00Z',
    deck: 'fibonacci',
    cards: [
      { label: '5', count: 1 },
      { label: '13', count: 1 },
    ],
    consensus: false,
  },
  {
    room: 'r2',
    at: '2026-06-08T08:30:00Z',
    deck: 'fibonacci',
    cards: [{ label: '5', count: 2 }],
    consensus: true,
  },
  {
    room: 'r2',
    at: '2026-06-08T08:45:00Z',
    deck: 'fibonacci',
    cards: [
      { label: '5', count: 1 },
      { label: '8', count: 1 },
    ],
    consensus: false,
  },
  {
    room: 'r2',
    at: '2026-06-10T08:00:00Z',
    deck: 'fibonacci',
    cards: [{ label: '2', count: 1 }],
    consensus: true,
  },
]

/** Who voted on which day: five devices. */
const DEVICES: Record<string, readonly string[]> = {
  '2026-06-01': ['d1', 'd2'],
  '2026-06-02': ['d1'],
  '2026-06-03': ['d1', 'd3'],
  '2026-06-06': ['d2', 'd3', 'd4'],
  '2026-06-08': ['d1'],
  '2026-06-10': ['d5'],
}

export const FIXTURE_DAYS = [
  '2026-06-01',
  '2026-06-02',
  '2026-06-03',
  '2026-06-04',
  '2026-06-05',
  '2026-06-06',
  '2026-06-07',
  '2026-06-08',
  '2026-06-09',
  '2026-06-10',
] as const

export type DayFigures = {
  rounds: number
  votes: number
  consensus: number
  created: number
  active: number
  estimators: number
  estimatorsNew: number
  hours: Record<string, number>
  cards: Record<string, number>
}

const none: DayFigures = {
  rounds: 0,
  votes: 0,
  consensus: 0,
  created: 0,
  active: 0,
  estimators: 0,
  estimatorsNew: 0,
  hours: {},
  cards: {},
}

/** What each day rolls up to, counted by hand from the rounds above. */
export const EXPECTED: Record<string, DayFigures> = {
  '2026-06-01': {
    rounds: 3,
    votes: 9,
    consensus: 1,
    created: 1,
    active: 1,
    estimators: 2,
    estimatorsNew: 2,
    hours: { '09': 2, '14': 1 },
    cards: { 'fibonacci/5': 5, 'fibonacci/3': 1, 't-shirt/M': 2, 't-shirt/L': 1 },
  },
  '2026-06-02': { ...none, estimators: 1 },
  '2026-06-03': {
    rounds: 2,
    votes: 5,
    consensus: 1,
    created: 1,
    active: 2,
    estimators: 2,
    estimatorsNew: 1,
    hours: { '00': 1, '23': 1 },
    cards: { 'fibonacci/1': 2, 'fibonacci/8': 2, 'fibonacci/?': 1 },
  },
  '2026-06-04': {
    ...none,
    rounds: 1,
    votes: 2,
    consensus: 1,
    active: 1,
    hours: { '00': 1 },
    cards: { 'custom/': 2 },
  },
  '2026-06-05': none,
  '2026-06-06': {
    ...none,
    rounds: 1,
    votes: 2,
    active: 1,
    estimators: 3,
    estimatorsNew: 1,
    hours: { '12': 1 },
    cards: { 'fibonacci/5': 1, 'fibonacci/13': 1 },
  },
  '2026-06-07': none,
  '2026-06-08': {
    ...none,
    rounds: 2,
    votes: 4,
    consensus: 1,
    active: 1,
    estimators: 1,
    hours: { '08': 2 },
    cards: { 'fibonacci/5': 3, 'fibonacci/8': 1 },
  },
  '2026-06-09': none,
  '2026-06-10': {
    ...none,
    rounds: 1,
    votes: 1,
    consensus: 1,
    active: 1,
    estimators: 1,
    estimatorsNew: 1,
    hours: { '08': 1 },
    cards: { 'fibonacci/2': 1 },
  },
}

const VISITOR_KEY = 'a-test-key-that-is-long-enough-000000'

const valueOf = (label: string): number | null => {
  if (label === '?') return null
  const n = Number(label)
  return Number.isNaN(n) ? 2 : n
}

/** Writes the fixture's rooms, rounds, votes and estimating days. */
export async function seedFixture(client: DbClient): Promise<void> {
  const db = client.db
  const r1 = await createRoom(db, { createdAt: new Date('2026-06-01T08:00:00Z') })
  const r2 = await createRoom(db, { createdAt: new Date('2026-06-03T20:00:00Z') })
  // A v1 room is the importer's: it is not a room v9 created.
  await createRoom(db, { origin: 'v1', createdAt: new Date('2026-06-02T10:00:00Z') })
  const roomId = { r1, r2 }
  const next = { r1: 0, r2: 0 }
  for (const round of ROUNDS) {
    const id = roomId[round.room]
    next[round.room] += 1
    const [topic] = await upsertTopics(db, {
      roomId: id,
      topics: [{ id: Bun.randomUUIDv7(), position: next[round.room], title: 'x' }],
    })
    const revealedAt = new Date(round.at)
    const votes = round.cards.flatMap((card) =>
      Array.from({ length: card.count }, () => ({ label: card.label, value: valueOf(card.label) })),
    )
    await insertRound(db, {
      round: {
        id: Bun.randomUUIDv7(),
        roomId: id,
        topicId: topic!.id,
        no: next[round.room],
        attempt: 1,
        deck: { id: round.deck },
        startedAt: new Date(revealedAt.getTime() - 60_000),
        revealedAt,
        players: votes.length,
        spectators: 0,
        distribution: round.cards.map((card) => ({ ...card, value: valueOf(card.label) })),
        consensus: round.consensus,
        autoReveal: false,
      },
      votes: votes.map((vote, seat) => ({ seat, ...vote })),
    })
  }
  for (const [day, devices] of Object.entries(DEVICES))
    for (const device of devices)
      await recordEstimatingDay(db, {
        day,
        visitor: hashVisitor({ key: VISITOR_KEY, deviceId: device }),
      })
}
