/** The client's waits, in milliseconds (docs/plan.yaml, v9-room-client, change 2). */
export const WAITS = {
  /** Full jitter: a wait is uniform between 0 and min(cap, base * 2^attempt). */
  backoffBaseMs: 500,
  backoffCapMs: 30_000,
  /** A connection that held this long counts the next loss as a first one. */
  stableMs: 60_000,
  /** After close 4002 the room moves: a uniform wait up to this. */
  drainMaxMs: 2_000,
  /** The status says `reconnecting` only after this long without a connection. */
  reconnectingAfterMs: 3_000,
  /** A socket with no `welcome` after this long is given up. */
  connectTimeoutMs: 10_000,
  /** A socket that heard nothing, pings included, for this long is dead (the server pings every 25 s). */
  silenceMs: 60_000,
  /** A page that becomes visible after this much silence replaces its socket without waiting. */
  staleMs: 30_000,
} as const

export function backoffDelay(attempt: number, random: () => number): number {
  const ceiling = Math.min(WAITS.backoffCapMs, WAITS.backoffBaseMs * 2 ** attempt)
  return Math.floor(random() * ceiling)
}

export const drainDelay = (random: () => number): number => Math.floor(random() * WAITS.drainMaxMs)
