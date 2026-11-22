import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/** Every table lives in the Postgres schema `fpp`; the drizzle journal lives there too (drizzle.config.ts). */
export const fpp = pgSchema('fpp')

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => 'bytea',
})

/**
 * A jsonb column that takes the value itself. Drizzle's own `jsonb` hands the driver `JSON.stringify(value)`, and bun-sql
 * stores a string as a JSON string (`jsonb_typeof` is `string`); the object goes to the driver as it is and is stored as
 * the array or object it is. A row the previous release wrote still holds a JSON string; it is read as the value inside, as
 * Drizzle's jsonb does, until the migration has rewritten it and that release is gone.
 */
const jsonbValue = <T>(name: string) =>
  customType<{ data: T; driverData: T }>({
    dataType: () => 'jsonb',
    toDriver: (value) => value,
    fromDriver: (value) => {
      if (typeof value !== 'string') return value
      try {
        return JSON.parse(value) as T
      } catch {
        return value as T
      }
    },
  })(name)

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

/**
 * Nothing in these tables names a person, a device or a network address: no display name, no IP address, no user
 * agent (docs/v9/ARCHITECTURE.md, Data model). Ids of topics and rounds are UUID v7, minted by the application.
 */

export const room = fpp.table(
  'room',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    name: text('name').notNull().default(''),
    settings: jsonbValue<unknown>('settings').notNull().default({}),
    access: text('access', { enum: ['open', 'locked'] })
      .notNull()
      .default('open'),
    /** Stored readable on purpose: it is shown to every seat (Room model, the lock). */
    accessCode: text('access_code'),
    accessEpoch: integer('access_epoch').notNull().default(0),
    origin: text('origin', { enum: ['v9', 'v1'] })
      .notNull()
      .default('v9'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    lastActiveAt: timestamptz('last_active_at').notNull().defaultNow(),
  },
  (t) => [
    check('room_locked_has_code', sql`${t.access} = 'open' OR ${t.accessCode} IS NOT NULL`),
    index('room_created_at_idx').on(t.createdAt),
  ],
)

/**
 * The namespace of every number and name that leads to a room. One lookup says free, held or released. A room has at
 * most one primary address (the partial unique index); the others redirect to it until `release_at`.
 */
export const roomSlug = fpp.table(
  'room_slug',
  {
    slug: text('slug').primaryKey(),
    roomId: bigint('room_id', { mode: 'number' })
      .notNull()
      .references(() => room.id),
    kind: text('kind', { enum: ['number', 'name'] }).notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    releaseAt: timestamptz('release_at').notNull(),
  },
  (t) => [
    uniqueIndex('room_slug_one_primary_per_room')
      .on(t.roomId)
      .where(sql`${t.isPrimary}`),
    index('room_slug_room_id_idx').on(t.roomId),
  ],
)

/**
 * Live state for restore and handoff. UNLOGGED: the migration says so (drizzle cannot express it), and a test reads
 * pg_class. Holds hidden votes and seat-token hashes; nothing but the owner process reads it.
 */
export const roomSnapshot = fpp.table('room_snapshot', {
  roomId: bigint('room_id', { mode: 'number' })
    .primaryKey()
    .references(() => room.id),
  /** Null between a claim and the first write, and after a claim that found an expired snapshot. */
  state: jsonbValue<unknown>('state'),
  seq: bigint('seq', { mode: 'number' }).notNull().default(0),
  epoch: bigint('epoch', { mode: 'number' }).notNull(),
  /** The claiming process; null after a release. */
  owner: text('owner'),
  updatedAt: timestamptz('updated_at').notNull(),
  expiresAt: timestamptz('expires_at').notNull(),
})

export const topic = fpp.table(
  'topic',
  {
    id: uuid('id').primaryKey(),
    roomId: bigint('room_id', { mode: 'number' })
      .notNull()
      .references(() => room.id),
    position: integer('position').notNull(),
    title: text('title').notNull().default(''),
    url: text('url'),
    source: text('source'),
    externalId: text('external_id'),
    externalKey: text('external_key'),
    externalSite: text('external_site'),
    state: text('state', { enum: ['queued', 'active', 'done', 'skipped'] })
      .notNull()
      .default('queued'),
    finalLabel: text('final_label'),
    /** The card's number; null for `?` and break. */
    finalValue: doublePrecision('final_value'),
    decidedBy: text('decided_by'),
    decidedAt: timestamptz('decided_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('topic_room_position_idx').on(t.roomId, t.position),
    // The same import can run twice: one topic per room, provider, site and tracker id (the key where no id is known).
    uniqueIndex('topic_tracker_ref_unique')
      .on(
        t.roomId,
        sql`coalesce(${t.source}, '')`,
        sql`coalesce(${t.externalSite}, '')`,
        sql`coalesce(${t.externalId}, ${t.externalKey})`,
      )
      .where(sql`coalesce(${t.externalId}, ${t.externalKey}) IS NOT NULL`),
  ],
)

export const round = fpp.table(
  'round',
  {
    id: uuid('id').primaryKey(),
    roomId: bigint('room_id', { mode: 'number' })
      .notNull()
      .references(() => room.id),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topic.id),
    /** Per room. */
    no: integer('no').notNull(),
    /** Per topic: a re-vote is the next attempt. */
    attempt: integer('attempt').notNull(),
    deck: jsonbValue<unknown>('deck').notNull(),
    startedAt: timestamptz('started_at').notNull(),
    revealedAt: timestamptz('revealed_at').notNull(),
    players: smallint('players').notNull(),
    spectators: smallint('spectators').notNull(),
    distribution: jsonbValue<unknown>('distribution').notNull(),
    consensus: boolean('consensus').notNull(),
    autoReveal: boolean('auto_reveal').notNull(),
    /**
     * Only a round imported from v1: what v1 kept of it ({average, lowest, highest, count}). It has no distribution, so
     * `distribution` holds `[]` and `deck` the Fibonacci id; null for every round played in v9.
     */
    summary: jsonbValue<unknown>('summary'),
  },
  (t) => [
    uniqueIndex('round_room_no_unique').on(t.roomId, t.no),
    uniqueIndex('round_topic_attempt_unique').on(t.topicId, t.attempt),
    // The daily rollup reads one UTC day of rounds (jobs/rollup.ts).
    index('round_revealed_at_idx').on(t.revealedAt),
  ],
)

/** One result per seat; a seat is an index in the room, never a name or a key that crosses rooms. */
export const roundVote = fpp.table(
  'round_vote',
  {
    roundId: uuid('round_id')
      .notNull()
      .references(() => round.id),
    seat: smallint('seat').notNull(),
    label: text('label').notNull(),
    value: doublePrecision('value'),
  },
  (t) => [primaryKey({ columns: [t.roundId, t.seat] })],
)

/** One row per device per day with a vote: a day and a 16-byte keyed hash, nothing else. */
export const visitorDay = fpp.table(
  'visitor_day',
  {
    day: date('day', { mode: 'string' }).notNull(),
    visitor: bytea('visitor').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.day, t.visitor] }),
    // "New estimators" asks whether a device appeared on an earlier day.
    index('visitor_day_visitor_idx').on(t.visitor, t.day),
    check('visitor_day_visitor_16_bytes', sql`octet_length(${t.visitor}) = 16`),
  ],
)

/** Rollups behind the public statistics page. An empty `dimension` means the metric has none. */
export const statDaily = fpp.table(
  'stat_daily',
  {
    day: date('day', { mode: 'string' }).notNull(),
    metric: text('metric').notNull(),
    dimension: text('dimension').notNull().default(''),
    value: doublePrecision('value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.day, t.metric, t.dimension] })],
)
