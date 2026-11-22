/**
 * What the room tells Umami (docs/v9/ARCHITECTURE.md, Measurement; rule telemetry.md): a round is played in two apps with
 * marker strings as display names, slug, access code, topic title and every vote value, and every `umami.track` call is
 * held against the registry: a known event, exactly its properties, each a boolean or a value of its closed list, and
 * no marker anywhere in it.
 */
import { afterAll, beforeAll, beforeEach, expect, test } from 'bun:test'
import { registerDom, unregisterDom } from './dom.ts'

registerDom()
const { createWorld, openSeat } = await import('./harness.tsx')
const { UMAMI } = await import('@fpp/telemetry/umami')

const SLUG = 'marker-room-slug'
const CODE = 'marker code'
const NAMES = ['MarkerAnn', 'MarkerBen']
const TOPIC = 'MarkerTopic'
const VOTES = ['3', '8']
const MARKERS = [
  SLUG,
  CODE,
  encodeURIComponent(CODE),
  TOPIC,
  ...NAMES,
  ...VOTES.map((vote) => `"${vote}"`),
]

type Call = readonly [event: string, data: Record<string, unknown>]
const calls: Call[] = []
const host = globalThis as { umami?: unknown }

beforeAll(registerDom)
afterAll(unregisterDom)
beforeEach(() => {
  calls.length = 0
  host.umami = {
    track: (event: string, data: Record<string, unknown>) => calls.push([event, data]),
  }
})

/** Every call is an event of the registry with exactly its properties, each a boolean or a value of its list. */
function expectRegistered(): void {
  for (const [event, data] of calls) {
    expect(Object.keys(UMAMI)).toContain(event)
    const properties = UMAMI[event as keyof typeof UMAMI] as Record<string, unknown>
    expect(Object.keys(data).toSorted()).toEqual(Object.keys(properties).toSorted())
    for (const [name, value] of Object.entries(data)) {
      const allowed = properties[name]
      if (allowed === 'boolean') expect(typeof value).toBe('boolean')
      else expect(allowed as readonly unknown[]).toContain(value)
    }
  }
}

const created = async () => ({ status: 201, json: async () => ({ slug: SLUG }) })

test('a created, joined, voted, revealed and decided room sends the funnel and no marker', async () => {
  const world = createWorld({ slug: SLUG, code: CODE })
  const options = { hash: encodeURIComponent(CODE) }
  const ann = await openSeat(world, {
    path: '/room/new',
    ip: '10.1.0.1',
    profile: NAMES[0]!,
    fetch: created,
    ...options,
  })
  const ben = await openSeat(world, {
    path: `/room/${SLUG}`,
    ip: '10.1.0.2',
    profile: NAMES[1]!,
    ...options,
  })
  await ann.type(ann.byId('topic-paste'), TOPIC)
  await ann.submit(ann.byId('topic-add'))

  const card = (seat: typeof ann, label: string) =>
    seat.allById('card').find((element) => element.dataset['card'] === label)!
  await ann.click(card(ann, VOTES[0]!))
  await ann.click(card(ann, '5'))
  await ben.click(card(ben, VOTES[1]!))
  await ann.click(ann.byId('reveal'))
  await ann.click(
    ann.allById('final-value').find((element) => element.dataset['card'] === VOTES[0])!,
  )

  expect(calls).toEqual([
    ['room_created', { activity: 'poker' }],
    ['room_joined', { activity: 'poker', seats: '1' }],
    ['room_joined', { activity: 'poker', seats: '2-4' }],
    ['vote_cast', { activity: 'poker' }],
    ['vote_cast', { activity: 'poker' }],
    ['round_revealed', { activity: 'poker', votes: '2-4', consensus: false }],
    ['topic_decided', { activity: 'poker', how: 'settled' }],
  ])
  expectRegistered()
  const sent = JSON.stringify(calls)
  for (const marker of MARKERS) expect(sent).not.toContain(marker)
  await ann.unmount()
  await ben.unmount()
})

test('a unanimous reveal sends the reveal and the decision', async () => {
  const world = createWorld({ slug: SLUG })
  const ann = await openSeat(world, { path: `/room/${SLUG}`, ip: '10.1.0.3', profile: NAMES[0]! })
  const ben = await openSeat(world, { path: `/room/${SLUG}`, ip: '10.1.0.4', profile: NAMES[1]! })
  const card = (seat: typeof ann) =>
    seat.allById('card').find((element) => element.dataset['card'] === '5')!
  await ann.click(card(ann))
  await ben.click(card(ben))
  await ann.click(ann.byId('reveal'))

  expect(calls.map(([event, data]) => [event, data['how'] ?? data['consensus']])).toEqual([
    ['room_joined', undefined],
    ['room_joined', undefined],
    ['vote_cast', undefined],
    ['vote_cast', undefined],
    ['round_revealed', true],
    ['topic_decided', 'unanimous'],
  ])
  expectRegistered()
  await ann.unmount()
  await ben.unmount()
})

test('without the Umami script nothing is sent and nothing breaks', async () => {
  delete host.umami
  const world = createWorld({ slug: SLUG })
  const ann = await openSeat(world, { path: `/room/${SLUG}`, ip: '10.1.0.5', profile: NAMES[0]! })
  await ann.click(ann.allById('card')[0]!)
  expect(ann.byId('status').dataset['status']).toBe('live')
  expect(calls).toEqual([])
  await ann.unmount()
})
