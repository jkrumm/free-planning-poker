/**
 * The value objects of the room (docs/v9/ARCHITECTURE.md, How a change happens: Value object). Each is a branded type
 * whose parser here is its only constructor; the Zod schemas of the protocol wrap these parsers, so the browser can
 * parse a slug or a tracker reference without shipping a validator. A parser returns `undefined` for input it refuses.
 * Card and Deck live in decks.ts beside the decks they describe.
 */

declare const brand: unique symbol

/** A value of `T` that went through the parser named `B`. */
export type Brand<T, B extends string> = T & { readonly [brand]: B }

/** What stands in the URL after `/room/`: six or eight digits, or a booked name. */
export type Slug = Brand<string, 'Slug'>

/** A seat's place in its room; never reused while the room is live, and the only way history names a person. */
export type SeatIndex = Brand<number, 'SeatIndex'>

export const TRACKER_SOURCES = ['jira', 'linear', 'github', 'gitlab', 'azure-devops'] as const
export type TrackerSource = (typeof TRACKER_SOURCES)[number]

/** Where a topic lives in a tracker: provider, stable id, display key, site or workspace. Any part may be unknown. */
export type TopicRef = Brand<
  {
    readonly source: TrackerSource | null
    readonly id: string | null
    readonly key: string | null
    readonly site: string | null
  },
  'TopicRef'
>

/** A locked room's password, trimmed; compared with `sameAccessCode`. */
export type AccessCode = Brand<string, 'AccessCode'>

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === 'object' && input !== null && !Array.isArray(input)

const NUMBER_SLUG = /^(\d{6}|\d{8})$/
const NAME_SLUG = /^(?=[a-z0-9-]*[a-z])[a-z0-9-]{3,30}$/

/** A six- or eight-digit number, or a name of 3 to 30 characters of a-z, 0-9 and - with at least one letter. */
export function parseSlug(input: unknown): Slug | undefined {
  if (typeof input !== 'string') return undefined
  const slug = input.trim().toLowerCase()
  return NUMBER_SLUG.test(slug) || NAME_SLUG.test(slug) ? (slug as Slug) : undefined
}

/**
 * The address a v1 room link leads to in v9. v1 read `/room/<x>` lowercased and trimmed and kept any 2 to 15 characters
 * as a name, so the importer and the room shell map a v1 name by this one function: an address valid already is itself;
 * otherwise NFKD with its combining marks dropped, every run of characters outside a-z and 0-9 one hyphen, the hyphens at
 * the ends trimmed, and what remains must be a name. Undefined where nothing valid remains (`ab`, `!!!`, `12 34`).
 */
export function parseV1Address(input: string): Slug | undefined {
  const exact = parseSlug(input)
  if (exact !== undefined) return exact
  const mapped = input
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return NAME_SLUG.test(mapped) ? (mapped as Slug) : undefined
}

export function parseSeatIndex(input: unknown): SeatIndex | undefined {
  return typeof input === 'number' && Number.isSafeInteger(input) && input >= 0
    ? (input as SeatIndex)
    : undefined
}

const REF_PART_MAX = 200

const refPart = (input: unknown): string | null | undefined => {
  if (input === null) return null
  if (typeof input !== 'string') return undefined
  const part = input.trim()
  return part.length > 0 && part.length <= REF_PART_MAX ? part : undefined
}

/** A tracker reference; at least its stable id or its key is known. */
export function parseTopicRef(input: unknown): TopicRef | undefined {
  if (!isRecord(input)) return undefined
  const source = input['source'] ?? null
  if (source !== null && !TRACKER_SOURCES.includes(source as TrackerSource)) return undefined
  const id = refPart(input['id'] ?? null)
  const key = refPart(input['key'] ?? null)
  const site = refPart(input['site'] ?? null)
  if (id === undefined || key === undefined || site === undefined) return undefined
  if (id === null && key === null) return undefined
  return { source: source as TrackerSource | null, id, key, site } as TopicRef
}

const CONTROL = /\p{Cc}/u

/** A typed password: trimmed, then 2 to 32 characters, none of them a control character. */
export function parseAccessCode(input: unknown): AccessCode | undefined {
  if (typeof input !== 'string') return undefined
  const code = input.trim()
  const length = [...code].length
  return length >= 2 && length <= 32 && !CONTROL.test(code) ? (code as AccessCode) : undefined
}

/**
 * The characters of a generated password: digits and lower-case letters without 0, 1, i, l and o, which are read as
 * one another (docs/v9/ARCHITECTURE.md, Room model: the lock). Passwords compare case-folded, so upper case adds nothing.
 */
export const ACCESS_CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'

/** A generated password has this many characters, about 30 bits. */
export const ACCESS_CODE_LENGTH = 6

/**
 * A password drawn from `ACCESS_CODE_ALPHABET`. `bytes` is the caller's source of random bytes (the id port); a byte
 * at or above the largest multiple of the alphabet's length is drawn again, so every character is equally likely.
 */
export function generateAccessCode(bytes: (n: number) => Uint8Array): AccessCode {
  const size = ACCESS_CODE_ALPHABET.length
  const limit = 256 - (256 % size)
  let code = ''
  while (code.length < ACCESS_CODE_LENGTH) {
    for (const byte of bytes(ACCESS_CODE_LENGTH)) {
      if (byte >= limit || code.length === ACCESS_CODE_LENGTH) continue
      code += ACCESS_CODE_ALPHABET[byte % size]
    }
  }
  return code as AccessCode
}

const fold = (code: string) => code.normalize('NFKC').toLowerCase()

/**
 * Passwords compare after NFKC normalisation and case folding, so one read out loud works. The comparison takes the
 * same steps wherever the two differ, so its time tells nothing about how much of a guess was right.
 */
export function sameAccessCode(a: AccessCode, b: AccessCode): boolean {
  const left = fold(a)
  const right = fold(b)
  const length = Math.max(left.length, right.length)
  let difference = left.length ^ right.length
  for (let index = 0; index < length; index += 1)
    difference |= (left.charCodeAt(index) | 0) ^ (right.charCodeAt(index) | 0)
  return difference === 0
}
