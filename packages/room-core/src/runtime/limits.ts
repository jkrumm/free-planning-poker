/**
 * The runtime's limits as plain data and pure functions, so the simulator can check them from the outside
 * (docs/v9/ARCHITECTURE.md, Protocol: limits from the first version). Every time is the clock port's.
 */

export const RUNTIME_LIMITS = {
  /** Frames a connection may send at once, and how many it earns back per second. */
  burst: 10,
  refillPerSecond: 5,
  /** One `fx` per seat in this many milliseconds, counted by the process that owns the room (fx are never stored). */
  fxIntervalMs: 2_000,
  /** Refused frames within `strikeWindowMs` that close a socket with 4008. */
  strikes: 10,
  strikeWindowMs: 10_000,
  /** Wrong access codes within `attemptWindowMs`: per room, per IP address; then a pause of `attemptBlockMs`. */
  roomAttempts: 10,
  addressAttempts: 5,
  attemptWindowMs: 60_000,
  attemptBlockMs: 60_000,
  /** The application heartbeat, and the silence after which a socket counts as dead. */
  pingIntervalMs: 25_000,
  silenceMs: 60_000,
  /** A seat whose last socket was lost is held this long, then `gone`. */
  holdMs: 120_000,
  /** A room with no socket is written and released this long after the last one closed. */
  unloadMs: 130_000,
  /** A snapshot is written this long after the change that made it stale. */
  snapshotDebounceMs: 250,
  /** Largest frame the runtime reads, in UTF-16 code units of the text. */
  maxFrame: 16 * 1024,
} as const

/** A token bucket: `tokens` as of `at`. */
export type Bucket = { readonly tokens: number; readonly at: number }

export const fullBucket = (now: number): Bucket => ({ tokens: RUNTIME_LIMITS.burst, at: now })

/** Takes one token if there is one: the new bucket, and whether the frame may pass. */
export function take(bucket: Bucket, now: number): { bucket: Bucket; ok: boolean } {
  const earned = ((now - bucket.at) * RUNTIME_LIMITS.refillPerSecond) / 1000
  const tokens = Math.min(RUNTIME_LIMITS.burst, bucket.tokens + Math.max(0, earned))
  if (tokens < 1) return { bucket: { tokens, at: now }, ok: false }
  return { bucket: { tokens: tokens - 1, at: now }, ok: true }
}

/** Times within a window, oldest first; returns the times still inside it after adding `now`. */
export function within(times: readonly number[], now: number, windowMs: number): number[] {
  return [...times.filter((time) => now - time < windowMs), now]
}

/** Wrong access codes of one key (a room or an IP address) and the pause they caused. */
export type Attempts = { readonly wrong: readonly number[]; readonly blockedUntil: number }

export const NO_ATTEMPTS: Attempts = { wrong: [], blockedUntil: 0 }

export const isBlocked = (attempts: Attempts, now: number): boolean => now < attempts.blockedUntil

/** Counts one wrong code; the `limit`-th within the window starts the pause and clears the count. */
export function countWrong(attempts: Attempts, now: number, limit: number): Attempts {
  const wrong = within(attempts.wrong, now, RUNTIME_LIMITS.attemptWindowMs)
  if (wrong.length >= limit) return { wrong: [], blockedUntil: now + RUNTIME_LIMITS.attemptBlockMs }
  return { wrong, blockedUntil: attempts.blockedUntil }
}

/** Whether an entry can be forgotten: no pause running and no wrong code inside the window. */
export const isSpent = (attempts: Attempts, now: number): boolean =>
  !isBlocked(attempts, now) &&
  attempts.wrong.every((time) => now - time >= RUNTIME_LIMITS.attemptWindowMs)
