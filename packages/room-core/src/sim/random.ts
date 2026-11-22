/**
 * The simulator's one source of chance: every choice of a run (network, bots, admin actions) is drawn from here in
 * a fixed order, so a seed replays exactly.
 */
import { generator } from './clock.ts'

export type Random = {
  /** A float in [0, 1). */
  readonly next: () => number
  /** An integer in [min, max]. */
  readonly int: (min: number, max: number) => number
  readonly chance: (p: number) => boolean
  readonly pick: <T>(items: readonly T[]) => T
  /** 32 random bits, for an id source. */
  readonly bits: () => number
}

export function random(seed: number): Random {
  const bits = generator(seed)
  const next = () => bits() / 0x1_0000_0000
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new Error('pick from nothing')
      return items[Math.floor(next() * items.length)]!
    },
    bits,
  }
}
