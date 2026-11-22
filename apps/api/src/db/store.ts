/**
 * The room store on Postgres (docs/v9/ARCHITECTURE.md, Server: Ownership and handoff). A claim takes the room in the
 * same transaction that reads it back; every later write is fenced by the claim's epoch and this process's owner id
 * (invariant 12). Writes are coalesced per room: one in flight, the newest snapshot waiting behind it, so an outage
 * leaves one write per room to retry, not one per event.
 */
import { SettingsSchema } from '@fpp/room-core/protocol'
import {
  DEFAULT_SETTINGS,
  type ColdRoom,
  type Ownership,
  type RoomKey,
  type RoomSnapshot,
  type RoomStore,
} from '@fpp/room-core/server'
import {
  parseAccessCode,
  parseSlug,
  parseTopicRef,
  type RoundId,
  type Topic,
  type TopicId,
} from '@fpp/room-core/types'
import { Effect } from 'effect'
import { primaryAddress } from './addresses.ts'
import { type Database, retryBriefly, retryWhileDown, serialQueue } from './resilience.ts'
import { claimRoom, findRoom, type RoomRow, releaseRoom, writeSnapshot } from './rooms.ts'
import { roundCounters } from './rounds.ts'
import { loadOpenTopics, type TopicRow } from './topics.ts'

export type PostgresStore = RoomStore & {
  /** Resolves when every write handed in so far has ended. */
  readonly idle: () => Promise<void>
  /** Stops retrying: a write still waiting on Postgres is given up. */
  readonly abort: () => void
}

const settingsOf = (stored: unknown) => {
  const parsed = SettingsSchema.safeParse(stored)
  return parsed.success ? parsed.data : DEFAULT_SETTINGS
}

function topicOf(row: TopicRow, latest: ReadonlyMap<string, { id: string }>): Topic {
  const round = latest.get(row.id)
  const decided =
    row.finalLabel !== null &&
    row.finalValue !== null &&
    (row.decidedBy === 'agreed' || row.decidedBy === 'settled') &&
    round !== undefined
  return {
    id: row.id as TopicId,
    title: row.title === '' ? null : row.title,
    url: row.url,
    ref:
      parseTopicRef({
        source: row.source,
        id: row.externalId,
        key: row.externalKey,
        site: row.externalSite,
      }) ?? null,
    state: row.state === 'active' ? 'active' : 'queued',
    final: decided
      ? {
          label: row.finalLabel!,
          value: row.finalValue!,
          decidedBy: row.decidedBy as 'agreed' | 'settled',
          round: round.id as RoundId,
        }
      : null,
  }
}

function coldRoom(args: {
  readonly row: RoomRow
  readonly slug: string
  readonly topics: readonly TopicRow[]
  readonly counters: Awaited<ReturnType<typeof roundCounters>>
}): ColdRoom | null {
  const slug = parseSlug(args.slug)
  if (slug === undefined) return null
  const code = args.row.accessCode === null ? null : (parseAccessCode(args.row.accessCode) ?? null)
  const locked = args.row.access === 'locked' && code !== null
  const topics = args.topics.map((row) => topicOf(row, args.counters.latest))
  const active = topics.find((topic) => topic.state === 'active')
  return {
    slug,
    name: args.row.name,
    access: locked ? 'locked' : 'open',
    code: locked ? code : null,
    settings: settingsOf(args.row.settings),
    accessEpoch: args.row.accessEpoch,
    topics,
    rounds: {
      no: args.counters.no,
      attempt: active === undefined ? 0 : (args.counters.latest.get(active.id)?.attempt ?? 0),
    },
  }
}

export function postgresStore(deps: {
  readonly database: Database
  /** Unique per process: the owner match fences a writer whose epoch the sweep reset. */
  readonly owner: string
  readonly now: () => Date
}): PostgresStore {
  const { database, owner, now } = deps
  const epochs = new Map<RoomKey, number>()
  const queue = serialQueue()
  const pending = new Map<
    RoomKey,
    { snapshot: RoomSnapshot; release: boolean; done: Promise<Ownership> }
  >()
  const stop = new AbortController()

  const persist = (key: RoomKey, snapshot: RoomSnapshot, release: boolean) => {
    const epoch = epochs.get(key)
    if (epoch === undefined) return Effect.succeed<Ownership>('lost')
    const roomId = Number(key)
    return retryWhileDown(
      database.run((db) =>
        db.transaction(async (tx) => {
          const args = { roomId, epoch, owner }
          const ownership = await writeSnapshot(tx, {
            ...args,
            state: snapshot,
            seq: snapshot.seq,
            now: now(),
          })
          if (ownership === 'owned' && release) await releaseRoom(tx, args)
          return ownership
        }),
      ),
    ).pipe(
      Effect.tap((ownership) =>
        Effect.sync(() => {
          if ((ownership === 'lost' || release) && epochs.get(key) === epoch) epochs.delete(key)
        }),
      ),
    )
  }

  /** Hands a snapshot to the room's writer: it joins the write waiting behind the one in flight, if there is one. */
  function enqueue(key: RoomKey, snapshot: RoomSnapshot, release: boolean): Promise<Ownership> {
    const waiting = pending.get(key)
    if (waiting !== undefined) {
      waiting.snapshot = snapshot
      waiting.release ||= release
      return waiting.done
    }
    const entry = { snapshot, release, done: Promise.resolve<Ownership>('lost') }
    entry.done = queue.run(key, () => {
      pending.delete(key)
      return Effect.runPromise(persist(key, entry.snapshot, entry.release), { signal: stop.signal })
    })
    pending.set(key, entry)
    return entry.done
  }

  return {
    claim: async (key) => {
      const roomId = Number(key)
      const found = await Effect.runPromise(
        retryBriefly(
          database.run((db) =>
            db.transaction(async (tx) => {
              const row = await findRoom(tx, roomId)
              const slug = row === null ? null : await primaryAddress(tx, roomId)
              if (row === null || slug === null) return null
              const claim = await claimRoom(tx, { roomId, owner, now: now() })
              const topics = await loadOpenTopics(tx, { roomId })
              const counters = await roundCounters(tx, {
                roomId,
                topicIds: topics.map((topic) => topic.id),
              })
              return { row, slug, claim, topics, counters }
            }),
          ),
        ),
        { signal: stop.signal },
      )
      const room = found === null ? null : coldRoom(found)
      if (found === null || room === null) return { kind: 'missing' }
      epochs.set(key, found.claim.epoch)
      return { kind: 'found', room, snapshot: found.claim.state }
    },
    write: (key, snapshot) => enqueue(key, snapshot, false),
    release: (key, snapshot) => enqueue(key, snapshot, true),
    idle: queue.idle,
    abort: () => stop.abort(),
  }
}
