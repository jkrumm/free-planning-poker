/**
 * v1's tables as the importer needs them, read from a dump in one pass (schema: origin/v1:packages/db/src/schema.ts).
 * Rooms and votes are kept as rows; estimations, page views and events only as counts per UTC day, and the user ids of
 * estimations only for the days they voted. `fpp_users` (device, browser, place) and `fpp_feature_flags` are never read.
 */
import { readDump, type DumpValue, utcTimestamp } from './dump.ts'
import { utcDay } from '../../db/visitors.ts'

export type V1Room = {
  readonly id: number
  readonly number: number
  readonly name: string
  readonly firstUsedAt: Date
  readonly lastUsedAt: Date
}

/** One reveal in v1 (`fpp_votes`): what v1 kept of a round. */
export type V1Vote = {
  readonly id: number
  readonly roomId: number
  readonly average: number
  readonly highest: number
  readonly lowest: number
  readonly count: number
  readonly spectators: number
  readonly durationSeconds: number
  readonly autoFlip: boolean
  readonly votedAt: Date
}

export type DayCounts = Map<string, Map<string, number>>

export type V1Data = {
  readonly rooms: V1Room[]
  readonly votes: V1Vote[]
  /** Per day, the votes cast by card value (an estimation that is not a spectator's and not empty). */
  readonly cards: DayCounts
  /** Per day, the v1 user ids that cast a vote. */
  readonly voters: Map<string, Set<string>>
  /** Per day, page views by route and events by name. */
  readonly pageViews: DayCounts
  readonly events: DayCounts
  /** Rows read per v1 table. */
  readonly read: Record<string, number>
  /** Estimations that were no vote: a spectator's, or empty. */
  notVotes: number
}

const int = (value: DumpValue): number => {
  const n = Number(value)
  if (value === null || !Number.isFinite(n)) throw new Error(`not a number: ${String(value)}`)
  return n
}
const text = (value: DumpValue): string => {
  if (value === null) throw new Error('a NOT NULL column is NULL')
  return value
}

const bump = (counts: DayCounts, day: string, key: string) => {
  let of = counts.get(day)
  if (of === undefined) counts.set(day, (of = new Map()))
  of.set(key, (of.get(key) ?? 0) + 1)
}

/** Reads every table the importer uses from a dump stream. */
export async function readV1(stream: ReadableStream<Uint8Array>): Promise<V1Data> {
  const data: V1Data = {
    rooms: [],
    votes: [],
    cards: new Map(),
    voters: new Map(),
    pageViews: new Map(),
    events: new Map(),
    read: {},
    notVotes: 0,
  }
  const summary = await readDump(stream, {
    fpp_rooms: {
      columns: ['id', 'number', 'name', 'first_used_at', 'last_used_at'],
      row: ([id, number, name, first, last]) =>
        data.rooms.push({
          id: int(id ?? null),
          number: int(number ?? null),
          name: text(name ?? null),
          firstUsedAt: utcTimestamp(first ?? null),
          lastUsedAt: utcTimestamp(last ?? null),
        }),
    },
    fpp_votes: {
      columns: [
        'id',
        'room_id',
        'avg_estimation',
        'max_estimation',
        'min_estimation',
        'amount_of_estimations',
        'amount_of_spectators',
        'duration',
        'was_auto_flip',
        'voted_at',
      ],
      row: ([id, room, average, highest, lowest, count, spectators, duration, auto, at]) =>
        data.votes.push({
          id: int(id ?? null),
          roomId: int(room ?? null),
          average: int(average ?? null),
          highest: int(highest ?? null),
          lowest: int(lowest ?? null),
          count: int(count ?? null),
          spectators: int(spectators ?? null),
          durationSeconds: int(duration ?? null),
          autoFlip: int(auto ?? null) !== 0,
          votedAt: utcTimestamp(at ?? null),
        }),
    },
    fpp_estimations: {
      columns: ['user_id', 'estimation', 'spectator', 'estimated_at'],
      row: ([user, estimation, spectator, at]) => {
        if (estimation === null || estimation === undefined || int(spectator ?? null) !== 0) {
          data.notVotes += 1
          return
        }
        const day = utcDay(utcTimestamp(at ?? null))
        bump(data.cards, day, String(int(estimation)))
        let voters = data.voters.get(day)
        if (voters === undefined) data.voters.set(day, (voters = new Set()))
        voters.add(text(user ?? null))
      },
    },
    fpp_page_views: {
      columns: ['route', 'viewed_at'],
      row: ([route, at]) =>
        bump(data.pageViews, utcDay(utcTimestamp(at ?? null)), text(route ?? null)),
    },
    fpp_events: {
      columns: ['event', 'event_at'],
      row: ([event, at]) =>
        bump(data.events, utcDay(utcTimestamp(at ?? null)), text(event ?? null)),
    },
  })
  Object.assign(data.read, summary.rows)
  return data
}
