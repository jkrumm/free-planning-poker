/**
 * A room's history over HTTP (docs/v9/ARCHITECTURE.md, HTTP API): `GET /rooms/:slug/topics` lists every topic with its
 * rounds in the shape of the result contract, `GET /rooms/:slug/summary` one line per topic and the room's totals.
 * Each comes as JSON (the default), CSV or Markdown, chosen by `?format=json|csv|markdown`. The proof is a seat of
 * that room, in the `Authorization` header as for the PUT routes; a spectator may read, because every seat sees each
 * result at the reveal. No participant name and no single seat's vote is in any of them.
 */
import type { DecidedResult, ResultCount, ResultTopic, RevealedResult } from '@fpp/room-core/types'
import { TRACKER_SOURCES } from '@fpp/room-core/types'
import { Elysia, t } from 'elysia'
import type { TSchema } from 'typebox'
import { csvOfSummary, csvOfTopics, markdownOfSummary, markdownOfTopics } from './history.format.ts'
import { bearer, Err, type RoomsApi } from './rooms.ts'

/** What v1 kept of a round it played: no distribution, only these four numbers (`round.summary`). */
export type V1Summary = {
  readonly average: number
  readonly lowest: number
  readonly highest: number
  readonly count: number
}

/** The numeric cards of a round: the lowest, the highest and the mean, by votes. */
export type Figures = {
  readonly lowest: number
  readonly highest: number
  readonly average: number
}

export type HistoryRound = {
  /** The contract's `poker.revealed`, its `id` the round's. */
  readonly result: RevealedResult
  readonly startedAt: string
  readonly spectators: number
  readonly autoReveal: boolean
  readonly figures: Figures | null
  /** Only a round imported from v1, which has no distribution; `result.round.voters` is then v1's count. */
  readonly summary?: V1Summary
}

export type HistoryTopic = ResultTopic & {
  readonly position: number
  readonly state: 'queued' | 'active' | 'done' | 'skipped'
  /** The contract's `topic.decided` with the round that carried it, its `id` the topic's; null while undecided. */
  readonly decided: DecidedResult | null
  readonly rounds: readonly HistoryRound[]
}

export type RoomName = { readonly slug: string; readonly name: string }

export type TopicsBody = { readonly room: RoomName; readonly topics: readonly HistoryTopic[] }

export type SummaryTopic = {
  readonly id: string
  readonly position: number
  readonly title: string | null
  readonly url: string | null
  readonly state: HistoryTopic['state']
  readonly final: DecidedResult['final'] | null
  /** No final value: `leading`, when there is one, is the topic's most played card so far. */
  readonly open: boolean
  /** The most played card of the latest round. */
  readonly leading: ResultCount | null
  /** Lowest and highest numeric card of the latest round. */
  readonly spread: { readonly lowest: number; readonly highest: number } | null
  readonly rounds: number
  /** The sum of the rounds' voting time, each from its start to its reveal. */
  readonly durationSeconds: number
}

export type SummaryBody = {
  readonly room: RoomName
  readonly topics: readonly SummaryTopic[]
  readonly totals: {
    readonly topics: number
    readonly decided: number
    readonly rounds: number
    readonly durationSeconds: number
    /** The sum of the final values. */
    readonly points: number
  }
}

const Nullable = <T extends TSchema>(schema: T) => t.Union([schema, t.Null()])

const Count = t.Object({ label: t.String(), value: Nullable(t.Number()), count: t.Integer() })

const ResultRoom = t.Object({ slug: t.String(), name: t.String() })

const Source = t.Union([...TRACKER_SOURCES.map((source) => t.Literal(source)), t.Null()])

const Topic = t.Object({
  id: t.String(),
  title: Nullable(t.String()),
  url: Nullable(t.String()),
  source: Source,
  externalId: Nullable(t.String()),
  externalKey: Nullable(t.String()),
  externalSite: Nullable(t.String()),
})

const ResultRound = t.Object({
  id: t.String(),
  no: t.Integer(),
  attempt: t.Integer(),
  deck: t.String(),
  voters: t.Integer(),
  consensus: t.Boolean(),
  distribution: t.Array(Count),
})

const Revealed = t.Unsafe<RevealedResult>(
  t.Object({
    type: t.Literal('poker.revealed'),
    v: t.Literal(1),
    id: t.String(),
    at: t.String(),
    room: ResultRoom,
    topic: Topic,
    round: ResultRound,
  }),
)

const Decided = t.Unsafe<DecidedResult>(
  t.Object({
    type: t.Literal('topic.decided'),
    v: t.Literal(1),
    id: t.String(),
    at: t.String(),
    room: ResultRoom,
    topic: Topic,
    round: ResultRound,
    final: t.Object({
      label: t.String(),
      value: t.Number(),
      decidedBy: t.Union([t.Literal('agreed'), t.Literal('settled')]),
    }),
  }),
)

const Figure = t.Object({ lowest: t.Number(), highest: t.Number(), average: t.Number() })

const State = t.Union([
  t.Literal('queued'),
  t.Literal('active'),
  t.Literal('done'),
  t.Literal('skipped'),
])

const TopicsResponse = t.Unsafe<TopicsBody>(
  t.Object({
    room: ResultRoom,
    topics: t.Array(
      t.Object({
        ...Topic.properties,
        position: t.Integer(),
        state: State,
        decided: Nullable(Decided),
        rounds: t.Array(
          t.Object({
            result: Revealed,
            startedAt: t.String(),
            spectators: t.Integer(),
            autoReveal: t.Boolean(),
            figures: Nullable(Figure),
            summary: t.Optional(
              t.Object({
                average: t.Number(),
                lowest: t.Number(),
                highest: t.Number(),
                count: t.Integer(),
              }),
            ),
          }),
        ),
      }),
    ),
  }),
)

const SummaryResponse = t.Unsafe<SummaryBody>(
  t.Object({
    room: ResultRoom,
    topics: t.Array(
      t.Object({
        id: t.String(),
        position: t.Integer(),
        title: Nullable(t.String()),
        url: Nullable(t.String()),
        state: State,
        final: Nullable(
          t.Object({
            label: t.String(),
            value: t.Number(),
            decidedBy: t.Union([t.Literal('agreed'), t.Literal('settled')]),
          }),
        ),
        open: t.Boolean(),
        leading: Nullable(Count),
        spread: Nullable(t.Object({ lowest: t.Number(), highest: t.Number() })),
        rounds: t.Integer(),
        durationSeconds: t.Integer(),
      }),
    ),
    totals: t.Object({
      topics: t.Integer(),
      decided: t.Integer(),
      rounds: t.Integer(),
      durationSeconds: t.Integer(),
      points: t.Number(),
    }),
  }),
)

const InvalidRead = t.Union([Err('invalid_slug'), Err('invalid_format')])

const Params = t.Object({ slug: t.String({ maxLength: 64 }) })
const Query = t.Object({ format: t.Optional(t.String({ maxLength: 16 })) })

const FORMATS = {
  json: undefined,
  csv: 'text/csv; charset=utf-8',
  markdown: 'text/markdown; charset=utf-8',
} as const

type Format = keyof typeof FORMATS

const formatOf = (input: string | undefined): Format | undefined => {
  if (input === undefined) return 'json'
  return (Object.keys(FORMATS) as Format[]).find((format) => format === input)
}

/** The two history routes; `api` is the composition root's `RoomsApi`. */
export function historyRoutes(api: Pick<RoomsApi, 'topics' | 'summary'>) {
  return new Elysia()
    .get(
      '/rooms/:slug/topics',
      {
        params: Params,
        query: Query,
        response: {
          200: t.Union([TopicsResponse, t.String()]),
          400: InvalidRead,
          403: Err('not_seated'),
          404: Err('unknown_room'),
          503: Err('unavailable'),
        },
      },
      async ({ params, query, headers, set, status }) => {
        const format = formatOf(query.format)
        if (format === undefined) return status(400, { error: 'invalid_format' })
        const result = await api.topics({
          slug: params.slug,
          token: bearer(headers['authorization']),
        })
        if (!result.ok) {
          switch (result.error) {
            case 'invalid_slug':
              return status(400, { error: result.error })
            case 'not_seated':
              return status(403, { error: result.error })
            case 'unknown_room':
              return status(404, { error: result.error })
            case 'unavailable':
              return status(503, { error: result.error })
          }
        }
        set.headers['cache-control'] = 'no-store'
        if (format === 'json') return status(200, result.body)
        set.headers['content-type'] = FORMATS[format]
        return status(
          200,
          format === 'csv' ? csvOfTopics(result.body) : markdownOfTopics(result.body),
        )
      },
    )
    .get(
      '/rooms/:slug/summary',
      {
        params: Params,
        query: Query,
        response: {
          200: t.Union([SummaryResponse, t.String()]),
          400: InvalidRead,
          403: Err('not_seated'),
          404: Err('unknown_room'),
          503: Err('unavailable'),
        },
      },
      async ({ params, query, headers, set, status }) => {
        const format = formatOf(query.format)
        if (format === undefined) return status(400, { error: 'invalid_format' })
        const result = await api.summary({
          slug: params.slug,
          token: bearer(headers['authorization']),
        })
        if (!result.ok) {
          switch (result.error) {
            case 'invalid_slug':
              return status(400, { error: result.error })
            case 'not_seated':
              return status(403, { error: result.error })
            case 'unknown_room':
              return status(404, { error: result.error })
            case 'unavailable':
              return status(503, { error: result.error })
          }
        }
        set.headers['cache-control'] = 'no-store'
        if (format === 'json') return status(200, result.body)
        set.headers['content-type'] = FORMATS[format]
        return status(
          200,
          format === 'csv' ? csvOfSummary(result.body) : markdownOfSummary(result.body),
        )
      },
    )
}
