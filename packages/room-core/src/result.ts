/**
 * The result contract (docs/v9/ARCHITECTURE.md, Built for what comes next; invariant 15): one builder for each of
 * `poker.revealed` and `topic.decided`. History, exports, embed messages and webhooks carry what these return and
 * nothing else. A result names no participant and no seat: only counts per card.
 */
import { type Card, type Deck, type DeckId, SPECIAL_CARDS } from './decks.ts'
import type {
  DecidedBy,
  DecidedResult,
  ResultCount,
  ResultTopic,
  RevealedResult,
  RoundId,
  TopicId,
  TopicInput,
} from './protocol/types.ts'
import type { Slug } from './values.ts'

export type ResultInput = {
  /** A new UUID v7, minted once, so a retry carries the same id. */
  readonly id: string
  /** Milliseconds since the epoch. */
  readonly at: number
  readonly room: { readonly slug: Slug; readonly name: string }
  readonly topic: TopicInput & { readonly id: TopicId }
  readonly round: {
    readonly id: RoundId
    readonly no: number
    readonly attempt: number
    readonly deck: Deck
    /** Revealed cards; `null` (a hidden card) is not counted. */
    readonly votes: readonly { readonly card: Card | null }[]
  }
}

function resultTopic(topic: ResultInput['topic']): ResultTopic {
  return {
    id: topic.id,
    title: topic.title,
    url: topic.url,
    source: topic.ref?.source ?? null,
    externalId: topic.ref?.id ?? null,
    externalKey: topic.ref?.key ?? null,
    externalSite: topic.ref?.site ?? null,
  }
}

/** Votes per card in deck order, the special cards after; cards nobody played are left out. */
export function distribution(
  deck: Deck,
  votes: readonly { readonly card: Card | null }[],
): ResultCount[] {
  const order = [...deck.cards, ...SPECIAL_CARDS]
  const counts = new Map<string, ResultCount>()
  for (const { card } of votes) {
    if (card === null) continue
    const seen = counts.get(card.label)
    counts.set(card.label, {
      label: card.label,
      value: card.value,
      count: (seen?.count ?? 0) + 1,
    })
  }
  const rank = (label: string) => {
    const i = order.findIndex((card) => card.label === label)
    return i === -1 ? order.length : i
  }
  return [...counts.values()].toSorted((a, b) => rank(a.label) - rank(b.label))
}

/** Everyone who voted played the same card, and it is an estimate. */
export function isConsensus(counts: readonly ResultCount[]): boolean {
  return counts.length === 1 && counts[0]?.value !== null
}

/** What history stores of a revealed round: the counts the builder produced, not the votes they came from. */
export type StoredResultInput = Omit<ResultInput, 'round'> & {
  readonly round: {
    readonly id: RoundId
    readonly no: number
    readonly attempt: number
    readonly deck: DeckId
    readonly distribution: readonly ResultCount[]
  }
}

/** The result of a round from its stored counts: the one place that assembles the contract's shape. */
export function buildRevealedFromCounts(input: StoredResultInput): RevealedResult {
  const counts = input.round.distribution
  return {
    type: 'poker.revealed',
    v: 1,
    id: input.id,
    at: new Date(input.at).toISOString(),
    room: { slug: input.room.slug, name: input.room.name },
    topic: resultTopic(input.topic),
    round: {
      id: input.round.id,
      no: input.round.no,
      attempt: input.round.attempt,
      deck: input.round.deck,
      voters: counts.reduce((sum, entry) => sum + entry.count, 0),
      consensus: isConsensus(counts),
      distribution: counts,
    },
  }
}

export function buildRevealedResult(input: ResultInput): RevealedResult {
  return buildRevealedFromCounts({
    ...input,
    round: {
      id: input.round.id,
      no: input.round.no,
      attempt: input.round.attempt,
      deck: input.round.deck.id,
      distribution: distribution(input.round.deck, input.round.votes),
    },
  })
}

type Final = {
  readonly label: string
  readonly value: number
  readonly decidedBy: DecidedBy
}

/** A decision from the stored counts of the round that carried it. */
export function buildDecidedFromCounts(
  input: StoredResultInput & { readonly final: Final },
): DecidedResult {
  return withFinal(buildRevealedFromCounts(input), input.final)
}

export function buildDecidedResult(input: ResultInput & { readonly final: Final }): DecidedResult {
  return withFinal(buildRevealedResult(input), input.final)
}

function withFinal(revealed: RevealedResult, final: Final): DecidedResult {
  const { type: _revealed, v, id, at, room, topic, round } = revealed
  return {
    type: 'topic.decided',
    v,
    id,
    at,
    room,
    topic,
    round,
    final: { label: final.label, value: final.value, decidedBy: final.decidedBy },
  }
}
