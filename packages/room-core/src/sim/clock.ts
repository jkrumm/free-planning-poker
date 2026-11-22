/**
 * A deterministic source for the reducer's context: a clock that moves only when told and UUID v7 ids drawn from a
 * seeded generator. The same seed gives the same ids, so a run replays exactly. The simulator (v9-room-runtime) builds
 * on it.
 */
import type { Ctx } from '../state.ts'

/** mulberry32: a small seeded generator of 32-bit values. */
export function generator(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (t ^ (t >>> 14)) >>> 0
  }
}

const hex = (value: number, digits: number) =>
  value.toString(16).padStart(digits, '0').slice(-digits)

/** A UUID v7 for a millisecond time, its random bits from `next`. */
export function uuidv7(ms: number, next: () => number): string {
  const time = hex(Math.floor(ms / 0x10000), 8) + hex(ms % 0x10000, 4)
  const a = next()
  const b = next()
  const c = next()
  return [
    time.slice(0, 8),
    time.slice(8, 12),
    `7${hex(a & 0xfff, 3)}`,
    hex(0x8000 | ((a >>> 12) & 0x3fff), 4),
    hex(b, 8) + hex(c & 0xffff, 4),
  ].join('-')
}

/** 2026-01-01T00:00:00Z: where a seeded clock starts unless told otherwise. */
export const EPOCH = 1_767_225_600_000

export type SeededClock = {
  readonly now: () => number
  readonly advance: (ms: number) => void
  readonly newId: () => string
  /** The context for one step, at the clock's current time. */
  readonly ctx: () => Ctx
}

export function seededClock(seed: number, start: number = EPOCH): SeededClock {
  const next = generator(seed)
  let now = start
  const newId = () => uuidv7(now, next)
  return {
    now: () => now,
    advance: (ms) => {
      now += ms
    },
    newId,
    ctx: () => ({ now, newId }),
  }
}
