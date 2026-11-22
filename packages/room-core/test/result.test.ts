import { describe, expect, test } from 'bun:test'
import { DECKS, findCard } from '../src/decks.ts'
import { buildDecidedResult, buildRevealedResult, type ResultInput } from '../src/result.ts'
import { parseSlug, parseTopicRef } from '../src/values.ts'

const deck = DECKS.fibonacci
const card = (label: string) => findCard(deck, label)!

const input: ResultInput = {
  id: '019a9c1e-0000-7000-8000-000000000001',
  at: Date.UTC(2026, 10, 19, 10, 12, 3),
  room: { slug: parseSlug('team-alpha')!, name: 'Team Alpha' },
  topic: {
    id: '019a9c1e-0000-7000-8000-000000000002',
    title: 'Checkout redesign',
    url: 'https://acme.atlassian.net/browse/SHOP-123',
    ref: parseTopicRef({
      source: 'jira',
      id: '10042',
      key: 'SHOP-123',
      site: 'acme.atlassian.net',
    })!,
  },
  round: {
    id: '019a9c1e-0000-7000-8000-000000000003',
    no: 14,
    attempt: 2,
    deck,
    votes: ['5', '8', '5', '?', '5'].map((label) => ({ card: card(label) })),
  },
}

const one = (labels: string[]) =>
  buildRevealedResult({
    ...input,
    round: { ...input.round, votes: labels.map((l) => ({ card: card(l) })) },
  }).round.consensus

describe('the result contract', () => {
  test('poker.revealed has the shape of ARCHITECTURE.md, Built for what comes next', () => {
    expect(buildRevealedResult(input)).toEqual({
      type: 'poker.revealed',
      v: 1,
      id: input.id,
      at: '2026-11-19T10:12:03.000Z',
      room: { slug: 'team-alpha' as never, name: 'Team Alpha' },
      topic: {
        id: input.topic.id,
        title: 'Checkout redesign',
        url: 'https://acme.atlassian.net/browse/SHOP-123',
        source: 'jira',
        externalId: '10042',
        externalKey: 'SHOP-123',
        externalSite: 'acme.atlassian.net',
      },
      round: {
        id: input.round.id,
        no: 14,
        attempt: 2,
        deck: 'fibonacci',
        voters: 5,
        consensus: false,
        distribution: [
          { label: '5', value: 5, count: 3 },
          { label: '8', value: 8, count: 1 },
          { label: '?', value: null, count: 1 },
        ],
      },
    })
  })

  test('topic.decided is the same with final', () => {
    const final = { label: '5', value: 5, decidedBy: 'settled' as const }
    const { type: _t, ...revealed } = buildRevealedResult(input)
    expect(buildDecidedResult({ ...input, final })).toEqual({
      type: 'topic.decided',
      ...revealed,
      final,
    })
  })

  test('consensus means one card, and an estimate', () => {
    expect(one(['5', '5'])).toBe(true)
    expect(one(['5'])).toBe(true)
    expect(one(['?', '?'])).toBe(false)
    expect(one(['5', '8'])).toBe(false)
  })

  test('hidden cards are not counted', () => {
    const result = buildRevealedResult({
      ...input,
      round: { ...input.round, votes: [{ card: null }, { card: card('3') }] },
    })
    expect(result.round.voters).toBe(1)
  })
})
