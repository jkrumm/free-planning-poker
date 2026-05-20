/**
 * ATTR — the single source of truth for every telemetry attribute key.
 *
 * No raw attribute-key string literal exists anywhere else in the codebase;
 * the facades (`recordError`/`recordEvent`/`metrics.*`) accept only keys drawn
 * from here, so a stray `'roomId'` fails to typecheck. See the Observability v2
 * spec §4 (naming) and §5 (typed taxonomy).
 *
 * Naming: lowercase snake_case within `.`-delimited segments, domain-first for
 * business concepts (`room.*`, `user.*`, `vote.*`, `round.*`). `fpp.*` is
 * reserved strictly for the facade's cross-cutting metadata that is *not* a
 * business concept. `otel.*` is forbidden by the OTEL spec.
 */
export const ATTR = {
  // Room
  ROOM_ID: 'room.id',
  ROOM_USER_COUNT: 'room.user_count',
  ROOM_SPECTATOR_COUNT: 'room.spectator_count',
  ROOM_AUTOFLIP_ENABLED: 'room.autoflip_enabled',
  // User
  USER_ID: 'user.id',
  USER_NAME: 'user.name',
  USER_IS_SPECTATOR: 'user.is_spectator',
  USER_IS_PRESENT: 'user.is_present',
  // Vote / round
  VOTE_VALUE: 'vote.value',
  ROUND_VOTE_COUNT: 'round.vote_count',
  ROUND_DISTINCT_VALUES: 'round.distinct_values',
  ROUND_CONSENSUS: 'round.consensus',
  ROUND_DURATION: 'round.duration',
  // Action / outcome discriminators
  ACTION_TYPE: 'action.type',
  FLIP_TRIGGER: 'flip.trigger',
  OUTCOME: 'outcome', // action RED only: ok | error
  CLOSE_REASON: 'close.reason',
  ERROR_TYPE: 'error.type', // bounded exception-class enum, never the message
  // Facade-proprietary cross-cutting metadata (not a business concept)
  FPP_COMPONENT: 'fpp.component',
  FPP_ACTION: 'fpp.action',
  FPP_SEVERITY: 'fpp.severity',
  FPP_WS_CONNECTION_ID: 'fpp.ws.connection_id',
} as const;

/** Every valid attribute key. A raw `'roomId'` is not assignable. */
export type AttrKey = (typeof ATTR)[keyof typeof ATTR];

/** Attribute values we emit. Mirrors the OTEL AnyValue primitives we use. */
export type AttributeValue = string | number | boolean;

/**
 * Allowlisted attribute bag accepted by the facade verbs. Keyed by `AttrKey`,
 * so only registry-declared keys typecheck — this is the primary guardrail
 * (spec §11). Presence is not enforced per signal; call sites assemble the
 * relevant subset per the §7/§8 taxonomy.
 */
export type TelemetryAttributes = Partial<Record<AttrKey, AttributeValue>>;
