/**
 * A sliding window of submissions per client and over all clients (v1's `feedback.ts`, kept: three per client and 30
 * overall within 10 minutes). A submission counts from the moment it is let through, whether or not its upstream then
 * answers, because it cost the upstream a call. In memory, per process: a restart or a second process starts empty,
 * and the overall cap is what bounds a client that forges its key.
 */
export type RateLimit = {
  /** Seconds until the client may try again, or undefined and the attempt is counted. */
  readonly take: (client: string) => number | undefined
}

const WINDOW_MS = 10 * 60 * 1000
const PER_CLIENT = 3
const OVERALL = 30

export function createRateLimit(options: {
  readonly now: () => number
  readonly perClient?: number
  readonly overall?: number
  readonly windowMs?: number
}): RateLimit {
  const perClient = options.perClient ?? PER_CLIENT
  const overall = options.overall ?? OVERALL
  const windowMs = options.windowMs ?? WINDOW_MS
  const byClient = new Map<string, number[]>()
  let all: number[] = []

  return {
    take(client) {
      const now = options.now()
      const live = (stamps: readonly number[]) => stamps.filter((stamp) => now - stamp < windowMs)
      all = live(all)
      // Every key is swept, so a client that never returns leaves nothing behind.
      for (const [key, stamps] of byClient) {
        const kept = live(stamps)
        if (kept.length === 0) byClient.delete(key)
        else byClient.set(key, kept)
      }
      const mine = byClient.get(client) ?? []
      const oldest = mine.length >= perClient ? mine[0] : all.length >= overall ? all[0] : undefined
      if (oldest !== undefined) return Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
      all.push(now)
      byClient.set(client, [...mine, now])
      return undefined
    },
  }
}
