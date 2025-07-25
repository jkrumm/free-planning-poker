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
  lastUsedAt: timestamp('last_used_at').defaultNow().notNull(),
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

/**
 * PAGE_VIEWS
 */
export const RouteType = {
  HOME: 'HOME',
  CONTACT: 'CONTACT',
  IMPRINT: 'IMPRINT',
  GUIDE: 'GUIDE',
  ROOM: 'ROOM',
  ANALYTICS: 'ANALYTICS',
  ROADMAP: 'ROADMAP',
} as const;

export const pageViews = mysqlTable('page_views', {
  id: int('id').primaryKey().autoincrement().notNull(),
  userId: varchar('user_id', { length: 21 }).notNull(),
  route: mysqlEnum('route', [
    'HOME',
    'CONTACT',
    'IMPRINT',
    'GUIDE',
    'ROOM',
    'ANALYTICS',
    'ROADMAP',
  ]).notNull(),
  roomId: int('room_id'),
  source: varchar('source', { length: 255 }),
  viewedAt: timestamp('viewed_at').defaultNow().notNull(),
});

export type IPageView = InferSelectModel<typeof pageViews>;
export type ICreatePageView = InferInsertModel<typeof pageViews>;

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
  CHANGED_ROOM_NAME: 'CHANGED_ROOM_NAME',
} as const;

export const RoomEvent = {
  ENTERED_RANDOM_ROOM: 'ENTERED_RANDOM_ROOM',
  ENTERED_RECENT_ROOM: 'ENTERED_RECENT_ROOM',
  ENTERED_ROOM_DIRECTLY: 'ENTERED_ROOM_DIRECTLY',
} as const;

export const events = mysqlTable('events', {
  id: int('id').primaryKey().autoincrement().notNull(),
  userId: varchar('user_id', { length: 21 }).notNull(),
  event: mysqlEnum('event', [
    'CONTACT_FORM_SUBMISSION',
    'ENTERED_RANDOM_ROOM',
    'ENTERED_NEW_ROOM',
    'ENTERED_EXISTING_ROOM',
    'ENTERED_RECENT_ROOM',
    'LEFT_ROOM',
    'COPIED_ROOM_LINK',
    'CHANGED_ROOM_NAME',
  ]).notNull(),
  eventAt: timestamp('event_at').defaultNow().notNull(),
});

export type IEvent = InferSelectModel<typeof events>;
export type ICreateEvent = InferInsertModel<typeof events>;

/**
 * FEATURE_FLAGS
 */
export const FeatureFlagType = {
  CONTACT_FORM: 'CONTACT_FORM',
} as const;

export const featureFlags = mysqlTable('feature_flags', {
  name: mysqlEnum('name', ['CONTACT_FORM'])
    .unique('feature_flags_name_unique_idx')
    .notNull(),
  enabled: boolean('enabled').default(false).notNull(),
});

export const votesRelations = relations(votes, ({ one }) => ({
  room: one(rooms, {
    fields: [votes.roomId],
    references: [rooms.id],
  }),
}));

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

export const pageViewsRelations = relations(pageViews, ({ one }) => ({
  users: one(users, {
    fields: [pageViews.userId],
    references: [users.id],
  }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  users: one(users, {
    fields: [events.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  pageViews: many(pageViews),
  estimations: many(estimations),
  events: many(events),
}));

export const roomsRelations = relations(rooms, ({ many }) => ({
  votes: many(votes),
  pageViews: many(pageViews),
  estimations: many(estimations),
}));
