/**
 * What a device remembers (docs/v9/ARCHITECTURE.md, Client): every key under `fpp:v9:`, every value an object with
 * a schema version `v`. A value that does not parse, or has another version, reads as absent. Nothing is cached, so
 * two tabs of one origin always see the same thing. On first run the keys of v1 are adopted once: a new key is
 * written only where it is absent, and no v1 key is ever deleted.
 */
import { parseSlug, type Slug } from '@fpp/room-core/types'
import type { StorageLike } from './ports.ts'

const PREFIX = 'fpp:v9:'
const KEY = {
  profile: `${PREFIX}profile`,
  prefs: `${PREFIX}prefs`,
  device: `${PREFIX}device`,
  recent: `${PREFIX}recent`,
  seat: (slug: string) => `${PREFIX}seat:${slug}`,
} as const

const SCHEMA = 1
const DAY_MS = 86_400_000
/** An unpinned room nobody visited for this long drops off the list. */
export const RECENT_KEEP_MS = 182 * DAY_MS
const NAME_MAX = 32

export type Profile = { readonly name: string; readonly avatar: string }

export type Prefs = {
  readonly sound: boolean
  readonly calm: boolean
  readonly view: 'auto' | 'table' | 'grid'
  readonly theme: 'system' | 'light' | 'dark'
  /** A tag such as `de`; `null` follows the browser. */
  readonly language: string | null
}

/** What a new device starts with: sound is off until somebody turns it on. */
export const DEFAULT_PREFS: Prefs = {
  sound: false,
  calm: false,
  view: 'auto',
  theme: 'system',
  language: null,
}

export type RecentRoom = {
  readonly slug: Slug
  readonly name: string | null
  /** When the room was created, as the API told this device; `null` where it never did. */
  readonly createdAt: number | null
  /** The access code of a locked room, kept so a visit without the link's fragment needs no question. */
  readonly code: string | null
  readonly pinned: boolean
  readonly visitedAt: number
}

export type LocalStore = {
  readonly profile: { get(): Profile | null; set(profile: Profile): void }
  readonly prefs: { get(): Prefs; set(prefs: Prefs): void }
  /** The anonymous device id: counts visitors and authorises nothing (invariant 5). */
  readonly deviceId: () => string
  readonly recent: {
    /** Pinned rooms first, then the latest visit first; drops what has expired. */
    list(): RecentRoom[]
    get(slug: string): RecentRoom | undefined
    upsert(room: RecentRoom): void
    update(slug: string, change: Partial<Omit<RecentRoom, 'slug'>>): void
    remove(slug: string): void
  }
  readonly seat: {
    get(slug: string): string | null
    set(slug: string, token: string): void
    clear(slug: string): void
  }
}

export type LocalStoreOptions = {
  readonly storage: StorageLike
  readonly now: () => number
  /** A float in [0, 1); ids and avatar seeds only. */
  readonly random: () => number
}

type Raw = Record<string, unknown>

const isRaw = (input: unknown): input is Raw =>
  typeof input === 'object' && input !== null && !Array.isArray(input)

const NANO_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-'
const NANO_ID = /^[A-Za-z0-9_-]{21}$/

/** `length` characters of the URL-safe alphabet of v1's ids. */
export function randomId(random: () => number, length = 21): string {
  let id = ''
  for (let index = 0; index < length; index += 1)
    id += NANO_ALPHABET.charAt(Math.floor(random() * NANO_ALPHABET.length))
  return id
}

const parseProfile = (raw: Raw): Profile | undefined => {
  const { name, avatar } = raw
  return typeof name === 'string' &&
    name.length > 0 &&
    typeof avatar === 'string' &&
    avatar.length > 0
    ? { name, avatar }
    : undefined
}

const parsePrefs = (raw: Raw): Prefs => ({
  sound: typeof raw['sound'] === 'boolean' ? raw['sound'] : DEFAULT_PREFS.sound,
  calm: typeof raw['calm'] === 'boolean' ? raw['calm'] : DEFAULT_PREFS.calm,
  view: raw['view'] === 'table' || raw['view'] === 'grid' ? raw['view'] : 'auto',
  theme: raw['theme'] === 'light' || raw['theme'] === 'dark' ? raw['theme'] : 'system',
  language: typeof raw['language'] === 'string' ? raw['language'] : null,
})

const parseRecentRoom = (raw: unknown): RecentRoom | undefined => {
  if (!isRaw(raw)) return undefined
  const slug = parseSlug(raw['slug'])
  const visitedAt = raw['visitedAt']
  if (slug === undefined || typeof visitedAt !== 'number') return undefined
  const createdAt = raw['createdAt']
  return {
    slug,
    name: typeof raw['name'] === 'string' ? raw['name'] : null,
    createdAt: typeof createdAt === 'number' ? createdAt : null,
    code: typeof raw['code'] === 'string' ? raw['code'] : null,
    pinned: raw['pinned'] === true,
    visitedAt,
  }
}

const order = (a: RecentRoom, b: RecentRoom) =>
  Number(b.pinned) - Number(a.pinned) || b.visitedAt - a.visitedAt

export function createLocalStore(options: LocalStoreOptions): LocalStore {
  const { now, random } = options
  // A browser in private mode may refuse to read or write; the client then runs on what it holds in memory.
  const storage = {
    get(key: string): string | null {
      try {
        return options.storage.getItem(key)
      } catch {
        return null
      }
    },
    set(key: string, value: string) {
      try {
        options.storage.setItem(key, value)
      } catch {
        // Quota or private mode: the value is lost with the page.
      }
    },
    remove(key: string) {
      try {
        options.storage.removeItem(key)
      } catch {
        // As above.
      }
    },
  }

  const read = <T>(key: string, parse: (raw: Raw) => T | undefined): T | undefined => {
    const text = storage.get(key)
    if (text === null) return undefined
    try {
      const raw: unknown = JSON.parse(text)
      return isRaw(raw) && raw['v'] === SCHEMA ? parse(raw) : undefined
    } catch {
      return undefined
    }
  }
  const write = (key: string, value: Raw) =>
    storage.set(key, JSON.stringify({ v: SCHEMA, ...value }))

  const readRecentRaw = (): RecentRoom[] | undefined =>
    read(KEY.recent, (raw) => {
      const rooms = raw['rooms']
      if (!Array.isArray(rooms)) return undefined
      return rooms.flatMap((entry) => {
        const room = parseRecentRoom(entry)
        return room === undefined ? [] : [room]
      })
    })

  const writeRecent = (rooms: readonly RecentRoom[]) => write(KEY.recent, { rooms })

  adoptV1()

  function adoptV1() {
    if (read(KEY.profile, parseProfile) === undefined) {
      const name = (storage.get('username') ?? '').trim().slice(0, NAME_MAX)
      if (name.length > 0) write(KEY.profile, { name, avatar: randomId(random, 12) })
    }
    if (read(KEY.prefs, parsePrefs) === undefined) {
      // v1's isNotificationsEnabled has no counterpart: v9 sends no push notifications. A key v1 never wrote keeps
      // the new default, because v1's own default (on) is not a choice the person made.
      write(KEY.prefs, {
        ...DEFAULT_PREFS,
        sound: storage.get('isPlaySound') === 'true',
        view: storage.get('preferCardView') === 'true' ? 'grid' : 'auto',
      })
    }
    if (
      read(KEY.device, (raw) => (typeof raw['id'] === 'string' ? raw['id'] : undefined)) ===
      undefined
    ) {
      const userId = storage.get('userId')
      write(KEY.device, { id: userId !== null && NANO_ID.test(userId) ? userId : randomId(random) })
    }
    if (readRecentRaw() === undefined) {
      const slug = parseSlug(storage.get('recentRoom'))
      writeRecent(
        slug === undefined
          ? []
          : [{ slug, name: null, createdAt: null, code: null, pinned: false, visitedAt: now() }],
      )
    }
  }

  const list = (): RecentRoom[] => {
    const all = readRecentRaw() ?? []
    const kept = all.filter((room) => room.pinned || now() - room.visitedAt < RECENT_KEEP_MS)
    if (kept.length !== all.length) writeRecent(kept)
    return kept.toSorted(order)
  }

  return {
    profile: {
      get: () => read(KEY.profile, parseProfile) ?? null,
      set: (profile) => write(KEY.profile, { name: profile.name, avatar: profile.avatar }),
    },
    prefs: {
      get: () => read(KEY.prefs, parsePrefs) ?? DEFAULT_PREFS,
      set: (prefs) => write(KEY.prefs, { ...prefs }),
    },
    deviceId: () => {
      const id = read(KEY.device, (raw) => (typeof raw['id'] === 'string' ? raw['id'] : undefined))
      if (id !== undefined) return id
      const made = randomId(random)
      write(KEY.device, { id: made })
      return made
    },
    recent: {
      list,
      get: (slug) => list().find((room) => room.slug === slug),
      upsert: (room) => writeRecent([...list().filter((other) => other.slug !== room.slug), room]),
      update: (slug, change) =>
        writeRecent(list().map((room) => (room.slug === slug ? { ...room, ...change } : room))),
      remove: (slug) => writeRecent(list().filter((room) => room.slug !== slug)),
    },
    seat: {
      get: (slug) =>
        read(KEY.seat(slug), (raw) =>
          typeof raw['token'] === 'string' ? raw['token'] : undefined,
        ) ?? null,
      set: (slug, token) => write(KEY.seat(slug), { token }),
      clear: (slug) => storage.remove(KEY.seat(slug)),
    },
  }
}
