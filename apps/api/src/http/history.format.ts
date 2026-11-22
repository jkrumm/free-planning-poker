/**
 * CSV and Markdown for the history routes. CSV follows RFC 4180 (CRLF lines, a field quoted when it holds a comma, a
 * quote or a line break, a quote doubled) and neutralises a text cell a spreadsheet would run as a formula: one that
 * starts with =, +, - or @, or with a tab or a carriage return, gets a leading apostrophe. Numbers are never changed.
 */
import type { SummaryBody, SummaryTopic, TopicsBody } from './history.ts'

const FORMULA_START = /^[=+\-@\t\r]/

type Cell = string | number | boolean | null

/** A text cell as a spreadsheet may read it: never a formula. */
const safe = (text: string) => (FORMULA_START.test(text) ? `'${text}` : text)

function field(cell: Cell): string {
  if (cell === null) return ''
  const text = typeof cell === 'string' ? safe(cell) : String(cell)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const csv = (header: readonly string[], rows: readonly (readonly Cell[])[]) =>
  [header, ...rows].map((row) => row.map(field).join(',')).join('\r\n') + '\r\n'

/** The columns of `GET /rooms/:slug/topics?format=csv`, one line per round, in this order. */
export const TOPICS_CSV_COLUMNS = [
  'topic_id',
  'topic_title',
  'topic_url',
  'topic_source',
  'topic_external_id',
  'topic_external_key',
  'topic_external_site',
  'topic_state',
  'final_label',
  'final_value',
  'decided_by',
  'round_id',
  'round_no',
  'attempt',
  'deck',
  'started_at',
  'revealed_at',
  'voters',
  'spectators',
  'consensus',
  'auto_reveal',
  'lowest',
  'highest',
  'average',
  'distribution',
] as const

export function csvOfTopics(body: TopicsBody): string {
  return csv(
    TOPICS_CSV_COLUMNS,
    body.topics.flatMap((topic) =>
      topic.rounds.map((round): Cell[] => [
        topic.id,
        topic.title,
        topic.url,
        topic.source,
        topic.externalId,
        topic.externalKey,
        topic.externalSite,
        topic.state,
        topic.decided?.final.label ?? null,
        topic.decided?.final.value ?? null,
        topic.decided?.final.decidedBy ?? null,
        round.result.round.id,
        round.result.round.no,
        round.result.round.attempt,
        round.result.round.deck,
        round.startedAt,
        round.result.at,
        round.result.round.voters,
        round.spectators,
        round.result.round.consensus,
        round.autoReveal,
        round.figures?.lowest ?? null,
        round.figures?.highest ?? null,
        round.figures?.average ?? null,
        // JSON in one cell: a card label may hold any character a separator would use.
        JSON.stringify(round.result.round.distribution),
      ]),
    ),
  )
}

/** The columns of `GET /rooms/:slug/summary?format=csv`, one line per topic. */
export const SUMMARY_CSV_COLUMNS = [
  'topic_id',
  'topic_title',
  'topic_url',
  'topic_state',
  'final_label',
  'final_value',
  'decided_by',
  'open',
  'leading_label',
  'leading_value',
  'leading_count',
  'lowest',
  'highest',
  'rounds',
  'duration_seconds',
] as const

export function csvOfSummary(body: SummaryBody): string {
  return csv(
    SUMMARY_CSV_COLUMNS,
    body.topics.map((topic): Cell[] => [
      topic.id,
      topic.title,
      topic.url,
      topic.state,
      topic.final?.label ?? null,
      topic.final?.value ?? null,
      topic.final?.decidedBy ?? null,
      topic.open,
      topic.leading?.label ?? null,
      topic.leading?.value ?? null,
      topic.leading?.count ?? null,
      topic.spread?.lowest ?? null,
      topic.spread?.highest ?? null,
      topic.rounds,
      topic.durationSeconds,
    ]),
  )
}

const cell = (text: string) => text.replace(/[\\|]/g, '\\$&').replace(/\s*[\r\n]+\s*/g, ' ')

const table = (header: readonly string[], rows: readonly (readonly string[])[]) =>
  [header, header.map(() => '-'), ...rows]
    .map((row) => `| ${row.map(cell).join(' | ')} |`)
    .join('\n') + '\n'

const titleOf = (topic: { title: string | null; url: string | null }) =>
  topic.title ?? topic.url ?? '(untitled)'

const clock = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds}s`
}

const finalOf = (topic: SummaryTopic) => {
  if (topic.final !== null) return topic.final.label
  return topic.leading === null ? 'open' : `${topic.leading.label} (open)`
}

const spreadOf = (topic: SummaryTopic) => {
  if (topic.spread === null) return '–'
  const { lowest, highest } = topic.spread
  return lowest === highest ? String(lowest) : `${lowest}–${highest}`
}

/** One table, one line per topic and a last line with the totals; it pastes into a ticket or a document. */
export function markdownOfSummary(body: SummaryBody): string {
  const { totals } = body
  return table(
    ['Topic', 'Final', 'Spread', 'Rounds', 'Duration'],
    [
      ...body.topics.map((topic) => [
        titleOf(topic),
        finalOf(topic),
        spreadOf(topic),
        String(topic.rounds),
        clock(topic.durationSeconds),
      ]),
      [
        `Total: ${totals.decided} of ${totals.topics} decided`,
        String(totals.points),
        '',
        String(totals.rounds),
        clock(totals.durationSeconds),
      ],
    ],
  )
}

/** One table, one line per round. */
export function markdownOfTopics(body: TopicsBody): string {
  return table(
    ['Topic', 'Round', 'Attempt', 'Deck', 'Revealed at', 'Voters', 'Consensus', 'Distribution'],
    body.topics.flatMap((topic) =>
      topic.rounds.map((round) => [
        titleOf(topic),
        String(round.result.round.no),
        String(round.result.round.attempt),
        round.result.round.deck,
        round.result.at,
        String(round.result.round.voters),
        round.result.round.consensus ? 'yes' : 'no',
        round.result.round.distribution.map((entry) => `${entry.label}×${entry.count}`).join(', '),
      ]),
    ),
  )
}
