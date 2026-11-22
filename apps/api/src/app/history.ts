/**
 * A room's stored history as the result contract (docs/v9/ARCHITECTURE.md, Built for what comes next): each round and
 * each decided topic is assembled by room-core's builders from the counts stored with it, and the summary is
 * computed from that. Nothing here names a participant or a seat: a round holds counts per card, and the votes are
 * never read.
 */
import { buildDecidedFromCounts, buildRevealedFromCounts } from '@fpp/room-core/server'
import {
  BUILT_IN_DECK_IDS,
  parseTopicRef,
  type DeckId,
  type ResultCount,
  type Slug,
  type TopicId,
  type RoundId,
} from '@fpp/room-core/types'
import type { RoundRow, TopicHistory } from '../db/rounds.ts'
import type {
  Figures,
  HistoryRound,
  HistoryTopic,
  SummaryBody,
  SummaryTopic,
  TopicsBody,
  V1Summary,
} from '../http/history.ts'

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === 'object' && input !== null && !Array.isArray(input)

const isNumber = (input: unknown): input is number =>
  typeof input === 'number' && Number.isFinite(input)

/** The stored distribution: the counts the builder produced; an entry that is not one is dropped. */
function countsOf(input: unknown): ResultCount[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((entry: unknown) =>
    isRecord(entry) &&
    typeof entry['label'] === 'string' &&
    isNumber(entry['count']) &&
    (entry['value'] === null || isNumber(entry['value']))
      ? [{ label: entry['label'], value: entry['value'], count: entry['count'] }]
      : [],
  )
}

const deckOf = (input: unknown): DeckId => {
  const id = isRecord(input) ? input['id'] : undefined
  return BUILT_IN_DECK_IDS.find((known) => known === id) ?? 'custom'
}

/** What v1 kept of a round it played, stored by the importer in `round.summary`. */
function summaryOf(input: unknown): V1Summary | undefined {
  if (!isRecord(input)) return undefined
  const { average, lowest, highest, count } = input
  return isNumber(average) && isNumber(lowest) && isNumber(highest) && isNumber(count)
    ? { average, lowest, highest, count }
    : undefined
}

const hundredths = (value: number) => Math.round(value * 100) / 100

/** Lowest, highest and mean of the numeric cards played; null when no card had a number. */
function figuresOf(counts: readonly ResultCount[]): Figures | null {
  const numeric = counts.filter(
    (entry): entry is ResultCount & { value: number } => entry.value !== null,
  )
  const voters = numeric.reduce((sum, entry) => sum + entry.count, 0)
  if (voters === 0) return null
  const values = numeric.map((entry) => entry.value)
  const total = numeric.reduce((sum, entry) => sum + entry.value * entry.count, 0)
  return {
    lowest: Math.min(...values),
    highest: Math.max(...values),
    average: hundredths(total / voters),
  }
}

type Room = { readonly slug: Slug; readonly name: string }

function roundOf(row: RoundRow, topic: HistoryTopic, room: Room): HistoryRound {
  const summary = summaryOf(row.summary)
  const counts = countsOf(row.distribution)
  const built = buildRevealedFromCounts({
    id: row.id,
    at: row.revealedAt.getTime(),
    room,
    topic: topicInput(topic),
    round: {
      id: row.id as RoundId,
      no: row.no,
      attempt: row.attempt,
      deck: deckOf(row.deck),
      distribution: counts,
    },
  })
  // A round imported from v1 has no distribution: its voters and its consensus are what v1 kept.
  const result =
    summary === undefined
      ? built
      : { ...built, round: { ...built.round, voters: summary.count, consensus: row.consensus } }
  return {
    result,
    startedAt: row.startedAt.toISOString(),
    spectators: row.spectators,
    autoReveal: row.autoReveal,
    figures:
      summary === undefined
        ? figuresOf(counts)
        : {
            lowest: summary.lowest,
            highest: summary.highest,
            average: hundredths(summary.average),
          },
    ...(summary === undefined ? {} : { summary }),
  }
}

const topicInput = (topic: HistoryTopic) => ({
  id: topic.id as TopicId,
  title: topic.title,
  url: topic.url,
  ref:
    parseTopicRef({
      source: topic.source,
      id: topic.externalId,
      key: topic.externalKey,
      site: topic.externalSite,
    }) ?? null,
})

function topicOf(row: TopicHistory, room: Room): HistoryTopic {
  const base = {
    id: row.id as TopicId,
    title: row.title === '' ? null : row.title,
    url: row.url,
    source: row.source as HistoryTopic['source'],
    externalId: row.externalId,
    externalKey: row.externalKey,
    externalSite: row.externalSite,
    position: row.position,
    state: row.state,
  }
  const topic: HistoryTopic = { ...base, decided: null, rounds: [] }
  const rounds = row.rounds.map((entry) => roundOf(entry, topic, room))
  const latest = row.rounds.at(-1)
  const { finalLabel, finalValue, decidedBy, decidedAt } = row
  const decided =
    latest === undefined ||
    finalLabel === null ||
    finalValue === null ||
    decidedAt === null ||
    (decidedBy !== 'agreed' && decidedBy !== 'settled')
      ? null
      : buildDecidedFromCounts({
          // The id of the decision is the topic's: a topic is decided once, and the live event's id is not stored.
          id: row.id,
          at: decidedAt.getTime(),
          room,
          topic: topicInput(topic),
          round: {
            id: latest.id as RoundId,
            no: latest.no,
            attempt: latest.attempt,
            deck: deckOf(latest.deck),
            distribution: countsOf(latest.distribution),
          },
          final: { label: finalLabel, value: finalValue, decidedBy },
        })
  return { ...base, decided, rounds }
}

export function topicsBody(input: {
  readonly room: Room
  readonly topics: readonly TopicHistory[]
}) {
  return {
    room: { slug: input.room.slug, name: input.room.name },
    topics: input.topics.map((row) => topicOf(row, input.room)),
  } satisfies TopicsBody
}

/** The most played card of a round; on a tie the first of the cards that are estimates, else the first. */
function leadingOf(counts: readonly ResultCount[]): ResultCount | null {
  const top = Math.max(0, ...counts.map((entry) => entry.count))
  const tied = counts.filter((entry) => entry.count === top && top > 0)
  return tied.find((entry) => entry.value !== null) ?? tied[0] ?? null
}

const seconds = (round: HistoryRound) =>
  Math.max(0, Date.parse(round.result.at) - Date.parse(round.startedAt)) / 1000

export function summaryBody(body: TopicsBody): SummaryBody {
  const topics = body.topics.map((topic): SummaryTopic => {
    const latest = topic.rounds.at(-1)
    const figures = latest?.figures ?? null
    return {
      id: topic.id,
      position: topic.position,
      title: topic.title,
      url: topic.url,
      state: topic.state,
      final: topic.decided?.final ?? null,
      open: topic.decided === null,
      leading: latest === undefined ? null : leadingOf(latest.result.round.distribution),
      spread: figures === null ? null : { lowest: figures.lowest, highest: figures.highest },
      rounds: topic.rounds.length,
      durationSeconds: Math.round(topic.rounds.reduce((sum, round) => sum + seconds(round), 0)),
    }
  })
  return {
    room: body.room,
    topics,
    totals: {
      topics: topics.length,
      decided: topics.filter((topic) => !topic.open).length,
      rounds: topics.reduce((sum, topic) => sum + topic.rounds, 0),
      durationSeconds: topics.reduce((sum, topic) => sum + topic.durationSeconds, 0),
      points: topics.reduce((sum, topic) => sum + (topic.final?.value ?? 0), 0),
    },
  }
}
