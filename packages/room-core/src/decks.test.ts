import { describe, expect, test } from 'bun:test'
import { ABSTAIN, BREAK, DECKS, DEFAULT_DECK_ID, distance, findCard, parseCard } from './decks.ts'

const decks = Object.values(DECKS)

describe('decks', () => {
  test("Fibonacci is the default and is v1's deck", () => {
    expect(DEFAULT_DECK_ID).toBe('fibonacci')
    expect(DECKS.fibonacci.cards.map((card) => card.value)).toEqual([1, 2, 3, 5, 8, 13, 21])
  })

  test('each deck is keyed by its own id', () => {
    for (const [id, deck] of Object.entries(DECKS)) expect<string>(deck.id).toBe(id)
  })

  test.each(decks)(
    '$id: every estimate card has a number, ascending, under a unique label',
    (deck) => {
      const values = deck.cards.map((card) => card.value)
      expect(values.every((value) => typeof value === 'number')).toBe(true)
      expect((values as number[]).toSorted((x, y) => x - y)).toEqual(values as number[])
      expect(new Set(values).size).toBe(values.length)
      expect(new Set(deck.cards.map((card) => card.label)).size).toBe(deck.cards.length)
    },
  )

  test('T-shirt sizes stand on the Fibonacci numbers', () => {
    const fibonacci = new Set(DECKS.fibonacci.cards.map((card) => card.value))
    for (const card of DECKS['t-shirt'].cards) expect(fibonacci.has(card.value)).toBe(true)
    expect(findCard(DECKS['t-shirt'], 'M')).toEqual(parseCard({ label: 'M', value: 3 }))
  })

  test('modified Fibonacci carries a half', () => {
    expect(findCard(DECKS['modified-fibonacci'], '½')?.value).toBe(0.5)
  })

  test.each(decks)('$id: the special cards are offered and carry no number', (deck) => {
    expect(findCard(deck, '?')).toBe(ABSTAIN)
    expect(findCard(deck, '☕')).toBe(BREAK)
    expect(ABSTAIN.value).toBeNull()
    expect(BREAK.value).toBeNull()
  })

  test('a label the deck does not hold finds nothing', () => {
    expect(findCard(DECKS.fibonacci, '4')).toBeUndefined()
    expect(findCard(DECKS.fibonacci, 'XL')).toBeUndefined()
  })
})

describe('distance', () => {
  test('counts positions, not numbers', () => {
    expect(distance(DECKS.fibonacci, '3', '8')).toBe(2)
    expect(distance(DECKS.fibonacci, '1', '21')).toBe(6)
    expect(distance(DECKS['powers-of-two'], '64', '1')).toBe(6)
    expect(distance(DECKS['t-shirt'], 'XS', 'XXL')).toBe(5)
    expect(distance(DECKS['modified-fibonacci'], '0', '½')).toBe(1)
  })

  test('is symmetric and zero for the same card', () => {
    expect(distance(DECKS.fibonacci, '13', '2')).toBe(distance(DECKS.fibonacci, '2', '13'))
    expect(distance(DECKS.fibonacci, '5', '5')).toBe(0)
  })

  test('is null for a special card or a label outside the deck', () => {
    expect(distance(DECKS.fibonacci, '?', '5')).toBeNull()
    expect(distance(DECKS.fibonacci, '5', '☕')).toBeNull()
    expect(distance(DECKS.fibonacci, '5', '4')).toBeNull()
    expect(distance(DECKS.fibonacci, 'M', '5')).toBeNull()
  })
})
