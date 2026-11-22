/**
 * What a device remembers (docs/plan.yaml, v9-room-client, acceptance 3): v1's keys adopted once into the new ones,
 * nothing of v1 deleted, every value versioned, the list of rooms kept short.
 */
import { describe, expect, test } from 'bun:test'
import { parseSlug } from '@fpp/room-core/types'
import { createRoomClient, createLocalStore, RECENT_KEEP_MS } from '../src/index.ts'
import { fakeClock, fakeSockets, memoryStorage, portsOf, SLUG } from './support.ts'

const NOW = 1_800_000_000_000
const slugOf = (text: string) => parseSlug(text)!
const V1 = {
  username: 'Ada Lovelace',
  isPlaySound: 'true',
  isNotificationsEnabled: 'false',
  preferCardView: 'true',
  recentRoom: 'team-alpha',
  userId: 'V1StGXR8_Z5jdHi6B-myT',
  // Keys v9 does not read stay as they are, too.
  roomId: '12',
  historicalTableOpen: 'true',
}

const open = (storage = memoryStorage(), random = () => 0.25) =>
  createLocalStore({ storage, now: () => NOW, random })

const json = (storage: ReturnType<typeof memoryStorage>, key: string) =>
  JSON.parse(storage.items.get(key)!) as Record<string, unknown>

describe('adopting v1', () => {
  test('a v1 device yields the new keys, the device id of its userId, and every v1 key stays', () => {
    const storage = memoryStorage(V1)
    const store = open(storage)
    expect(store.profile.get()).toMatchObject({ name: 'Ada Lovelace' })
    expect(store.prefs.get()).toEqual({
      sound: true,
      calm: false,
      view: 'grid',
      theme: 'system',
      language: null,
    })
    expect(store.deviceId()).toBe(V1.userId)
    expect(store.recent.list()).toEqual([
      {
        slug: slugOf('team-alpha'),
        name: null,
        createdAt: null,
        code: null,
        pinned: false,
        visitedAt: NOW,
      },
    ])
    for (const [key, value] of Object.entries(V1)) expect(storage.getItem(key)).toBe(value)
    for (const key of ['profile', 'prefs', 'device', 'recent'])
      expect(json(storage, `fpp:v9:${key}`)['v']).toBe(1)
  })

  test('it happens once: a later change is not overwritten by what v1 still holds', () => {
    const storage = memoryStorage(V1)
    open(storage).profile.set({ name: 'Grace', avatar: 'g' })
    open(storage).prefs.set({
      sound: false,
      calm: true,
      view: 'table',
      theme: 'dark',
      language: 'de',
    })
    open(storage).recent.remove('team-alpha')
    const again = open(storage)
    expect(again.profile.get()).toEqual({ name: 'Grace', avatar: 'g' })
    expect(again.prefs.get()).toMatchObject({ sound: false, calm: true, language: 'de' })
    expect(again.recent.list()).toEqual([])
  })

  test('a device without v1 keys gets defaults, a random device id, and no profile to invent', () => {
    const storage = memoryStorage()
    const store = open(storage)
    expect(store.profile.get()).toBeNull()
    expect(store.prefs.get().sound).toBe(false)
    expect(store.deviceId()).toMatch(/^[A-Za-z0-9_-]{21}$/)
    expect(open(storage).deviceId()).toBe(store.deviceId())
    expect(store.recent.list()).toEqual([])
  })

  test('a userId that is no nano id, and a recentRoom that is no address, are not adopted', () => {
    const store = open(memoryStorage({ userId: 'short', recentRoom: 'x' }))
    expect(store.deviceId()).not.toBe('short')
    expect(store.recent.list()).toEqual([])
  })

  test('a sound key v1 never wrote keeps the new default of off', () => {
    expect(open(memoryStorage({ username: 'Ada' })).prefs.get().sound).toBe(false)
  })

  test('the client adopts them when it starts: its hello names the v1 userId', () => {
    const sockets = fakeSockets()
    createRoomClient({
      slug: SLUG,
      profile: { name: 'Ada', avatar: 'ada' },
      origin: 'http://fpp.test',
      ports: portsOf(sockets, fakeClock(), memoryStorage(V1)),
    })
    sockets.last.open()
    expect(sockets.last.hello).toMatchObject({ device: V1.userId })
  })
})

describe('what is kept', () => {
  test('a value of another schema version, or damaged, reads as absent', () => {
    const storage = memoryStorage({
      'fpp:v9:profile': JSON.stringify({ v: 2, name: 'Future', avatar: 'f' }),
      'fpp:v9:prefs': '{not json',
    })
    const store = open(storage)
    expect(store.profile.get()).toBeNull()
    expect(store.prefs.get().theme).toBe('system')
  })

  test('the list puts pinned rooms first, then the latest visit', () => {
    const store = open()
    const base = { name: null, createdAt: null, code: null }
    store.recent.upsert({ ...base, slug: SLUG, pinned: false, visitedAt: NOW - 10 })
    store.recent.upsert({ ...base, slug: slugOf('team-alpha'), pinned: false, visitedAt: NOW - 5 })
    store.recent.upsert({ ...base, slug: slugOf('team-beta'), pinned: true, visitedAt: NOW - 100 })
    expect(store.recent.list().map((room) => String(room.slug))).toEqual([
      'team-beta',
      'team-alpha',
      SLUG,
    ])
    store.recent.update(SLUG, { pinned: true })
    expect(store.recent.get(SLUG)?.pinned).toBe(true)
    store.recent.remove('team-beta')
    expect(store.recent.list().map((room) => String(room.slug))).toEqual([SLUG, 'team-alpha'])
  })

  test('an unpinned room unvisited for six months drops off, a pinned one stays', () => {
    const storage = memoryStorage()
    const store = open(storage)
    const base = { name: null, createdAt: null, code: null }
    store.recent.upsert({ ...base, slug: SLUG, pinned: false, visitedAt: NOW - RECENT_KEEP_MS - 1 })
    store.recent.upsert({
      ...base,
      slug: slugOf('team-beta'),
      pinned: true,
      visitedAt: NOW - RECENT_KEEP_MS * 3,
    })
    store.recent.upsert({
      ...base,
      slug: slugOf('team-alpha'),
      pinned: false,
      visitedAt: NOW - RECENT_KEEP_MS + 1000,
    })
    expect(store.recent.list().map((room) => String(room.slug))).toEqual([
      'team-beta',
      'team-alpha',
    ])
    expect((json(storage, 'fpp:v9:recent')['rooms'] as unknown[]).length).toBe(2)
  })

  test('a seat token is kept per address and cleared on its own', () => {
    const store = open()
    store.seat.set(SLUG, 'secret')
    store.seat.set('team-alpha', 'other')
    store.seat.clear(SLUG)
    expect(store.seat.get(SLUG)).toBeNull()
    expect(store.seat.get('team-alpha')).toBe('other')
  })

  test('a storage that refuses to write does not stop the client', () => {
    const refusing = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('private mode')
      },
    }
    const store = createLocalStore({ storage: refusing, now: () => NOW, random: () => 0.5 })
    expect(store.deviceId()).toHaveLength(21)
    expect(() => store.seat.clear(SLUG)).not.toThrow()
  })
})
