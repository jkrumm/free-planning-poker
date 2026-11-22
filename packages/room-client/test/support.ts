/**
 * Helpers for the client tests: a clock that moves when told, sockets a test drives by hand, a storage in memory, and
 * a room's view from the real reducer.
 */
import { initialState, project, step } from '@fpp/room-core/server'
import { seededClock } from '@fpp/room-core/sim'
import {
  parseSlug,
  type Command,
  type SeatIndex,
  type ServerFrame,
  type View,
} from '@fpp/room-core/types'
import type {
  ClientPorts,
  SocketConstructor,
  SocketLike,
  StorageLike,
  Timers,
} from '../src/ports.ts'

export type FakeClock = Timers & {
  /** Runs every timer due within `ms`, in order of time, each at its own time. */
  readonly advance: (ms: number) => void
}

export function fakeClock(start = 1_700_000_000_000): FakeClock {
  let now = start
  let serial = 0
  const queue: { readonly at: number; readonly n: number; readonly run: () => void }[] = []
  return {
    now: () => now,
    setTimeout: (run, ms) => {
      serial += 1
      const entry = { at: now + ms, n: serial, run }
      queue.push(entry)
      return entry
    },
    clearTimeout: (handle) => {
      const index = queue.indexOf(handle as (typeof queue)[number])
      if (index !== -1) queue.splice(index, 1)
    },
    advance: (ms) => {
      const until = now + ms
      for (;;) {
        queue.sort((a, b) => a.at - b.at || a.n - b.n)
        const next = queue[0]
        if (next === undefined || next.at > until) break
        queue.shift()
        now = Math.max(now, next.at)
        next.run()
      }
      now = until
    },
  }
}

export class FakeSocket implements SocketLike {
  onopen: SocketLike['onopen'] = null
  onmessage: SocketLike['onmessage'] = null
  onclose: SocketLike['onclose'] = null
  onerror: SocketLike['onerror'] = null
  readonly sent: Record<string, unknown>[] = []
  closedWith: number | null = null
  constructor(readonly url: string) {}
  send(data: string) {
    this.sent.push(JSON.parse(data) as Record<string, unknown>)
  }
  close(code?: number) {
    this.closedWith = code ?? 1005
  }
  /** The handshake finished. */
  open() {
    this.onopen?.({})
  }
  /** What the server sends. */
  serve(frame: object) {
    this.onmessage?.({ data: JSON.stringify(frame) })
  }
  /** The server (or the network) ends the connection. */
  end(code: number) {
    this.onclose?.({ code })
  }
  get hello(): Record<string, unknown> | undefined {
    return this.sent.find((frame) => frame['frame'] === 'hello')
  }
  commands(): Record<string, unknown>[] {
    return this.sent.filter((frame) => frame['frame'] === 'cmd')
  }
}

export function fakeSockets() {
  const sockets: FakeSocket[] = []
  const constructor = function (url: string) {
    const socket = new FakeSocket(url)
    sockets.push(socket)
    return socket
  } as unknown as SocketConstructor
  return {
    WebSocket: constructor,
    sockets,
    get last(): FakeSocket {
      const socket = sockets.at(-1)
      if (socket === undefined) throw new Error('no socket was opened')
      return socket
    },
  }
}

export type MemoryStorage = StorageLike & { readonly items: Map<string, string> }

export function memoryStorage(initial: Record<string, string> = {}): MemoryStorage {
  const items = new Map(Object.entries(initial))
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  }
}

export function signalsOf() {
  const online = new Set<() => void>()
  const visible = new Set<() => void>()
  return {
    signals: {
      onOnline: (listener: () => void) => {
        online.add(listener)
        return () => void online.delete(listener)
      },
      onVisible: (listener: () => void) => {
        visible.add(listener)
        return () => void visible.delete(listener)
      },
    },
    goOnline: () => online.forEach((listener) => listener()),
    show: () => visible.forEach((listener) => listener()),
  }
}

export const SLUG = parseSlug('482913')!

/** A room with the given seats, its view for each, and a way to run commands: the server's side of a unit test. */
export function table(seats: readonly string[] = ['Ada', 'Bo'], options: { code?: string } = {}) {
  const clock = seededClock(3)
  const code = options.code === undefined ? undefined : (options.code as never)
  let state = initialState(
    {
      slug: SLUG,
      name: 'Team Alpha',
      ...(code === undefined ? {} : { access: 'locked' as const, code }),
    },
    clock.ctx(),
  )
  const indexes: SeatIndex[] = seats.map((name) => {
    const result = step(
      state,
      {
        by: 'server',
        command: { type: 'seat.join', payload: { name, avatar: name, role: 'player' } },
      },
      clock.ctx(),
    )
    if (!result.ok) throw new Error('join refused')
    state = result.state
    return state.seats.at(-1)!.index
  })
  return {
    indexes,
    view: (seat = 0): View => project(state, indexes[seat]!),
    round: () => state.activity.rounds.find((round) => round.id === state.activity.current)!,
    run(seat: number, command: Command) {
      const result = step(
        state,
        { by: indexes[seat]!, id: `t${state.applied.length + 1}`, command },
        clock.ctx(),
      )
      if (!result.ok) throw new Error(`refused: ${result.reason}`)
      state = result.state
      return result.events
    },
  }
}

export const welcomeFrame = (view: View, seq: number, seatToken = 'token-1'): ServerFrame => ({
  frame: 'welcome',
  v: 1,
  build: 'test',
  seat: view.self,
  seatToken,
  seq,
  view,
})

export function portsOf(
  sockets: { readonly WebSocket: SocketConstructor },
  clock: Timers,
  storage: StorageLike,
  extra: Partial<ClientPorts> = {},
): ClientPorts {
  return {
    WebSocket: sockets.WebSocket,
    storage,
    timers: clock,
    signals: signalsOf().signals,
    random: () => 0.5,
    ...extra,
  }
}
