import {
  index,
  integer,
  sqliteTableCreator,
  text,
} from "drizzle-orm/sqlite-core";

const getDefaultDate = () => Date.now();
const getUuid = () => crypto.randomUUID();

/**
 * Multi-project schema feature of Drizzle ORM. Use the same database instance for multiple projects.
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const sqliteTable = sqliteTableCreator((name) => `fpp_${name}`);

export const rooms = sqliteTable("rooms", {
  name: text("name").primaryKey().notNull(),
  lastUsedAt: integer("last_used_at").notNull(),
  firstUsedAt: integer("first_used_at").$defaultFn(getDefaultDate),
});

export const votes = sqliteTable(
  "votes",
  {
    id: integer("id").primaryKey(),
    room: text("room")
      .notNull()
      .references(() => rooms.name, { onDelete: "cascade" }),
    avgEstimation: integer("avg_estimation").notNull(),
    maxEstimation: integer("max_estimation").notNull(),
    minEstimation: integer("min_estimation").notNull(),
    finalEstimation: integer("final_estimation"),
    // TODO: change to amount_of_estimations
    amountOfEstimations: integer("amount_of_estimation").notNull(),
    amountOfSpectators: integer("amount_of_spectators").notNull(),
    duration: integer("duration").notNull(),
    votedAt: integer("voted_at").$defaultFn(getDefaultDate),
  },
  (table) => ({
    roomIdx: index("votes_room_idx").on(table.room),
  }),
);

export const visitors = sqliteTable("visitors", {
  id: text("id").primaryKey().$defaultFn(getUuid),
  device: text("device"),
  os: text("os"),
  browser: text("browser"),
  country: text("country"),
  region: text("region"),
  city: text("city"),
  firstVisitedAt: integer("first_visited_at").$defaultFn(getDefaultDate),
});

export const RouteType = {
  HOME: "HOME",
  CONTACT: "CONTACT",
  IMPRINT: "IMPRINT",
  ROOM: "ROOM",
  ANALYTICS: "ANALYTICS",
  ROADMAP: "ROADMAP",
} as const;

export const pageViews = sqliteTable(
  "page_views",
  {
    id: integer("id").primaryKey(),
    visitorId: text("visitor_id")
      .references(() => visitors.id, { onDelete: "cascade" })
      .notNull(),
    route: text("route", {
      enum: Object.keys(RouteType) as [string, ...string[]],
    }).notNull(),
    room: text("room"),
    viewedAt: integer("viewed_at").$defaultFn(getDefaultDate),
  },
  (table) => ({
    visitorIdx: index("page_views_visitor_idx").on(table.visitorId),
  }),
);

export const EventType = {
  CONTACT_FORM_SUBMISSION: "CONTACT_FORM_SUBMISSION",
} as const;

export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey(),
    visitorId: text("visitor_id")
      .references(() => visitors.id, { onDelete: "cascade" })
      .notNull(),
    event: text("event", {
      enum: Object.keys(EventType) as [string, ...string[]],
    }).notNull(),
  },
  (table) => ({
    visitorIdx: index("events_visitor_idx").on(table.visitorId),
  }),
);

export const estimations = sqliteTable(
  "estimations",
  {
    id: integer("id").primaryKey(),
    visitorId: text("visitor_id")
      .references(() => visitors.id, { onDelete: "cascade" })
      .notNull(),
    room: text("room").notNull(),
    estimation: integer("estimation"),
    spectator: integer("spectator", { mode: "boolean" })
      .default(false)
      .notNull(),
    estimatedAt: integer("estimated_at").$defaultFn(getDefaultDate).notNull(),
  },
  (table) => ({
    visitorIdx: index("estimations_visitor_idx").on(table.visitorId),
  }),
);

export const FeatureFlagType = {
  CONTACT_FORM: "CONTACT_FORM",
} as const;

export const featureFlags = sqliteTable("feature_flags", {
  id: integer("id").primaryKey(),
  name: text("name", {
    enum: Object.keys(FeatureFlagType) as [string, ...string[]],
  }).notNull(),
  enabled: integer("enabled", { mode: "boolean" }).default(false).notNull(),
});
