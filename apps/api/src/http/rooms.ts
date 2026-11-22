/**
 * The room routes (docs/v9/ARCHITECTURE.md, HTTP API): create a room, look an address up, lock it, name it. What they
 * do lives behind `RoomsApi`, which the composition root implements; a business error comes back as a value and
 * leaves as a typed response, so nothing here throws for a user mistake. A seat proves itself with its token in the
 * `Authorization` header (`Bearer <token>`), never in the query string.
 */
import type { Settings } from '@fpp/room-core/types'
import { Elysia, t } from 'elysia'

export type RoomCreated = {
  readonly slug: string
  readonly number: string
  readonly name: string | null
  readonly createdAt: string
}

export type RoomLookup =
  | { readonly state: 'free' }
  | {
      readonly state: 'held' | 'released'
      readonly access: 'open' | 'locked'
      readonly createdAt: string
      /** The room's primary address, when the one asked for is another of its addresses. */
      readonly primary?: string
      /** An open room only. */
      readonly name?: string
      readonly settings?: Settings
      readonly seats?: { readonly players: number; readonly spectators: number }
    }

export type Failure<E extends string> = { readonly ok: false; readonly error: E }
type Outcome<T, E extends string> = ({ readonly ok: true } & T) | Failure<E>

/** Who may change a room: a player seated in it. */
export type SeatError = 'unknown_room' | 'not_seated' | 'not_player'

export type RoomsApi = {
  readonly create: (input: {
    readonly name?: string
  }) => Promise<Outcome<{ room: RoomCreated }, 'invalid_name' | 'name_held' | 'unavailable'>>
  readonly lookup: (
    slug: string,
  ) => Promise<Outcome<{ room: RoomLookup }, 'invalid_slug' | 'unavailable'>>
  readonly setAccess: (input: {
    readonly slug: string
    readonly token: string | undefined
    readonly access: 'open' | 'locked'
    readonly code?: string
    readonly signOut: boolean
  }) => Promise<
    Outcome<
      { access: 'open' | 'locked'; code: string | null },
      SeatError | 'invalid_code' | 'unavailable'
    >
  >
  readonly setName: (input: {
    readonly slug: string
    readonly token: string | undefined
    readonly name: string
  }) => Promise<Outcome<{ slug: string }, SeatError | 'invalid_name' | 'name_held' | 'unavailable'>>
}

const Err = <const E extends string>(error: E) => t.Object({ error: t.Literal(error) })

const NotSeated = t.Object({ error: t.Union([t.Literal('not_seated'), t.Literal('not_player')]) })

const SettingsBody = t.Unsafe<Settings>(t.Object({}, { additionalProperties: true }))

const Lookup = t.Union([
  t.Object({ state: t.Literal('free') }),
  t.Object({
    state: t.Union([t.Literal('held'), t.Literal('released')]),
    access: t.Union([t.Literal('open'), t.Literal('locked')]),
    createdAt: t.String(),
    primary: t.Optional(t.String()),
    name: t.Optional(t.String()),
    settings: t.Optional(SettingsBody),
    seats: t.Optional(t.Object({ players: t.Integer(), spectators: t.Integer() })),
  }),
])

const Created = t.Object({
  slug: t.String(),
  number: t.String(),
  name: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
})

const Access = t.Object({
  access: t.Union([t.Literal('open'), t.Literal('locked')]),
  code: t.Union([t.String(), t.Null()]),
})

/** The token of `Authorization: Bearer <token>`, or undefined. */
export function bearer(header: string | undefined): string | undefined {
  const match = /^Bearer ([A-Za-z0-9_-]{1,128})$/.exec(header?.trim() ?? '')
  return match?.[1]
}

export function roomRoutes(api: RoomsApi) {
  return new Elysia()
    .post(
      '/rooms',
      {
        body: t.Object({ name: t.Optional(t.String({ maxLength: 256 })) }),
        response: {
          201: Created,
          400: Err('invalid_name'),
          409: Err('name_held'),
          503: Err('unavailable'),
        },
      },
      async ({ body, status }) => {
        const result = await api.create(body.name === undefined ? {} : { name: body.name })
        if (result.ok) return status(201, result.room)
        if (result.error === 'invalid_name') return status(400, { error: result.error })
        if (result.error === 'name_held') return status(409, { error: result.error })
        return status(503, { error: result.error })
      },
    )
    .get(
      '/rooms/:slug',
      {
        params: t.Object({ slug: t.String({ maxLength: 64 }) }),
        response: {
          200: Lookup,
          400: Err('invalid_slug'),
          503: Err('unavailable'),
        },
      },
      async ({ params, status }) => {
        const result = await api.lookup(params.slug)
        if (result.ok) return status(200, result.room)
        if (result.error === 'invalid_slug') return status(400, { error: result.error })
        return status(503, { error: result.error })
      },
    )
    .put(
      '/rooms/:slug/access',
      {
        params: t.Object({ slug: t.String({ maxLength: 64 }) }),
        body: t.Object({
          access: t.Union([t.Literal('open'), t.Literal('locked')]),
          code: t.Optional(t.String({ maxLength: 256 })),
          signOut: t.Optional(t.Boolean()),
        }),
        response: {
          200: Access,
          400: Err('invalid_code'),
          403: NotSeated,
          404: Err('unknown_room'),
          503: Err('unavailable'),
        },
      },
      async ({ params, body, headers, status }) => {
        const result = await api.setAccess({
          slug: params.slug,
          token: bearer(headers['authorization']),
          access: body.access,
          ...(body.code === undefined ? {} : { code: body.code }),
          signOut: body.signOut ?? false,
        })
        if (result.ok) return status(200, { access: result.access, code: result.code })
        switch (result.error) {
          case 'invalid_code':
            return status(400, { error: result.error })
          case 'not_seated':
          case 'not_player':
            return status(403, { error: result.error })
          case 'unknown_room':
            return status(404, { error: result.error })
          case 'unavailable':
            return status(503, { error: result.error })
        }
      },
    )
    .put(
      '/rooms/:slug/name',
      {
        params: t.Object({ slug: t.String({ maxLength: 64 }) }),
        body: t.Object({ name: t.String({ maxLength: 256 }) }),
        response: {
          200: t.Object({ slug: t.String() }),
          400: Err('invalid_name'),
          403: NotSeated,
          404: Err('unknown_room'),
          409: Err('name_held'),
          503: Err('unavailable'),
        },
      },
      async ({ params, body, headers, status }) => {
        const result = await api.setName({
          slug: params.slug,
          token: bearer(headers['authorization']),
          name: body.name,
        })
        if (result.ok) return status(200, { slug: result.slug })
        switch (result.error) {
          case 'invalid_name':
            return status(400, { error: result.error })
          case 'not_seated':
          case 'not_player':
            return status(403, { error: result.error })
          case 'unknown_room':
            return status(404, { error: result.error })
          case 'name_held':
            return status(409, { error: result.error })
          case 'unavailable':
            return status(503, { error: result.error })
        }
      },
    )
}
