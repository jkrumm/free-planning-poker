/**
 * What the room routes and the socket's directory do with Postgres and the live rooms (docs/v9/ARCHITECTURE.md,
 * Room model and HTTP API): numbers drawn and claimed, names booked, addresses resolved and held by visits, the lock
 * and the name changed for a player seated in the room. Business errors come back as values (`RoomsApi`).
 */
import type { IdSource, RoomKey, RoomRuntime } from '@fpp/room-core/server'
import {
  generateAccessCode,
  parseAccessCode,
  parseSlug,
  type AccessCode,
  type SeatIndex,
  type Slug,
} from '@fpp/room-core/types'
import { sql } from 'drizzle-orm'
import { Effect, Result } from 'effect'
import {
  bookName,
  claimAddress,
  findClaimable,
  resolveAddress,
  touchAddress,
} from '../db/addresses.ts'
import { NUMBER_CANDIDATES, NUMBER_DIGITS, NUMBER_DRAWS } from '../db/holds.ts'
import type { Db } from '../db/client.ts'
import { type Database, DbDefect, retryBriefly } from '../db/resilience.ts'
import { createRoom, findRoom, setRoomName } from '../db/rooms.ts'
import type { Health } from '../http/app.ts'
import type { Failure, RoomsApi, SeatError } from '../http/rooms.ts'
import type { RoomDirectory } from '../ws/edge.ts'

const NUMBER_ONLY = /^\d+$/

/** A name as the rule has it (3 to 30 of a-z, 0-9 and -, one letter at least), exactly as typed, or undefined. */
export function parseName(input: string): Slug | undefined {
  const slug = parseSlug(input)
  return slug === input && !NUMBER_ONLY.test(slug) ? slug : undefined
}

/** `count` numbers of `NUMBER_DIGITS` digits, each uniformly drawn from `bytes`. */
export function drawNumbers(bytes: IdSource['bytes'], count: number): string[] {
  const low = 10 ** (NUMBER_DIGITS - 1)
  const range = 9 * low
  const limit = Math.floor(2 ** 32 / range) * range
  const numbers: string[] = []
  while (numbers.length < count) {
    const [a = 0, b = 0, c = 0, d = 0] = bytes(4)
    const value = ((a << 24) | (b << 16) | (c << 8) | d) >>> 0
    if (value < limit) numbers.push(String(low + (value % range)))
  }
  return numbers
}

/** A failure inside a transaction that rolls it back and is an answer, not a bug. */
class Refusal extends Error {
  constructor(readonly reason: 'name_held' | 'numbers_exhausted') {
    super(reason)
  }
}

const refusalOf = (error: unknown) =>
  error instanceof DbDefect && error.cause instanceof Refusal ? error.cause.reason : undefined

const STATE_OF_HEALTH_PROBE = '1 second'

export type RoomsDeps = {
  readonly database: Database
  readonly ids: IdSource
  readonly now: () => Date
  /** The live rooms; set once the server has started its runtime. */
  readonly runtime: () => RoomRuntime | undefined
  /** No number could be drawn in `NUMBER_DRAWS` draws: the pool is running out. */
  readonly exhausted: () => void
  /** A bug below a route, reported once. */
  readonly failed: (error: unknown) => void
}

export function postgresRooms(deps: RoomsDeps): {
  readonly api: RoomsApi
  readonly directory: RoomDirectory
  readonly health: () => Promise<Health>
} {
  const { database, now } = deps
  /** Addresses resolved before, so a room in play is still reached while Postgres is away. */
  const known = new Map<Slug, RoomKey>()
  /** The UTC day each address was last held again by a visit: one write per address and day. */
  const touched = new Map<Slug, string>()

  const run = <A>(work: (db: Db) => Promise<A>) =>
    Effect.runPromise(Effect.result(retryBriefly(database.run<A>(work))))

  /** Unavailable while Postgres is away; a bug is reported and answered the same way. */
  const unavailable = <E extends string>(
    error: unknown,
    refused?: E,
  ): Failure<E | 'unavailable'> => {
    const reason = refusalOf(error)
    if (refused !== undefined && reason === refused) return { ok: false, error: refused }
    if (error instanceof DbDefect) deps.failed(error)
    return { ok: false, error: 'unavailable' }
  }

  async function keyOf(slug: Slug): Promise<RoomKey | null | 'unavailable'> {
    const resolved = await run((db) => resolveAddress(db, { slug, now: now() }))
    if (Result.isFailure(resolved)) {
      if (resolved.failure instanceof DbDefect) deps.failed(resolved.failure)
      return known.get(slug) ?? 'unavailable'
    }
    if (resolved.success === null) {
      known.delete(slug)
      return null
    }
    const key = String(resolved.success.roomId)
    known.set(slug, key)
    return key
  }

  /** The seat a token proves in the live room, if it is a player's. */
  function player(
    key: RoomKey,
    token: string | undefined,
  ): { ok: true; seat: SeatIndex } | Failure<SeatError> {
    const runtime = deps.runtime()
    const seat =
      token === undefined || runtime === undefined ? undefined : runtime.seatOf(key, token)
    if (seat === undefined) return { ok: false, error: 'not_seated' }
    const role = runtime?.inspect(key)?.state.seats.find((entry) => entry.index === seat)?.role
    return role === 'player' ? { ok: true, seat } : { ok: false, error: 'not_player' }
  }

  async function seatedPlayer(slug: string, token: string | undefined) {
    const address = parseSlug(slug)
    if (address === undefined || address !== slug)
      return { ok: false as const, error: 'unknown_room' as const }
    const key = await keyOf(address)
    if (key === 'unavailable') return { ok: false as const, error: 'unavailable' as const }
    if (key === null) return { ok: false as const, error: 'unknown_room' as const }
    const seat = player(key, token)
    return seat.ok ? { ok: true as const, key, seat: seat.seat } : seat
  }

  const api: RoomsApi = {
    async create(input) {
      const name = input.name === undefined ? undefined : parseName(input.name)
      if (input.name !== undefined && name === undefined)
        return { ok: false, error: 'invalid_name' }
      const created = await run((db) =>
        db.transaction(async (tx) => {
          const at = now()
          const roomId = await createRoom(tx, { createdAt: at })
          let number: string | null = null
          for (let draw = 0; draw < NUMBER_DRAWS && number === null; draw += 1) {
            const candidates = drawNumbers(deps.ids.bytes, NUMBER_CANDIDATES)
            const free = await findClaimable(tx, { candidates, now: at })
            if (free !== null)
              number = await claimAddress(tx, { roomId, slug: free, kind: 'number', now: at })
          }
          if (number === null) throw new Refusal('numbers_exhausted')
          if (name !== undefined && (await bookName(tx, { roomId, name, now: at })) === null)
            throw new Refusal('name_held')
          await setRoomName(tx, { roomId, name: name ?? number })
          return { roomId, number, createdAt: at }
        }),
      )
      if (Result.isFailure(created)) {
        if (refusalOf(created.failure) === 'numbers_exhausted') {
          deps.exhausted()
          return { ok: false, error: 'unavailable' }
        }
        return unavailable(created.failure, 'name_held')
      }
      const { roomId, number, createdAt } = created.success
      const slug = (name ?? number) as Slug
      known.set(slug, String(roomId))
      return {
        ok: true,
        room: { slug, number, name: name ?? null, createdAt: createdAt.toISOString() },
      }
    },

    async lookup(raw) {
      const slug = parseSlug(raw)
      if (slug === undefined || slug !== raw) return { ok: false, error: 'invalid_slug' }
      const found = await run(async (db) => {
        const resolved = await resolveAddress(db, { slug, now: now() })
        return resolved === null ? null : { resolved, row: await findRoom(db, resolved.roomId) }
      })
      if (Result.isFailure(found)) return unavailable(found.failure)
      if (found.success === null || found.success.row === null)
        return { ok: true, room: { state: 'free' } }
      const { resolved, row } = found.success
      const live = deps.runtime()?.inspect(String(resolved.roomId))?.state
      const access = live?.room.access ?? row.access
      const base = {
        state: resolved.released ? ('released' as const) : ('held' as const),
        access,
        createdAt: resolved.roomCreatedAt.toISOString(),
        ...(resolved.primarySlug === null || resolved.primarySlug === slug
          ? {}
          : { primary: resolved.primarySlug }),
      }
      if (access === 'locked') return { ok: true, room: base }
      const seated = (live?.seats ?? []).filter((seat) => seat.presence !== 'gone')
      return {
        ok: true,
        room: {
          ...base,
          name: live?.room.name ?? row.name,
          ...(live === undefined ? {} : { settings: live.room.settings }),
          seats: {
            players: seated.filter((seat) => seat.role === 'player').length,
            spectators: seated.filter((seat) => seat.role === 'spectator').length,
          },
        },
      }
    },

    async setAccess(input) {
      const seated = await seatedPlayer(input.slug, input.token)
      if (!seated.ok) return seated
      let code: AccessCode | null = null
      if (input.access === 'locked') {
        const typed =
          input.code === undefined
            ? generateAccessCode(deps.ids.bytes)
            : parseAccessCode(input.code)
        if (typed === undefined) return { ok: false, error: 'invalid_code' }
        code = typed
      }
      const changed = deps.runtime()?.setAccess(seated.key, {
        access: input.access,
        code,
        by: seated.seat,
        reseat: input.signOut,
      })
      if (changed === undefined || !changed.ok) return { ok: false, error: 'not_seated' }
      return { ok: true, access: input.access, code }
    },

    async setName(input) {
      const name = parseName(input.name)
      if (name === undefined) return { ok: false, error: 'invalid_name' }
      const seated = await seatedPlayer(input.slug, input.token)
      if (!seated.ok) return seated
      const booked = await run((db) =>
        bookName(db, { roomId: Number(seated.key), name, now: now() }),
      )
      if (Result.isFailure(booked)) return unavailable(booked.failure)
      if (booked.success === null) return { ok: false, error: 'name_held' }
      known.set(name, seated.key)
      deps.runtime()?.setSlug(seated.key, name)
      return { ok: true, slug: name }
    },
  }

  const directory: RoomDirectory = {
    async resolve(slug) {
      const key = await keyOf(slug)
      if (key === 'unavailable') throw new Error('the room directory could not reach Postgres')
      if (key === null) return null
      const day = now().toISOString().slice(0, 10)
      if (touched.get(slug) !== day) {
        touched.set(slug, day)
        // A visit holds the address again; a failed touch is retried by the next visit of another day.
        void run((db) => touchAddress(db, { roomId: Number(key), slug, now: now() }))
      }
      return key
    },
  }

  const health = async (): Promise<Health> => {
    const probe = await Effect.runPromise(
      Effect.result(
        database
          .run((db) => db.execute(sql`SELECT 1`))
          .pipe(
            Effect.timeoutOrElse({
              duration: STATE_OF_HEALTH_PROBE,
              orElse: () => Effect.fail('timeout' as const),
            }),
          ),
      ),
    )
    return Result.isSuccess(probe) ? 'ok' : 'degraded'
  }

  return { api, directory, health }
}
