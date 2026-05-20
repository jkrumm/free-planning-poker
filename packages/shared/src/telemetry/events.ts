/**
 * EVENT — the single source of truth for every `event.name`.
 *
 * Emitted via `recordEvent(EVENT.X, attrs)` as OTEL log-based events (a log
 * record carrying `event.name` + INFO severity), never `span.addEvent()`
 * (deprecated by OTEP 4430). These carry per-action product analytics at full
 * cardinality — `room.id`/`user.id`/`vote.value` live here, not on metrics.
 * See spec §3 (signal matrix) and §7 (event taxonomy).
 *
 * Names: domain-first, dotted (`room.joined`, `vote.cast`, `round.flipped`).
 */
export const EVENT = {
  // Room lifecycle
  ROOM_CREATED: 'room.created',
  ROOM_JOINED: 'room.joined',
  ROOM_LEFT: 'room.left',
  ROOM_CLOSED: 'room.closed',
  ROOM_RENAMED: 'room.renamed',
  ROOM_AUTOFLIP_CHANGED: 'room.autoflip_changed',
  // Voting
  VOTE_CAST: 'vote.cast',
  VOTE_CLEARED: 'vote.cleared',
  ROUND_FLIPPED: 'round.flipped',
  ROUND_RESET: 'round.reset',
  // User
  USER_KICKED: 'user.kicked',
  USER_RENAMED: 'user.renamed',
  USER_SPECTATOR_CHANGED: 'user.spectator_changed',
  USER_PRESENCE_CHANGED: 'user.presence_changed',
  // Connection
  WS_CONNECTED: 'ws.connected',
  WS_DISCONNECTED: 'ws.disconnected',
  WS_RECONNECTED: 'ws.reconnected',
  // Client-only (W) connection-recovery signals the server can't observe.
  WS_RECONNECT_EXHAUSTED: 'ws.reconnect_exhausted',
  WS_RECOVERY_RELOAD: 'ws.recovery_reload',
} as const;

/** Every valid `event.name`. A raw `'vote.casted'` typo is not assignable. */
export type EventName = (typeof EVENT)[keyof typeof EVENT];
