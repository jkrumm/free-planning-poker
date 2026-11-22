/**
 * History on Postgres (docs/v9/ARCHITECTURE.md, Data model: topics are written through). Each room's writes run in
 * the order the runtime handed them over, one transaction each, retried for as long as Postgres is away; a write that
 * fails for another reason is a bug, rejected to the runtime, which records it once.
 */
import type { History, RoomKey } from '@fpp/room-core/server'
import type { Topic } from '@fpp/room-core/types'
import { Effect } from 'effect'
import { type Database, type DbError, retryWhileDown, serialQueue } from './resilience.ts'
import { type RoomUpdate, updateRoom } from './rooms.ts'
import { insertRound } from './rounds.ts'
import { type QueueTopic, recordDecision, writeQueue } from './topics.ts'
import { hashVisitor, recordEstimatingDay } from './visitors.ts'

export type PostgresHistory = History & {
  readonly idle: () => Promise<void>
  readonly abort: () => void
}

/** The queue key of estimating days, which belong to no room. */
const VISITORS = 'visitors'

/** Rooms whose last written row and queue are remembered, to write only what changed; past it, a room writes whole. */
const REMEMBERED_ROOMS = 10_000

type Written = { row: string; topics: Map<string, string> }

const queueTopic = (topic: Topic, position: number): QueueTopic => ({
  id: topic.id,
  position,
  title: topic.title ?? '',
  url: topic.url,
  source: topic.ref?.source ?? null,
  externalId: topic.ref?.id ?? null,
  externalKey: topic.ref?.key ?? null,
  externalSite: topic.ref?.site ?? null,
  state: topic.state,
})

export function postgresHistory(deps: {
  readonly database: Database
  /** The server secret of the device hash (`VISITOR_KEY`). */
  readonly visitorKey: string
  readonly now: () => Date
}): PostgresHistory {
  const { database, now } = deps
  const queue = serialQueue()
  const written = new Map<RoomKey, Written>()
  const stop = new AbortController()

  const write = (key: string, effect: Effect.Effect<unknown, DbError>): Promise<void> =>
    queue.run(key, () =>
      Effect.runPromise(retryWhileDown(effect).pipe(Effect.asVoid), { signal: stop.signal }),
    )

  return {
    room: (key, entry) => {
      const before = written.get(key)
      const update: RoomUpdate = {
        name: entry.room.name,
        settings: entry.room.settings,
        access: entry.room.access,
        accessCode: entry.room.code,
        accessEpoch: entry.accessEpoch,
      }
      const row = JSON.stringify(update)
      const topics = new Map<string, string>()
      const changed: QueueTopic[] = []
      entry.topics.forEach((topic, position) => {
        const stored = queueTopic(topic, position)
        const text = JSON.stringify(stored)
        topics.set(topic.id, text)
        if (before?.topics.get(topic.id) !== text) changed.push(stored)
      })
      const removed = [...(before?.topics.keys() ?? [])].filter((id) => !topics.has(id))
      const rowChanged = before?.row !== row
      if (!rowChanged && changed.length === 0 && removed.length === 0) return
      if (written.size >= REMEMBERED_ROOMS && before === undefined) written.clear()
      written.set(key, { row, topics })
      const roomId = Number(key)
      return write(
        key,
        database.run((db) =>
          db.transaction(async (tx) => {
            if (rowChanged) await updateRoom(tx, { roomId, row: update, now: now() })
            await writeQueue(tx, { roomId, topics: changed, removed })
          }),
        ),
      ).catch((error: unknown) => {
        // What this room's row holds is no longer known: its next change writes it whole.
        written.delete(key)
        throw error
      })
    },
    round: (key, { result, round }) =>
      write(
        key,
        database.run((db) =>
          insertRound(db, {
            round: {
              id: round.id,
              roomId: Number(key),
              topicId: round.topic,
              no: round.no,
              attempt: round.attempt,
              deck: { id: result.round.deck },
              startedAt: new Date(round.startedAt),
              revealedAt: new Date(round.revealedAt),
              players: round.players,
              spectators: round.spectators,
              distribution: result.round.distribution,
              consensus: result.round.consensus,
              autoReveal: round.autoReveal,
            },
            votes: round.votes.map((vote) => ({
              seat: vote.seat,
              label: vote.label,
              value: vote.value,
            })),
          }),
        ),
      ),
    decision: (key, result) =>
      write(
        key,
        database.run((db) =>
          recordDecision(db, {
            roomId: Number(key),
            topicId: result.topic.id,
            finalLabel: result.final.label,
            finalValue: result.final.value,
            decidedBy: result.final.decidedBy,
            decidedAt: new Date(result.at),
          }),
        ),
      ),
    estimatingDay: ({ day, device }) => {
      const visitor = hashVisitor({ key: deps.visitorKey, deviceId: device })
      return write(
        VISITORS,
        database.run((db) => recordEstimatingDay(db, { day, visitor })),
      )
    },
    idle: queue.idle,
    abort: () => stop.abort(),
  }
}
