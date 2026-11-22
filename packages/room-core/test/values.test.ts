import { describe, expect, test } from 'bun:test'
import { DECKS, parseCard, parseDeck } from '../src/decks.ts'
import {
  ACCESS_CODE_ALPHABET,
  generateAccessCode,
  parseAccessCode,
  parseSeatIndex,
  parseSlug,
  parseTopicRef,
  sameAccessCode,
} from '../src/values.ts'

describe('Slug', () => {
  test.each(['482913', '48291377', 'team-alpha', 'a1b', 'TEAM-Alpha '])('%s is a slug', (input) => {
    expect(parseSlug(input)).toBe(input.trim().toLowerCase() as never)
  })
  test.each(['48291', '4829137', '123-456', 'ab', 'a'.repeat(31), 'team alpha', 'tëam', 42])(
    '%p is no slug',
    (input) => {
      expect(parseSlug(input)).toBeUndefined()
    },
  )
})

describe('SeatIndex', () => {
  test('a non-negative safe integer', () => {
    expect(parseSeatIndex(0)).toBe(0 as never)
    expect(parseSeatIndex(-1)).toBeUndefined()
    expect(parseSeatIndex(1.5)).toBeUndefined()
    expect(parseSeatIndex('1')).toBeUndefined()
  })
})

describe('AccessCode', () => {
  test('trimmed, 2 to 32 characters, no control characters', () => {
    expect(parseAccessCode('  café au lait ')).toBe('café au lait' as never)
    expect(parseAccessCode('a')).toBeUndefined()
    expect(parseAccessCode('a'.repeat(33))).toBeUndefined()
    expect(parseAccessCode('ab\u0007')).toBeUndefined()
  })
  test('compared after NFKC and case folding', () => {
    expect(sameAccessCode(parseAccessCode('K7M2QX')!, parseAccessCode('k7m2qx')!)).toBe(true)
    expect(sameAccessCode(parseAccessCode('ﬁne')!, parseAccessCode('FINE')!)).toBe(true)
    expect(sameAccessCode(parseAccessCode('abc')!, parseAccessCode('abd')!)).toBe(false)
  })
})

describe('TopicRef', () => {
  test('needs an id or a key, and a known source or none', () => {
    expect(
      parseTopicRef({ source: 'jira', id: null, key: 'A-1', site: 'x.atlassian.net' }),
    ).toBeDefined()
    expect(parseTopicRef({ source: null, id: null, key: null, site: 'x' })).toBeUndefined()
    expect(parseTopicRef({ source: 'trello', id: '1', key: null, site: null })).toBeUndefined()
    expect(parseTopicRef({ source: null, id: '', key: 'A-1', site: null })).toBeUndefined()
  })
})

const card = (label: string, value: number | null) => ({ label, value })

describe('Card and Deck', () => {
  test('a card has a short label and a finite number or none', () => {
    expect(parseCard({ label: '5', value: 5 })).toEqual({ label: '5', value: 5 } as never)
    expect(parseCard({ label: '', value: 5 })).toBeUndefined()
    expect(parseCard({ label: '123456789', value: 5 })).toBeUndefined()
    expect(parseCard({ label: '5', value: Number.NaN })).toBeUndefined()
  })
  test('a built-in deck parses only as defined', () => {
    for (const deck of Object.values(DECKS))
      expect(parseDeck(JSON.parse(JSON.stringify(deck)))).toEqual(deck)
    expect(parseDeck({ id: 'fibonacci', cards: [{ label: '1', value: 1 }] })).toBeUndefined()
  })
  test('a custom deck: ascending numbered cards, unique labels, no special card', () => {
    expect(parseDeck({ id: 'custom', cards: [card('S', 1), card('L', 3)] })).toBeDefined()
    expect(parseDeck({ id: 'custom', cards: [card('L', 3), card('S', 1)] })).toBeUndefined()
    expect(parseDeck({ id: 'custom', cards: [card('S', 1), card('S', 2)] })).toBeUndefined()
    expect(parseDeck({ id: 'custom', cards: [card('?', 1)] })).toBeUndefined()
    expect(parseDeck({ id: 'custom', cards: [card('X', null)] })).toBeUndefined()
    expect(parseDeck({ id: 'custom', cards: [] })).toBeUndefined()
    expect(parseDeck({ id: 'other', cards: [card('S', 1)] })).toBeUndefined()
  })
})

describe('generated AccessCode', () => {
  test('the alphabet holds 31 characters, none of 0, 1, i, l, o', () => {
    expect(new Set(ACCESS_CODE_ALPHABET).size).toBe(31)
    for (const confusable of '01ilo') expect(ACCESS_CODE_ALPHABET).not.toContain(confusable)
  })

  test('six characters of the alphabet, and a byte past the last full cycle is drawn again', () => {
    // 248 and above would favour the first eight characters; they are skipped.
    const batches = [
      [255, 248, 0, 1, 2, 3],
      [30, 31, 0, 0, 0, 0],
    ]
    const code = generateAccessCode(() => new Uint8Array(batches.shift() ?? []))
    expect(String(code)).toBe('2345z2')
    expect(parseAccessCode(code)).toBe(code)
  })
})
