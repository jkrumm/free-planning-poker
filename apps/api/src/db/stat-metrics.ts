/**
 * Every metric of `stat_daily`, named in one place (docs/v9/ARCHITECTURE.md, Data model). A row is (day, metric,
 * dimension, value): the day is a UTC date, the dimension is `''` for a metric without one, the value is a double
 * that holds a whole number for a count. Nothing is stored as a rate or an average: a rate is a ratio of two sums,
 * taken when it is read. A metric whose dimension has several values is sparse: a dimension with no count has no row.
 *
 * The day boundary is UTC midnight, the bucket edges are fixed here (an hour is [hh:00, hh+1:00) of `revealed_at`; a
 * card is the label the table showed), and the value encoding is the unit column below. Changing any of them breaks
 * the historical series, so a change is a new metric name.
 */

export type MetricSpec = {
  readonly name: string
  /** What the dimension holds; `null` for a metric without one. */
  readonly dimension: string | null
  readonly unit: string
  /** `job` rows are replaced by the daily rollup; `importer` names are reserved for v9-importer's legacy rows. */
  readonly owner: 'job' | 'importer'
  readonly means: string
}

export const METRIC = {
  /** Also the marker of a rolled day: the job writes it for every day it computes, a zero included. */
  rounds: 'rounds',
  votes: 'votes',
  roundsConsensus: 'rounds_consensus',
  roundsByHour: 'rounds_by_hour',
  roomsCreated: 'rooms_created',
  roomsActive: 'rooms_active',
  estimators: 'estimators',
  estimatorsNew: 'estimators_new',
  cardVotes: 'card_votes',
  pageViews: 'page_views',
  events: 'events',
} as const

export type MetricName = (typeof METRIC)[keyof typeof METRIC]

const METRICS: readonly MetricSpec[] = [
  {
    name: METRIC.rounds,
    dimension: null,
    unit: 'rounds',
    owner: 'job',
    means: 'rounds revealed on the day (by `round.revealed_at`)',
  },
  {
    name: METRIC.votes,
    dimension: null,
    unit: 'votes',
    owner: 'job',
    means:
      "votes cast in the rounds revealed on the day, special cards included; a round imported from v1 adds its summary's count",
  },
  {
    name: METRIC.roundsConsensus,
    dimension: null,
    unit: 'rounds',
    owner: 'job',
    means: 'rounds revealed on the day in which everyone who voted played the same estimate',
  },
  {
    name: METRIC.roundsByHour,
    dimension: 'UTC hour of the reveal, two digits: 00 to 23',
    unit: 'rounds',
    owner: 'job',
    means: 'rounds revealed in that hour of the day; the weekday comes from the day itself',
  },
  {
    name: METRIC.roomsCreated,
    dimension: null,
    unit: 'rooms',
    owner: 'job',
    means:
      'rooms created on the day by v9 (`room.created_at`, origin v9); v1 rooms come with the importer',
  },
  {
    name: METRIC.roomsActive,
    dimension: null,
    unit: 'rooms',
    owner: 'job',
    means: 'distinct rooms with a round revealed on the day',
  },
  {
    name: METRIC.estimators,
    dimension: null,
    unit: 'devices',
    owner: 'job',
    means: 'distinct devices that voted on the day (`visitor_day`)',
  },
  {
    name: METRIC.estimatorsNew,
    dimension: null,
    unit: 'devices',
    owner: 'job',
    means:
      'devices of the day with no earlier `visitor_day` row; `visitor_day` keeps 13 months, so a device back after that counts as new',
  },
  {
    name: METRIC.cardVotes,
    dimension:
      '<deck id>/<card label>, the first slash splits; every custom deck is `custom/` with no label',
    unit: 'votes',
    owner: 'job',
    means:
      'votes for a card in rounds revealed on the day, from the stored distribution. A custom deck names its cards freely, so its labels are never published',
  },
  {
    name: METRIC.pageViews,
    dimension: 'route',
    unit: 'views',
    owner: 'importer',
    means:
      "v1's page views per route and day; v9 measures visits in Umami, so only the importer writes it",
  },
  {
    name: METRIC.events,
    dimension: 'event name',
    unit: 'events',
    owner: 'importer',
    means: "v1's events per name and day; only the importer writes it",
  },
]

/** The metrics the rollup job replaces for a day: it never touches a row of another owner. */
export const JOB_METRICS: readonly string[] = METRICS.filter((m) => m.owner === 'job').map(
  (m) => m.name,
)

/** A deck whose cards are named by the people in the room, so its labels never leave the database. */
export const CUSTOM_DECK = 'custom'

/** The dimension of a card vote. */
export const cardDimension = (deck: string, label: string): string =>
  `${deck}/${deck === CUSTOM_DECK ? '' : label}`

/** The dimension of an hour of the day. */
export const hourDimension = (hour: number): string => String(hour).padStart(2, '0')
