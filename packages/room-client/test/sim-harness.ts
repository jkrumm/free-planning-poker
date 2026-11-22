/**
 * The client on the simulator's transport: the real runtime on in-memory adapters, the seeded network between, and
 * room clients where the simulator has its own bots. A run is a pure function of its seed.
 */
import {
  project,
  createRoomRuntime,
  DEFAULT_SETTINGS,
  type RoomRuntime,
} from '@fpp/room-core/server'
import {
  checker,
  EPOCH,
  memoryHistory,
  memoryIds,
  memorySecrets,
  memoryStore,
  network,
  PROFILES,
  random,
  scheduler,
  telemetryRecorder,
  type Client,
  type Network,
  type Profile,
} from '@fpp/room-core/sim'
import { parseSlug } from '@fpp/room-core/types'
import { startBots, type BotBehaviour, type Bots } from '../src/bots.ts'
import type { ClientPorts, SocketConstructor, SocketLike } from '../src/ports.ts'
import type { RoomClient } from '../src/client.ts'
import { memoryStorage, signalsOf } from './support.ts'

export const ROOM = '1'
export const ADDRESS = '482913'

/** A WebSocket whose other end is the simulator's network, as the runtime sees any socket. */
export function simSockets(net: Network, ip: string): SocketConstructor {
  return function (this: unknown, _url: string): SocketLike {
    const socket: SocketLike = {
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send: (data) => net.send(link, JSON.parse(data) as object),
      close: (code) => {
        net.hangUp(link, false)
        queueMicrotask(() => socket.onclose?.({ code: code ?? 1005 }))
      },
    }
    const client: Client = {
      frame: (frame) => socket.onmessage?.({ data: JSON.stringify(frame) }),
      close: (code) => socket.onclose?.({ code }),
    }
    const link = net.connect(client, { room: ROOM, ip })
    queueMicrotask(() => socket.onopen?.({}))
    return socket
  } as unknown as SocketConstructor
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

export type RunOptions = {
  readonly trace?: (line: string) => void
  readonly seed: number
  readonly profile?: Profile
  readonly bots?: number
  readonly behaviour?: BotBehaviour
  readonly speed?: number
  /** How long the bots act, in simulated milliseconds. */
  readonly durationMs?: number
}

export function world(
  seed: number,
  profile: Profile = PROFILES.calm,
  trace: (line: string) => void = () => {},
) {
  const rng = random(seed)
  const clock = scheduler(EPOCH)
  const store = memoryStore()
  const telemetry = telemetryRecorder()
  const netProfile: Mutable<Profile> = { ...profile }
  store.rows.set(ROOM, {
    slug: parseSlug(ADDRESS)!,
    name: 'Sim Room',
    access: 'open',
    code: null,
    settings: DEFAULT_SETTINGS,
    accessEpoch: 0,
  })
  let runtime: RoomRuntime | undefined
  const check = checker({
    room: ROOM,
    now: clock.now,
    inspect: () => runtime?.inspect(ROOM),
    devices: () => [],
    codes: () => [],
    store,
    telemetry,
  })
  const net = network({ clock, rng, profile: netProfile, observer: check, trace })
  runtime = createRoomRuntime(
    {
      transport: net.transport,
      clock,
      ids: memoryIds(clock.now, rng.bits),
      secrets: memorySecrets,
      store,
      history: memoryHistory(),
      telemetry,
    },
    { build: 'sim' },
  )
  net.bind(runtime)

  const signals: ReturnType<typeof signalsOf>[] = []
  const portsFor = (n: number): ClientPorts => {
    const signal = signalsOf()
    signals[n] = signal
    return {
      WebSocket: simSockets(net, `10.0.0.${(n % 9) + 1}`),
      storage: memoryStorage(),
      timers: {
        now: clock.now,
        setTimeout: (run, ms) => clock.schedule(clock.now() + ms, run),
        clearTimeout: clock.cancel,
      },
      signals: signal.signals,
      random: rng.next,
    }
  }

  /** What the checker and the comparison with the server's projection run after every step. */
  const watched: RoomClient[] = []
  const violations: string[] = []
  const compared = new Map<RoomClient, { snapshot: unknown; seq: number }>()
  let caughtUp = 0
  const after = () => {
    check.step()
    const room = runtime?.inspect(ROOM)
    if (room === undefined) return
    for (const client of watched) {
      const snapshot = client.state.getSnapshot()
      const view = snapshot.view
      if (view === null) continue
      const last = compared.get(client)
      if (last?.snapshot === snapshot && last.seq === room.seq) continue
      compared.set(client, { snapshot, seq: room.seq })
      const current =
        snapshot.status === 'live' && snapshot.pending.length === 0 && snapshot.seq === room.seq
      check.viewed(view, current)
      if (!current || !room.state.seats.some((seat) => seat.index === view.self)) continue
      caughtUp += 1
      if (!Bun.deepEquals(view, project(room.state, view.self), true))
        violations.push(
          `seat ${view.self} at seq ${room.seq}: ${differ(view, project(room.state, view.self))}`,
        )
    }
  }

  return {
    rng,
    clock,
    net,
    check,
    store,
    signals,
    portsFor,
    violations,
    watched,
    inspect: () => runtime?.inspect(ROOM),
    caughtUp: () => caughtUp,
    advance: async (ms: number) => {
      // Sockets opened outside the scheduler announce themselves in a microtask.
      await Promise.resolve()
      await clock.run(clock.now() + ms, after, () => false)
    },
    /** From now on the network loses and delays nothing. */
    calm: () => Object.assign(netProfile, PROFILES.calm),
  }
}

export type World = ReturnType<typeof world>

/** Bots at a room under a hostile network, then a calm one so the last frames get through. */
export async function playBots(options: RunOptions) {
  const w = world(options.seed, options.profile ?? PROFILES.lossy, options.trace)
  const count = options.bots ?? w.rng.int(3, 6)
  const duration = options.durationMs ?? 30_000
  const bots: Bots = startBots({
    origin: 'http://sim.test',
    room: ADDRESS,
    seats: count,
    behaviour: options.behaviour ?? 'mixed',
    speed: options.speed ?? w.rng.pick([2, 4]),
    portsFor: w.portsFor,
    random: w.rng.next,
    until: EPOCH + duration,
  })
  // The clients exist once the staggered joins ran: watch whichever there are.
  const watch = () => {
    for (const client of bots.clients) if (!w.watched.includes(client)) w.watched.push(client)
  }
  for (let slice = 0; slice < duration / 1000; slice += 1) {
    await w.advance(1000)
    watch()
  }
  w.calm()
  for (const signal of w.signals) signal?.goOnline()
  await w.advance(30_000)
  watch()
  return { w, bots }
}

/** The first place two plain values differ, as a path and both values. */
function differ(a: unknown, b: unknown, path = 'view'): string {
  if (Bun.deepEquals(a, b, true)) return ''
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const inner = differ(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        `${path}.${key}`,
      )
      if (inner !== '') return inner
    }
  }
  return `${path}: ${JSON.stringify(a)} against ${JSON.stringify(b)}`
}
