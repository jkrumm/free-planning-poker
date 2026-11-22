/**
 * The runtime's clock port in production: the system time and one timer. Every call the runtime schedules (timers,
 * holds, the heartbeat, snapshot debounces) waits in one queue ordered by its time, and a single `setTimeout` is armed
 * for the earliest, so no other timer exists in this folder (docs/v9/ARCHITECTURE.md, Server).
 */
import type { Clock, TimerHandle } from '@fpp/room-core/server'

type Entry = {
  readonly at: number
  readonly order: number
  readonly run: () => void
  live: boolean
}

export type TimerClock = Clock & {
  /** Scheduled calls still waiting. */
  readonly pending: () => number
  /** Drops every waiting call and disarms the timer. */
  readonly stop: () => void
}

/** The longest delay `setTimeout` keeps; a later call is re-armed when it fires early. */
const MAX_DELAY = 2_147_483_647

const before = (a: Entry, b: Entry) => a.at < b.at || (a.at === b.at && a.order < b.order)

export function timerClock(deps: {
  readonly now: () => number
  /** A call that threw: reported, and the queue goes on. */
  readonly failed: (error: unknown) => void
}): TimerClock {
  const heap: Entry[] = []
  let order = 0
  let live = 0
  let armed: ReturnType<typeof setTimeout> | null = null
  let armedAt = Infinity

  const swap = (i: number, j: number) => {
    const entry = heap[i]!
    heap[i] = heap[j]!
    heap[j] = entry
  }
  const up = (index: number) => {
    let i = index
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (!before(heap[i]!, heap[parent]!)) return
      swap(i, parent)
      i = parent
    }
  }
  const down = (index: number) => {
    let i = index
    for (;;) {
      const left = 2 * i + 1
      const right = left + 1
      let least = i
      if (left < heap.length && before(heap[left]!, heap[least]!)) least = left
      if (right < heap.length && before(heap[right]!, heap[least]!)) least = right
      if (least === i) return
      swap(i, least)
      i = least
    }
  }
  const pop = (): Entry | undefined => {
    const top = heap[0]
    const last = heap.pop()
    if (top !== undefined && last !== undefined && heap.length > 0) {
      heap[0] = last
      down(0)
    }
    return top
  }
  /** Cancelled entries stay in the heap until they surface; the top is always a live one. */
  const prune = () => {
    while (heap.length > 0 && !heap[0]!.live) pop()
  }

  function arm() {
    prune()
    const next = heap[0]
    if (next === undefined) {
      if (armed !== null) clearTimeout(armed)
      armed = null
      armedAt = Infinity
      return
    }
    if (armed !== null && armedAt <= next.at) return
    if (armed !== null) clearTimeout(armed)
    armedAt = next.at
    armed = setTimeout(fire, Math.min(MAX_DELAY, Math.max(0, next.at - deps.now())))
  }

  function fire() {
    armed = null
    armedAt = Infinity
    const now = deps.now()
    for (prune(); heap.length > 0 && heap[0]!.at <= now; prune()) {
      const entry = pop()!
      entry.live = false
      live -= 1
      try {
        entry.run()
      } catch (error) {
        deps.failed(error)
      }
    }
    arm()
  }

  return {
    now: deps.now,
    schedule(at, run) {
      const entry: Entry = { at, order: order++, run, live: true }
      heap.push(entry)
      up(heap.length - 1)
      live += 1
      arm()
      return entry satisfies TimerHandle
    },
    cancel(handle) {
      const entry = handle as Entry
      if (!entry.live) return
      entry.live = false
      live -= 1
      if (heap[0] === entry) arm()
    },
    pending: () => live,
    stop() {
      for (const entry of heap) entry.live = false
      heap.length = 0
      live = 0
      arm()
    },
  }
}
