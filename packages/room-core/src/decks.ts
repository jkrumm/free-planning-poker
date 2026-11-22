/**
 * The decks a room estimates with, as data (docs/v9/UX.md, Decks and facilitation). Every card has a label and a
 * number or none; the number is what history and statistics compare, so a T-shirt round and a Fibonacci round land
 * on one scale. Card and Deck are value objects: `parseCard` and `parseDeck` are their only constructors, the
 * built-in decks included.
 */
import type { Brand } from './values.ts'

export type Card = Brand<
  {
    readonly label: string
    /** The number behind the label; `null` for a card that is no estimate (abstain, break). */
    readonly value: number | null
  },
  'Card'
>

export const BUILT_IN_DECK_IDS = [
  'fibonacci',
  'modified-fibonacci',
  't-shirt',
  'powers-of-two',
] as const
export type BuiltInDeckId = (typeof BUILT_IN_DECK_IDS)[number]
export type DeckId = BuiltInDeckId | 'custom'

export type Deck = Brand<
  {
    readonly id: DeckId
    /** The estimate cards, lowest first. The special cards are not listed: every deck offers them. */
    readonly cards: readonly Card[]
  },
  'Deck'
>

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === 'object' && input !== null && !Array.isArray(input)

/** A label of 1 to 8 characters and a finite number or `null`. */
export function parseCard(input: unknown): Card | undefined {
  if (!isRecord(input)) return undefined
  const { label, value } = input
  if (typeof label !== 'string' || label.trim() !== label) return undefined
  const length = [...label].length
  if (length < 1 || length > 8) return undefined
  if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) return undefined
  return { label, value } as Card
}

const orThrow = <T>(value: T | undefined, what: string): T => {
  if (value === undefined) throw new Error(`invalid built-in ${what}`)
  return value
}

const builtInCard = (label: string, value: number | null): Card =>
  orThrow(parseCard({ label, value }), `card ${label}`)

/** "I cannot estimate this." */
export const ABSTAIN: Card = builtInCard('?', null)

/** "I need a break." */
export const BREAK: Card = builtInCard('☕', null)

/** Offered in every deck, after its estimate cards. */
export const SPECIAL_CARDS: readonly Card[] = [ABSTAIN, BREAK]

const numbered = (values: readonly number[]) =>
  values.map((value) => ({ label: String(value), value }))

const BUILT_IN_CARDS: Readonly<Record<BuiltInDeckId, readonly { label: string; value: number }[]>> =
  {
    // v1's deck (apps/web/src/constants/fibonacci.constant.ts on the branch v1), the default.
    fibonacci: numbered([1, 2, 3, 5, 8, 13, 21]),
    'modified-fibonacci': [
      { label: '0', value: 0 },
      { label: '½', value: 0.5 },
      ...numbered([1, 2, 3, 5, 8, 13, 20, 40, 100]),
    ],
    // T-shirt sizes stand on the Fibonacci numbers, so their rounds compare with Fibonacci rounds.
    't-shirt': [
      { label: 'XS', value: 1 },
      { label: 'S', value: 2 },
      { label: 'M', value: 3 },
      { label: 'L', value: 5 },
      { label: 'XL', value: 8 },
      { label: 'XXL', value: 13 },
    ],
    'powers-of-two': numbered([1, 2, 4, 8, 16, 32, 64]),
  }

const MAX_CARDS = 20

/**
 * A deck: a built-in one exactly as defined here, or a custom one of 1 to 20 cards, each with a number, unique labels
 * that are not a special card's, ascending.
 */
export function parseDeck(input: unknown): Deck | undefined {
  if (!isRecord(input) || !Array.isArray(input['cards'])) return undefined
  const id = input['id']
  if (id !== 'custom' && !BUILT_IN_DECK_IDS.includes(id as BuiltInDeckId)) return undefined
  const raw: unknown[] = input['cards']
  if (raw.length < 1 || raw.length > MAX_CARDS) return undefined
  const cards: Card[] = []
  for (const entry of raw) {
    const parsed = parseCard(entry)
    if (parsed === undefined || parsed.value === null) return undefined
    if (SPECIAL_CARDS.some((special) => special.label === parsed.label)) return undefined
    if (cards.some((other) => other.label === parsed.label)) return undefined
    const previous = cards.at(-1)
    if (previous !== undefined && previous.value !== null && previous.value >= parsed.value)
      return undefined
    cards.push(parsed)
  }
  if (id !== 'custom') {
    const expected = BUILT_IN_CARDS[id as BuiltInDeckId]
    const same =
      expected.length === cards.length &&
      expected.every((want, i) => want.label === cards[i]?.label && want.value === cards[i]?.value)
    if (!same) return undefined
  }
  return { id: id as DeckId, cards } as unknown as Deck
}

const builtInDeck = (id: BuiltInDeckId): Deck =>
  orThrow(parseDeck({ id, cards: BUILT_IN_CARDS[id] }), `deck ${id}`)

export const DECKS: Readonly<Record<BuiltInDeckId, Deck>> = {
  fibonacci: builtInDeck('fibonacci'),
  'modified-fibonacci': builtInDeck('modified-fibonacci'),
  't-shirt': builtInDeck('t-shirt'),
  'powers-of-two': builtInDeck('powers-of-two'),
}

export const DEFAULT_DECK_ID: BuiltInDeckId = 'fibonacci'

/** The card a label names in this deck, a special card included; `undefined` for a label the deck does not hold. */
export function findCard(deck: Deck, label: string): Card | undefined {
  return (
    deck.cards.find((card) => card.label === label) ??
    SPECIAL_CARDS.find((card) => card.label === label)
  )
}

/**
 * How many positions apart two cards lie in the deck: 3 and 8 in Fibonacci are 2 apart, whatever their numbers.
 * `null` when either label is a special card or not in the deck, because then there is no distance to speak of.
 */
export function distance(deck: Deck, a: string, b: string): number | null {
  const from = deck.cards.findIndex((card) => card.label === a)
  const to = deck.cards.findIndex((card) => card.label === b)
  if (from === -1 || to === -1) return null
  return Math.abs(from - to)
}
