import { afterEach, describe, expect, test } from 'bun:test'
import { track } from '../src/facade.browser.ts'
import { bucketOf, COUNT_BUCKETS, UMAMI, type UmamiEvent } from '../src/umami.ts'

/** A property named like what Umami must never hold: a vote, a display name, a room name or slug, a code, a key. */
const FORBIDDEN =
  /(^|_)(vote|card|value|label|name|display|slug|room|code|password|title|topic|key|token|device|id|user|email)(_|$)/

const EVENTS = [
  'landing_cta',
  'room_created',
  'room_joined',
  'invite_copied',
  'vote_cast',
  'round_revealed',
  'topic_decided',
  'room_locked',
  'summary_exported',
  'pwa_installed',
  'embed_loaded',
]

describe('the registry of Umami events', () => {
  test('it holds the events of Measurement and no other', () => {
    expect(Object.keys(UMAMI).toSorted()).toEqual(EVENTS.toSorted())
  })

  test('no property is named like a vote value, a display name, a slug or an access code', () => {
    for (const [event, properties] of Object.entries(UMAMI))
      for (const property of Object.keys(properties))
        expect({ event, property, forbidden: FORBIDDEN.test(property) }).toEqual({
          event,
          property,
          forbidden: false,
        })
  })

  test('the check itself refuses what it is for', () => {
    for (const name of [
      'vote',
      'display_name',
      'slug',
      'room_slug',
      'access_code',
      'card',
      'topic_title',
    ])
      expect(FORBIDDEN.test(name)).toBe(true)
  })

  test('every property is a boolean or a closed list of short lower-case values: no free string', () => {
    for (const properties of Object.values(UMAMI))
      for (const property of Object.values(properties as Record<string, unknown>)) {
        if (property === 'boolean') continue
        expect(Array.isArray(property)).toBe(true)
        for (const value of property as string[]) expect(value).toMatch(/^[a-z0-9+-]{1,12}$/)
      }
  })

  test('an event inside a room names its activity', () => {
    const inRoom: UmamiEvent[] = [
      'room_created',
      'room_joined',
      'invite_copied',
      'vote_cast',
      'round_revealed',
      'topic_decided',
      'room_locked',
      'summary_exported',
    ]
    for (const event of inRoom) expect(Object.keys(UMAMI[event])).toContain('activity')
  })

  test('a count is a bucket', () => {
    expect([1, 2, 4, 5, 9, 10, 40].map(bucketOf)).toEqual([
      '1',
      '2-4',
      '2-4',
      '5-9',
      '5-9',
      '10+',
      '10+',
    ])
    for (const count of [0, 1, 3, 7, 50]) expect(COUNT_BUCKETS).toContain(bucketOf(count))
  })
})

describe('the browser facade', () => {
  const host = globalThis as { umami?: unknown }
  afterEach(() => {
    delete host.umami
  })

  test('track calls umami.track with the event and its data when the script is present', () => {
    const calls: unknown[][] = []
    host.umami = { track: (...args: unknown[]) => calls.push(args) }
    track('round_revealed', { activity: 'poker', votes: '2-4', consensus: true })
    expect(calls).toEqual([
      ['round_revealed', { activity: 'poker', votes: '2-4', consensus: true }],
    ])
  })

  test('track does nothing without the script, and never throws from it', () => {
    expect(() => track('pwa_installed', {})).not.toThrow()
    host.umami = {
      track: () => {
        throw new Error('blocked')
      },
    }
    expect(() => track('pwa_installed', {})).not.toThrow()
    host.umami = {}
    expect(() => track('landing_cta', { location: 'hero' })).not.toThrow()
  })
})
