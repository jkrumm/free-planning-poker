/**
 * The decks a room estimates with, as data (docs/v9/UX.md, Decks and facilitation). Every card has a label and a
 * number or none; the number is what history and statistics compare, so a T-shirt round and a Fibonacci round land
 * on one scale.
 */

export type Card = {
  readonly label: string
  /** The number behind the label; `null` for a card that is no estimate (abstain, break). */
  readonly value: number | null
}

export type DeckId = 'fibonacci' | 'modified-fibonacci' | 't-shirt' | 'powers-of-two'

export type Deck = {
  readonly id: DeckId
  /** The estimate cards, lowest first. The special cards are not listed: every deck offers them. */
  readonly cards: readonly Card[]
}

/** "I cannot estimate this." */
export const ABSTAIN: Card = { label: '?', value: null }

/** "I need a break." */
export const BREAK: Card = { label: '☕', value: null }

/** Offered in every deck, after its estimate cards. */
export const SPECIAL_CARDS: readonly Card[] = [ABSTAIN, BREAK]

const numbered = (values: readonly number[]): Card[] =>
  values.map((value) => ({ label: String(value), value }))

export const DECKS: Readonly<Record<DeckId, Deck>> = {
  // v1's deck (apps/web/src/constants/fibonacci.constant.ts on the branch v1), the default.
  fibonacci: { id: 'fibonacci', cards: numbered([1, 2, 3, 5, 8, 13, 21]) },
  'modified-fibonacci': {
    id: 'modified-fibonacci',
    cards: [
      { label: '0', value: 0 },
      { label: '½', value: 0.5 },
      ...numbered([1, 2, 3, 5, 8, 13, 20, 40, 100]),
    ],
  },
  // T-shirt sizes stand on the Fibonacci numbers, so their rounds compare with Fibonacci rounds.
  't-shirt': {
    id: 't-shirt',
    cards: [
      { label: 'XS', value: 1 },
      { label: 'S', value: 2 },
      { label: 'M', value: 3 },
      { label: 'L', value: 5 },
      { label: 'XL', value: 8 },
      { label: 'XXL', value: 13 },
    ],
  },
  'powers-of-two': { id: 'powers-of-two', cards: numbered([1, 2, 4, 8, 16, 32, 64]) },
}

export const DEFAULT_DECK_ID: DeckId = 'fibonacci'

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
