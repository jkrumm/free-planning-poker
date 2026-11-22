/**
 * The seeded scheduler: the simulator's clock port and its only queue. Network deliveries, bot decisions and the
 * runtime's timers are all entries here, run in order of time and then of scheduling, so a run is a pure function
 * of its seed.
 */
import type { Clock } from '../runtime/ports.ts'
import { EPOCH } from './clock.ts'

type Entry = {
  readonly at: number
  readonly n: number
  readonly run: () => unknown
  cancelled: boolean
}

export type Scheduler = Clock & {
  /** Schedules a call that may return a promise; `run` waits for it before the next entry. */
  readonly at: (at: number, run: () => unknown) => void
  /** Runs every entry due up to `until`, calling `after` once after each. Stops early when `stop` says so. */
  readonly run: (until: number, after: () => void, stop: () => boolean) => Promise<void>
  /** Entries run so far. */
  readonly steps: () => number
}

/** Lets promise chains started by an entry (a store write, a claim) settle before the next entry runs. */
async function settle() {
  for (let round = 0; round < 6; round += 1) await Promise.resolve()
}

const before = (a: Entry, b: Entry) => a.at < b.at || (a.at === b.at && a.n < b.n)

export function scheduler(start: number = EPOCH): Scheduler {
  const heap: Entry[] = []
  let now = start
  let count = 0
  let steps = 0

  const push = (entry: Entry) => {
    heap.push(entry)
    let index = heap.length - 1
    while (index > 0) {
      const parent = (index - 1) >> 1
      if (!before(heap[index]!, heap[parent]!)) break
      ;[heap[index], heap[parent]] = [heap[parent]!, heap[index]!]
      index = parent
    }
  }

  const pop = (): Entry | undefined => {
    const top = heap[0]
    const last = heap.pop()
    if (top === undefined || last === undefined || heap.length === 0) return top
    heap[0] = last
    let index = 0
    for (;;) {
      const left = index * 2 + 1
      const right = left + 1
      let smallest = index
      if (left < heap.length && before(heap[left]!, heap[smallest]!)) smallest = left
      if (right < heap.length && before(heap[right]!, heap[smallest]!)) smallest = right
      if (smallest === index) break
      ;[heap[index], heap[smallest]] = [heap[smallest]!, heap[index]!]
      index = smallest
    }
    return top
  }

  const add = (at: number, run: () => unknown): Entry => {
    count += 1
    const entry: Entry = { at: Math.max(at, now), n: count, run, cancelled: false }
    push(entry)
    return entry
  }

  return {
    now: () => now,
    schedule: (at, run) => add(at, run),
    cancel: (handle) => {
      ;(handle as Entry).cancelled = true
    },
    at: (at, run) => {
      add(at, run)
    },
    steps: () => steps,
    async run(until, after, stop) {
      for (;;) {
        const top = heap[0]
        if (top === undefined || top.at > until || stop()) break
        pop()
        if (top.cancelled) continue
        now = top.at
        steps += 1
        await top.run()
        await settle()
        after()
      }
      if (!stop()) now = Math.max(now, until)
    },
  }
}
