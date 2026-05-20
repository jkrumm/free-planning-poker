/**
 * METRIC — the single source of truth for every metric instrument.
 *
 * fpp-server (the authoritative owner of room/user/connection state) is the
 * only emitter; the browser emits events, not metrics (spec §5 principle 5).
 * The facade instantiates concrete OTEL instruments from these descriptors
 * once at init, so the name + unit live here and nowhere else.
 *
 * Naming: dot-namespaced, instrument-suffixed, never `_total`, UCUM units in
 * metadata (not the name), generally not pluralized. See spec §4 and §8.
 *
 * Cardinality: NO metric carries `room.id` or `user.id`. The three `*.active`
 * gauges are observable (async callbacks sampling the authoritative `roomState`
 * Maps) — never manual ±1 — so a missed decrement can't orphan a series.
 */
export type MetricKind = 'counter' | 'histogram' | 'observable_updown';

export interface MetricDescriptor {
  /** Dot-namespaced instrument name, e.g. `fpp.action.count`. */
  name: string;
  kind: MetricKind;
  /** UCUM unit, e.g. `s`, `{action}`. */
  unit: string;
}

export const METRIC = {
  // Concurrency gauges — async callbacks read roomState each collection cycle
  USER_ACTIVE: {
    name: 'fpp.user.active',
    kind: 'observable_updown',
    unit: '{user}',
  },
  ROOM_ACTIVE: {
    name: 'fpp.room.active',
    kind: 'observable_updown',
    unit: '{room}',
  },
  CONNECTION_ACTIVE: {
    name: 'fpp.ws.connections.active',
    kind: 'observable_updown',
    unit: '{connection}',
  },
  // RED on the action layer
  ACTION_COUNT: { name: 'fpp.action.count', kind: 'counter', unit: '{action}' },
  ACTION_DURATION: {
    name: 'fpp.action.duration',
    kind: 'histogram',
    unit: 's',
  },
  // Event-style totals (synchronous counters at the mutation site)
  VOTE_CAST: { name: 'fpp.vote.cast', kind: 'counter', unit: '{vote}' },
  ROUND_FLIPPED: {
    name: 'fpp.round.flipped',
    kind: 'counter',
    unit: '{round}',
  },
  ROOM_CREATED: { name: 'fpp.room.created', kind: 'counter', unit: '{room}' },
  ROOM_CLOSED: { name: 'fpp.room.closed', kind: 'counter', unit: '{room}' },
} as const satisfies Record<string, MetricDescriptor>;

/** Every valid metric instrument name. */
export type MetricName = (typeof METRIC)[keyof typeof METRIC]['name'];
