/**
 * The plain room end to end in a DOM (docs/v9/ARCHITECTURE.md, Testing): two seats of the real runtime in two apps,
 * one vote each, a reveal, and the language switched in place. The test ids are the ones of e2e/TESTIDS.md.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { registerDom, unregisterDom } from './dom.ts'

// React decides what the page supports when it loads, so the app (and its harness) load after the DOM is there.
registerDom()
const { ADDRESS, createWorld, openSeat } = await import('./harness.tsx')
const { UMAMI } = await import('@fpp/telemetry/umami')

const created = async () => ({ status: 201, json: async () => ({ slug: ADDRESS }) })
const refused = async () => ({ status: 400, json: async () => ({}) })
const tooLong = async () => ({ status: 422, json: async () => ({}) })
const saved = async () => ({ status: 200, json: async () => ({}) })

beforeAll(registerDom)
afterAll(unregisterDom)

test('two seats join by link, vote, and see every value only after the reveal', async () => {
  const world = createWorld()
  const ann = await openSeat(world, { path: `/room/${ADDRESS}`, ip: '10.0.0.1' })
  // A device without a name asks for one first.
  await ann.type(ann.byId('name-input'), 'Ann')
  await ann.submit(ann.byId('join-room'))
  expect(ann.byId('status').dataset['status']).toBe('live')

  const ben = await openSeat(world, { path: `/room/${ADDRESS}`, ip: '10.0.0.2', profile: 'Ben' })
  expect(ben.byId('status').dataset['status']).toBe('live')
  expect(
    ann.allById('seat').map((seat) => seat.querySelector('[data-testid="seat-name"]')?.textContent),
  ).toEqual(['Ann', 'Ben'])

  await ann.click(ann.allById('card').find((card) => card.dataset['card'] === '5')!)
  await ben.click(ben.allById('card').find((card) => card.dataset['card'] === '8')!)
  const votes = (seat: typeof ann) => seat.allById('seat-vote').map((vote) => vote.textContent)
  // Before the reveal each seat knows who voted and nothing else: no value on the other seat's page.
  expect(votes(ben)).toEqual(['voted', 'voted'])
  expect(ben.byId('round').dataset['state']).toBe('voting')

  await ann.click(ann.byId('reveal'))
  expect(ann.byId('round').dataset['state']).toBe('revealed')
  expect(votes(ann)).toEqual(['5', '8'])
  expect(votes(ben)).toEqual(['5', '8'])
  expect(ben.allById('result-card').map((card) => card.dataset['card'])).toEqual(['5', '8'])

  await ann.click(ann.allById('final-value').find((card) => card.dataset['card'] === '5')!)
  expect(ben.byId('final-value-result').dataset['card']).toBe('5')
  await ann.unmount()
  await ben.unmount()
})

test('the language switches in place, English to German and back, and is remembered', async () => {
  const world = createWorld()
  const ann = await openSeat(world, { path: '/room', ip: '10.0.0.3' })
  const button = ann.byId('start')
  expect(button.textContent).toBe('Start planning')
  expect(document.documentElement.lang).toBe('en')

  await ann.choose(ann.byId('language'), 'de')
  // The same element, now in German: no reload, no new page.
  expect(ann.byId('start')).toBe(button)
  expect(button.textContent).toBe('Planung starten')
  expect(document.documentElement.lang).toBe('de')
  expect(ann.env.store.prefs.get().language).toBe('de')

  await ann.choose(ann.byId('language'), 'en')
  expect(button.textContent).toBe('Start planning')
  await ann.unmount()
})

test('an invite link carries the password in its fragment; without it the room asks once', async () => {
  const world = createWorld({ code: 'blue sky' })
  const ann = await openSeat(world, {
    path: `/room/${ADDRESS}`,
    ip: '10.0.0.4',
    profile: 'Ann',
    hash: encodeURIComponent('blue sky'),
  })
  expect(ann.byId('status').dataset['status']).toBe('live')
  expect((ann.byId('invite-link') as HTMLInputElement).value).toBe(
    `http://test.local/room/${ADDRESS}#blue%20sky`,
  )
  expect(ann.byId('access-code').textContent).toBe('blue sky')

  const ben = await openSeat(world, { path: `/room/${ADDRESS}`, ip: '10.0.0.5', profile: 'Ben' })
  expect(ben.byId('status').dataset['status']).toBe('locked')
  await ben.type(ben.byId('code-input'), 'nope')
  await ben.submit(ben.byId('code-submit'))
  expect(ben.byId('code-refused')).toBeDefined()
  await ben.type(ben.byId('code-input'), 'Blue Sky')
  await ben.submit(ben.byId('code-submit'))
  expect(ben.byId('status').dataset['status']).toBe('live')
  await ann.unmount()
  await ben.unmount()
})

test('a new room is created through the API, and its address replaces /room/new', async () => {
  const world = createWorld()
  const ann = await openSeat(world, { path: '/room/new', ip: '10.0.0.6', fetch: created })
  expect(ann.requests).toEqual([
    {
      url: 'http://test.local/api/rooms',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {},
    },
  ])
  // The room's page asks a device without a name for one.
  expect(ann.byId('name-input')).toBeDefined()
  await ann.unmount()
})

test('locking and booking a name go to the API with the seat secret', async () => {
  const world = createWorld()
  const ann = await openSeat(world, {
    path: `/room/${ADDRESS}`,
    ip: '10.0.0.7',
    profile: 'Ann',
    fetch: saved,
  })
  await ann.click(ann.byId('lock-generated'))
  await ann.type(ann.byId('book-name'), 'team-alpha')
  await ann.submit(ann.byId('book-name-submit'))
  await ann.type(ann.byId('lock-code'), 'blue sky')
  await ann.submit(ann.byId('lock-typed'))
  const token = ann.env.store.seat.get(ADDRESS)
  expect(token).not.toBeNull()
  expect(ann.requests.map(({ url, method, body }) => ({ url, method, body }))).toEqual([
    {
      url: `http://test.local/api/rooms/${ADDRESS}/access`,
      method: 'PUT',
      body: { access: 'locked', signOut: false },
    },
    {
      url: `http://test.local/api/rooms/${ADDRESS}/name`,
      method: 'PUT',
      body: { name: 'team-alpha' },
    },
    {
      url: `http://test.local/api/rooms/${ADDRESS}/access`,
      method: 'PUT',
      body: { access: 'locked', signOut: false, code: 'blue sky' },
    },
  ])
  expect(
    ann.requests.every((request) => request.headers['authorization'] === `Bearer ${token}`),
  ).toBe(true)
  expect(ann.byId('access-outcome').dataset['outcome']).toBe('saved')
  await ann.unmount()
})

test('topics are pasted, renamed, moved and removed; a seat becomes a spectator and another is removed', async () => {
  const world = createWorld()
  const ann = await openSeat(world, { path: `/room/${ADDRESS}`, ip: '10.0.0.8', profile: 'Ann' })
  const ben = await openSeat(world, { path: `/room/${ADDRESS}`, ip: '10.0.0.9', profile: 'Ben' })
  const names = () => ann.allById('topic-name').map((name) => name.textContent)

  await ann.type(ann.byId('topic-paste'), 'Login page\nSearch\nExport')
  await ann.submit(ann.byId('topic-add'))
  expect(names()).toEqual(['Untitled topic', 'Login page', 'Search', 'Export'])
  await ann.click(ann.allById('topic-down')[1]!)
  expect(names()).toEqual(['Untitled topic', 'Search', 'Login page', 'Export'])
  await ann.type(ann.allById('topic-title')[3]!, 'Export to CSV')
  await ann.click(ann.allById('topic-rename')[3]!)
  await ann.click(ann.allById('topic-remove')[1]!)
  expect(names()).toEqual(['Untitled topic', 'Login page', 'Export to CSV'])
  expect(ben.allById('topic-name').map((name) => name.textContent)).toEqual(names())

  await ann.click(ann.byId('next-topic'))
  expect(ann.byId('round-topic').textContent).toBe('Login page')

  await ben.click(ben.byId('role-toggle'))
  expect(ann.allById('seat-role').map((role) => role.textContent)).toEqual(['player', 'spectator'])
  expect(ben.maybeById('card')).toBeNull()
  await ann.click(ann.byId('kick'))
  expect(ben.byId('status').dataset['status']).toBe('kicked')
  await ann.unmount()
  await ben.unmount()
})

test('a refused password and a refused name say different things; an unknown page offers the way back', async () => {
  const world = createWorld()
  const ann = await openSeat(world, {
    path: `/room/${ADDRESS}`,
    ip: '10.0.0.10',
    profile: 'Ann',
    fetch: refused,
  })
  await ann.type(ann.byId('lock-code'), 'a')
  await ann.submit(ann.byId('lock-typed'))
  expect(ann.byId('access-outcome').dataset['outcome']).toBe('invalid-code')
  await ann.type(ann.byId('book-name'), 'x y')
  await ann.submit(ann.byId('book-name-submit'))
  expect(ann.byId('access-outcome').dataset['outcome']).toBe('invalid-name')
  await ann.navigate('/room/a/b/c')
  expect(ann.byId('back-to-rooms')).toBeDefined()
  expect(document.title).toBe('This page does not exist')
  await ann.unmount()
})

test('every page sets its tab title from a message', async () => {
  const world = createWorld()
  const ann = await openSeat(world, { path: '/room', ip: '10.0.0.11', profile: 'Ann' })
  expect(document.title).toBe('Free Planning Poker')
  await ann.choose(ann.byId('language'), 'de')
  await ann.navigate('/room')
  expect(document.title).toBe('Free Planning Poker')
  await ann.choose(ann.byId('language'), 'en')
  const pending = new Promise<never>(() => {})
  const waiting = await openSeat(world, {
    path: '/room/new',
    ip: '10.0.0.12',
    fetch: () => pending,
  })
  expect(document.title).toBe('Creating your room…')
  await waiting.unmount()
  const room = await openSeat(world, { path: `/room/${ADDRESS}`, ip: '10.0.0.13', profile: 'Ben' })
  expect(document.title).toBe('Test room')
  await room.unmount()
  await ann.unmount()
})

test('a value the route rejects for its length is the same answer as one the rule rejects', async () => {
  const world = createWorld()
  const ann = await openSeat(world, {
    path: `/room/${ADDRESS}`,
    ip: '10.0.0.14',
    profile: 'Ann',
    fetch: tooLong,
  })
  await ann.type(ann.byId('lock-code'), 'x'.repeat(300))
  await ann.submit(ann.byId('lock-typed'))
  expect(ann.byId('access-outcome').dataset['outcome']).toBe('invalid-code')
  await ann.unmount()
})

describe('what the room tells Umami (docs/v9/ARCHITECTURE.md, Measurement; rule telemetry.md)', () => {
  // A round is played in two apps with marker strings as display names, slug, access code, topic title and every vote
  // value; every `umami.track` call is held against the registry: a known event, exactly its properties, each a boolean
  // or a value of its closed list, and no marker anywhere in it.
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
  /** The simulated time of each call, from the clock of the world a test sets in `now`. */
  const times: number[] = []
  let now: (() => number) | null = null
  const host = globalThis as { umami?: unknown }

  beforeEach(() => {
    calls.length = 0
    times.length = 0
    now = null
    host.umami = {
      track: (event: string, data: Record<string, unknown>) => {
        calls.push([event, data])
        times.push(now?.() ?? 0)
      },
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

  const createdRoom = async () => ({ status: 201, json: async () => ({ slug: SLUG }) })

  test('a created, joined, voted, revealed and decided room sends the funnel and no marker', async () => {
    const world = createWorld({ slug: SLUG, code: CODE })
    const options = { hash: encodeURIComponent(CODE) }
    const ann = await openSeat(world, {
      path: '/room/new',
      ip: '10.1.0.1',
      profile: NAMES[0]!,
      fetch: createdRoom,
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

  test('a unanimous reveal sends the reveal and, later, the decision', async () => {
    const world = createWorld({ slug: SLUG })
    now = world.clock.now
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
    // Sent in the same tick the two reach Umami in either order, and the funnel reads them in order.
    expect(times.at(-1)! - times.at(-2)!).toBeGreaterThanOrEqual(300)
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
})
