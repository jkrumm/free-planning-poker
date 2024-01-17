import {
  type InferInsertModel,
  type InferSelectModel,
  relations,
} from 'drizzle-orm';
import {
  boolean,
  decimal,
  int,
  mediumint,
  mysqlEnum,
  mysqlTableCreator,
  smallint,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';
import { nanoid } from 'nanoid';

/**
 * Multi-project schema feature of Drizzle ORM. Use the same database instance for multiple projects.
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const mysqlTable = mysqlTableCreator((name) => `fpp_${name}`);

/**
 * ROOMS
 */

export const rooms = mysqlTable('rooms', {
  id: int('id').autoincrement().primaryKey().notNull(),
  number: mediumint('number').unique('rooms_number_unique_idx').notNull(),
  name: varchar('name', { length: 15 })
    .unique('rooms_name_unique_idx')
    .notNull(),
  firstUsedAt: timestamp('first_used_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at').defaultNow().onUpdateNow().notNull(),
});

export type IRoom = InferSelectModel<typeof rooms>;
export type ICreateRoom = InferInsertModel<typeof rooms>;

/**
 * VOTES
 */

export const votes = mysqlTable('votes', {
  id: int('id').autoincrement().primaryKey().notNull(),
  roomId: int('room_id').notNull(),
  avgEstimation: decimal('avg_estimation', {
    precision: 4,
    scale: 2,
  }).notNull(),
  maxEstimation: smallint('max_estimation').notNull(),
  minEstimation: smallint('min_estimation').notNull(),
  amountOfEstimations: smallint('amount_of_estimations').notNull(),
  amountOfSpectators: smallint('amount_of_spectators').notNull(),
  duration: smallint('duration').notNull(),
  wasAutoFlip: boolean('was_auto_flip').notNull(),
  votedAt: timestamp('voted_at').defaultNow().notNull(),
});

export type IVote = InferSelectModel<typeof votes>;
export type ICreateVote = InferInsertModel<typeof votes>;

export const votesRelations = relations(votes, ({ one }) => ({
  room: one(rooms, {
    fields: [votes.roomId],
    references: [rooms.id],
  }),
}));

/**
 * USERS
 */

export const users = mysqlTable('users', {
  id: varchar('id', { length: 21 }).primaryKey().$defaultFn(nanoid).notNull(),
  device: varchar('device', { length: 50 }),
  os: varchar('os', { length: 50 }),
  browser: varchar('browser', { length: 50 }),
  country: varchar('country', { length: 5 }),
  region: varchar('region', { length: 100 }),
  city: varchar('city', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type IUser = InferSelectModel<typeof users>;
export type ICreateUser = InferInsertModel<typeof users>;

/**
 * ESTIMATIONS
 */

export const estimations = mysqlTable('estimations', {
  id: int('id').primaryKey().autoincrement().notNull(),
  userId: varchar('user_id', { length: 21 }).notNull(),
  roomId: int('room_id').notNull(),
  estimation: smallint('estimation'),
  spectator: boolean('spectator').default(false).notNull(),
  estimatedAt: timestamp('estimated_at').defaultNow().notNull(),
});

export type IEstimation = InferSelectModel<typeof estimations>;
export type ICreateEstimation = InferInsertModel<typeof estimations>;

export const estimationsRelations = relations(estimations, ({ one }) => ({
  users: one(users, {
    fields: [estimations.userId],
    references: [users.id],
  }),
  rooms: one(rooms, {
    fields: [estimations.roomId],
    references: [rooms.id],
  }),
}));

/**
 * PAGE_VIEWS
 */

export const RouteType = {
  HOME: 'HOME',
  CONTACT: 'CONTACT',
  IMPRINT: 'IMPRINT',
  ROOM: 'ROOM',
  ANALYTICS: 'ANALYTICS',
  ROADMAP: 'ROADMAP',
} as const;

export const pageViews = mysqlTable('page_views', {
  id: int('id').primaryKey().autoincrement().notNull(),
  userId: varchar('user_id', { length: 21 }).notNull(),
  route: mysqlEnum('route', Object.values(RouteType) as [string]).notNull(),
  roomId: int('room_id'),
  viewedAt: timestamp('viewed_at').defaultNow().notNull(),
});

export type IPageView = InferSelectModel<typeof pageViews>;
export type ICreatePageView = InferInsertModel<typeof pageViews>;

export const pageViewsRelations = relations(pageViews, ({ one }) => ({
  users: one(users, {
    fields: [pageViews.roomId],
    references: [users.id],
  }),
}));

/**
 * EVENTS
 */

export const EventType = {
  // CONTACT FORM EVENTS
  CONTACT_FORM_SUBMISSION: 'CONTACT_FORM_SUBMISSION',
  // ENTER ROOM EVENTS
  ENTERED_RANDOM_ROOM: 'ENTERED_RANDOM_ROOM',
  ENTERED_NEW_ROOM: 'ENTERED_NEW_ROOM',
  ENTERED_EXISTING_ROOM: 'ENTERED_EXISTING_ROOM',
  ENTERED_RECENT_ROOM: 'ENTERED_RECENT_ROOM',
  // ROOM INTERACTION EVENTS
  LEFT_ROOM: 'LEFT_ROOM',
  COPIED_ROOM_LINK: 'COPIED_ROOM_LINK',
} as const;

export const RoomEvent = {
  ENTERED_RANDOM_ROOM: 'ENTERED_RANDOM_ROOM',
  ENTERED_RECENT_ROOM: 'ENTERED_RECENT_ROOM',
  ENTERED_ROOM_DIRECTLY: 'ENTERED_ROOM_DIRECTLY',
} as const;

export const events = mysqlTable('events', {
  id: int('id').primaryKey().autoincrement().notNull(),
  userId: varchar('user_id', { length: 21 }).notNull(),
  event: mysqlEnum('event', Object.keys(EventType) as [string]).notNull(),
  eventAt: timestamp('event_at').defaultNow().notNull(),
});

export type IEvent = InferSelectModel<typeof events>;
export type ICreateEvent = InferInsertModel<typeof events>;

export const eventsRelations = relations(events, ({ one }) => ({
  users: one(users, {
    fields: [events.userId],
    references: [users.id],
  }),
}));

/**
 * USERS_RELATIONS
 */

export const usersRelations = relations(users, ({ many }) => ({
  pageViews: many(pageViews),
  estimations: many(estimations),
  events: many(events),
}));

/**
 * ROOMS_RELATIONS
 */

export const roomsRelations = relations(rooms, ({ many }) => ({
  votes: many(votes),
  pageViews: many(pageViews),
  estimations: many(estimations),
}));

/** ------------------------------------------------------------------ */

/**
 * FEATURE_FLAGS
 */

export const FeatureFlagType = {
  CONTACT_FORM: 'CONTACT_FORM',
} as const;

export const featureFlags = mysqlTable('feature_flags', {
  name: mysqlEnum('name', Object.keys(FeatureFlagType) as [string])
    .unique('feature_flags_name_unique_idx')
    .notNull(),
  enabled: boolean('enabled').default(false).notNull(),
});
