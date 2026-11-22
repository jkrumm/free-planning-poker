/**
 * What v1's rows become in v9 (docs/v9/ARCHITECTURE.md, Data model: What comes over from v1). Pure: the same dump
 * plans the same rows, ids included, so a second import finds every row it plans already there.
 *
 * - A room keeps v1's id, its number as an address and its name as a booked one (`parseV1Address`), primary where it has one.
 * - Each `fpp_votes` row is one untitled topic and one round with v1's summary of it.
 * - Each day a v1 user id voted is a `visitor_day` row, inside the 13 months the table keeps.
 * - Each v1 day gets every `stat_daily` metric v1's rows can fill, under the rollup job's names.
 */
import { createHash } from 'node:crypto'
import { DECKS, DEFAULT_DECK_ID, parseSlug, parseV1Address } from '@fpp/room-core/types'
import type { AddressKind } from '../../db/addresses.ts'
import { addDays } from '../../db/stat-calendar.ts'
import { cardDimension, hourDimension, METRIC } from '../../db/stat-metrics.ts'
import { hashVisitor, utcDay } from '../../db/visitors.ts'
import type { DayCounts, V1Data, V1Room, V1Vote } from './v1-reader.ts'

export type Skip = {
  /** The v1 table and the id of its row. */
  readonly table: 'fpp_rooms' | 'fpp_votes'
  readonly id: number
  /** What was not carried: the whole row, or one address of a room. */
  readonly part: 'room' | 'round' | 'number' | 'name'
  readonly reason: string
}

export type PlannedRoom = {
  readonly id: number
  readonly name: string
  readonly createdAt: Date
  readonly lastActiveAt: Date
}

export type PlannedSlug = {
  readonly slug: string
  readonly roomId: number
  readonly kind: AddressKind
  primary: boolean
  /** The hold is counted from here (`release_at` = last use + the hold of `holds.ts`). */
  readonly lastUsedAt: Date
  /** The v1 room's id, for a skip. */
  readonly v1Id: number
}

export type RoundSummary = {
  readonly average: number
  readonly lowest: number
  readonly highest: number
  readonly count: number
}

export type PlannedRound = {
  readonly v1Id: number
  readonly id: string
  readonly topicId: string
  readonly roomId: number
  readonly no: number
  readonly startedAt: Date
  readonly revealedAt: Date
  readonly players: number
  readonly spectators: number
  readonly consensus: boolean
  readonly autoReveal: boolean
  /** Null for a reveal at which nobody had voted: v1 stored 21 and 1 as its bounds then. */
  readonly summary: RoundSummary | null
}

export type PlannedStat = {
  readonly day: string
  readonly metric: string
  readonly dimension: string
  readonly value: number
}

export type Plan = {
  readonly rooms: PlannedRoom[]
  readonly slugs: PlannedSlug[]
  readonly rounds: PlannedRound[]
  readonly visitorDays: { readonly day: string; readonly visitor: Uint8Array }[]
  readonly stats: PlannedStat[]
  readonly skips: Skip[]
  /** The first and the last v1 day of `stat_daily`. */
  readonly days: { readonly from: string; readonly to: string } | null
  /** Votes whose value is no card of v1's deck (sent by hand to v1's socket): counted as votes, never as a card. */
  readonly offDeckVotes: number
}

/** The deck of every v1 round: v1 had one, and v9's Fibonacci holds its cards (decks.ts). */
export const V1_DECK = DEFAULT_DECK_ID

const V1_CARDS: ReadonlySet<string> = new Set(DECKS[V1_DECK].cards.map((card) => card.label))

/**
 * A UUID v7 that is the same for the same v1 row: the reveal time is its timestamp, as in an id v9 mints, and the rest
 * comes from SHA-256 of what it stands for.
 */
export function stableUuid7(ms: number, seed: string): string {
  const bytes = new Uint8Array(16)
  let time = Math.max(0, Math.floor(ms))
  for (let i = 5; i >= 0; i -= 1) {
    bytes[i] = time % 256
    time = Math.floor(time / 256)
  }
  bytes.set(createHash('sha256').update(seed).digest().subarray(0, 10), 6)
  bytes[6] = 0x70 | ((bytes[6] ?? 0) & 0x0f)
  bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f)
  const hex = Buffer.from(bytes).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const ONLY_DIGITS = /^\d+$/

type NameClaim = { readonly room: V1Room; readonly slug: string; readonly exact: boolean }

/** Who keeps a name two v1 rooms map to: a name v1 held exactly, then the room used last, then the lower id. */
const before = (a: NameClaim, b: NameClaim) =>
  Number(b.exact) - Number(a.exact) ||
  b.room.lastUsedAt.getTime() - a.room.lastUsedAt.getTime() ||
  a.room.id - b.room.id

function planAddresses(rooms: readonly V1Room[], skips: Skip[]) {
  const slugs: PlannedSlug[] = []
  const names = new Map<string, NameClaim[]>()
  const numbers = new Map<number, string>()
  const digitNames = new Map<number, string>()
  const ownNumbers = new Set(rooms.map((room) => String(room.number)))
  for (const room of rooms) {
    const number = parseSlug(String(room.number))
    if (number !== undefined && ONLY_DIGITS.test(number)) numbers.set(room.id, number)
    else
      skips.push({
        table: 'fpp_rooms',
        id: room.id,
        part: 'number',
        reason: 'its number is not six digits, the only numbers a v9 address has',
      })
    if (room.name === String(room.number)) continue
    if (ONLY_DIGITS.test(room.name.trim())) {
      // A name of six or eight digits is what v9 reads as a number: it stays an address of the room unless it is another
      // room's number, which v1 resolved first as well.
      const asNumber = parseSlug(room.name)
      if (asNumber !== undefined && !ownNumbers.has(asNumber)) digitNames.set(room.id, asNumber)
      else
        skips.push({
          table: 'fpp_rooms',
          id: room.id,
          part: 'name',
          reason:
            asNumber === undefined
              ? 'its name is digits only but not six or eight of them, which no v9 address is'
              : "its name is digits only and another room's number",
        })
      continue
    }
    const slug = parseV1Address(room.name)
    if (slug === undefined) {
      skips.push({
        table: 'fpp_rooms',
        id: room.id,
        part: 'name',
        reason: 'no v9 name remains of it (3 to 30 of a-z, 0-9 and -, one letter at least)',
      })
      continue
    }
    const claim = { room, slug, exact: slug === room.name }
    const claims = names.get(slug)
    if (claims === undefined) names.set(slug, [claim])
    else claims.push(claim)
  }
  const named = new Map<number, string>()
  for (const claims of names.values()) {
    const [winner, ...losers] = claims.toSorted(before)
    if (winner === undefined) continue
    named.set(winner.room.id, winner.slug)
    for (const loser of losers)
      skips.push({
        table: 'fpp_rooms',
        id: loser.room.id,
        part: 'name',
        reason: `its name leads to the same v9 name as room ${winner.room.id}'s, which keeps it (${
          winner.exact ? 'its name was that already' : 'used later'
        })`,
      })
  }
  for (const room of rooms) {
    const name = named.get(room.id)
    const number = numbers.get(room.id)
    if (number !== undefined)
      slugs.push({
        slug: number,
        roomId: room.id,
        kind: 'number',
        primary: name === undefined,
        lastUsedAt: room.lastUsedAt,
        v1Id: room.id,
      })
    const digits = digitNames.get(room.id)
    if (digits !== undefined)
      slugs.push({
        slug: digits,
        roomId: room.id,
        kind: 'number',
        primary: name === undefined && number === undefined,
        lastUsedAt: room.lastUsedAt,
        v1Id: room.id,
      })
    if (name !== undefined)
      slugs.push({
        slug: name,
        roomId: room.id,
        kind: 'name',
        primary: true,
        lastUsedAt: room.lastUsedAt,
        v1Id: room.id,
      })
  }
  return { slugs, named, numbers, digitNames }
}

function planRounds(votes: readonly V1Vote[], rooms: ReadonlySet<number>, skips: Skip[]) {
  const byRoom = new Map<number, V1Vote[]>()
  for (const vote of votes) {
    if (!rooms.has(vote.roomId)) {
      skips.push({
        table: 'fpp_votes',
        id: vote.id,
        part: 'round',
        reason: `its room ${vote.roomId} is not in the dump; the round still counts in the daily totals`,
      })
      continue
    }
    const list = byRoom.get(vote.roomId)
    if (list === undefined) byRoom.set(vote.roomId, [vote])
    else list.push(vote)
  }
  const rounds: PlannedRound[] = []
  for (const [roomId, list] of byRoom) {
    const ordered = list.toSorted(
      (a, b) => a.votedAt.getTime() - b.votedAt.getTime() || a.id - b.id,
    )
    ordered.forEach((vote, index) => {
      const at = vote.votedAt.getTime()
      rounds.push({
        v1Id: vote.id,
        id: stableUuid7(at, `v1-vote-round:${vote.id}`),
        topicId: stableUuid7(at, `v1-vote-topic:${vote.id}`),
        roomId,
        no: index + 1,
        startedAt: new Date(at - Math.max(0, vote.durationSeconds) * 1000),
        revealedAt: vote.votedAt,
        players: vote.count,
        spectators: vote.spectators,
        consensus: vote.lowest === vote.highest,
        autoReveal: vote.autoFlip,
        summary:
          vote.count > 0
            ? {
                average: vote.average,
                lowest: vote.lowest,
                highest: vote.highest,
                count: vote.count,
              }
            : null,
      })
    })
  }
  return rounds
}

function planStats(data: V1Data): { stats: PlannedStat[]; days: Plan['days'] } {
  type Day = {
    rounds: number
    votes: number
    consensus: number
    created: number
    rooms: Set<number>
    hours: Map<string, number>
  }
  const days = new Map<string, Day>()
  const dayOf = (day: string): Day => {
    let of = days.get(day)
    if (of === undefined)
      days.set(
        day,
        (of = {
          rounds: 0,
          votes: 0,
          consensus: 0,
          created: 0,
          rooms: new Set(),
          hours: new Map(),
        }),
      )
    return of
  }
  // v1's own counting (fpp-analytics on the branch v1): every votes row is a round, its amount of estimations its votes.
  for (const vote of data.votes) {
    const day = dayOf(utcDay(vote.votedAt))
    day.rounds += 1
    day.votes += vote.count
    if (vote.lowest === vote.highest) day.consensus += 1
    day.rooms.add(vote.roomId)
    const hour = hourDimension(vote.votedAt.getUTCHours())
    day.hours.set(hour, (day.hours.get(hour) ?? 0) + 1)
  }
  for (const room of data.rooms) dayOf(utcDay(room.firstUsedAt)).created += 1
  const all = [
    ...days.keys(),
    ...data.cards.keys(),
    ...data.voters.keys(),
    ...data.pageViews.keys(),
    ...data.events.keys(),
  ]
  if (all.length === 0) return { stats: [], days: null }
  const from = all.reduce((a, b) => (a < b ? a : b))
  const to = all.reduce((a, b) => (a > b ? a : b))

  const stats: PlannedStat[] = []
  const push = (day: string, metric: string, dimension: string, value: number) =>
    stats.push({ day, metric, dimension, value })
  const sparse = (
    day: string,
    metric: string,
    counts: DayCounts,
    dimension: (key: string) => string,
  ) => {
    for (const [key, value] of counts.get(day) ?? []) push(day, metric, dimension(key), value)
  }
  // A user is new on the first day of v1 they voted; v1 kept every day, so this looks further back than the job's 13 months.
  const seen = new Set<string>()
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const of = days.get(day)
    const voters = data.voters.get(day) ?? new Set<string>()
    let fresh = 0
    for (const user of voters) if (!seen.has(user)) fresh += 1
    for (const user of voters) seen.add(user)
    push(day, METRIC.rounds, '', of?.rounds ?? 0)
    push(day, METRIC.votes, '', of?.votes ?? 0)
    push(day, METRIC.roundsConsensus, '', of?.consensus ?? 0)
    push(day, METRIC.roomsCreated, '', of?.created ?? 0)
    push(day, METRIC.roomsActive, '', of?.rooms.size ?? 0)
    push(day, METRIC.estimators, '', voters.size)
    push(day, METRIC.estimatorsNew, '', fresh)
    for (const [hour, value] of of?.hours ?? []) push(day, METRIC.roundsByHour, hour, value)
    for (const [card, value] of data.cards.get(day) ?? [])
      if (V1_CARDS.has(card)) push(day, METRIC.cardVotes, cardDimension(V1_DECK, card), value)
    sparse(day, METRIC.pageViews, data.pageViews, (route) => route)
    sparse(day, METRIC.events, data.events, (event) => event)
  }
  return { stats, days: { from, to } }
}

/**
 * Plans the import of `data`. `retainedFrom` is the first day `visitor_day` keeps (13 months back, as the sweep counts);
 * `visitorKey` is the API's `VISITOR_KEY`, so a returning browser's device id lands on the same rows.
 */
export function planImport(
  data: V1Data,
  args: { readonly retainedFrom: string; readonly visitorKey: string },
): Plan {
  const skips: Skip[] = []
  const rooms = data.rooms.toSorted((a, b) => a.id - b.id)
  const { slugs, named, numbers, digitNames } = planAddresses(rooms, skips)
  const planned = rooms.map((room) => ({
    id: room.id,
    name:
      named.get(room.id) ?? numbers.get(room.id) ?? digitNames.get(room.id) ?? String(room.number),
    createdAt: room.firstUsedAt,
    lastActiveAt: room.lastUsedAt,
  }))
  const rounds = planRounds(data.votes, new Set(rooms.map((room) => room.id)), skips)
  const visitorDays: Plan['visitorDays'] = []
  for (const [day, users] of [...data.voters].toSorted(([a], [b]) => a.localeCompare(b))) {
    if (day < args.retainedFrom) continue
    for (const user of users)
      visitorDays.push({ day, visitor: hashVisitor({ key: args.visitorKey, deviceId: user }) })
  }
  const { stats, days } = planStats(data)
  let offDeckVotes = 0
  for (const cards of data.cards.values())
    for (const [card, count] of cards) if (!V1_CARDS.has(card)) offDeckVotes += count
  return { rooms: planned, slugs, rounds, visitorDays, stats, skips, days, offDeckVotes }
}
