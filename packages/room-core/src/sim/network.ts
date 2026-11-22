/**
 * The simulator's network: the runtime's transport port on one side, simulated clients on the other, and between
 * them a seeded network that delays, drops, duplicates and reorders frames and cuts connections. Frames cross it as
 * JSON text, as they would a socket.
 */
import type { ServerFrame } from '../protocol/types.ts'
import type { RoomRuntime } from '../runtime/runtime.ts'
import type { ConnectionId, RoomKey, Transport } from '../runtime/ports.ts'
import type { Random } from './random.ts'
import type { Scheduler } from './scheduler.ts'

/** How hostile the network of one run is. Probabilities are per frame. */
export type Profile = {
  readonly name: string
  readonly drop: number
  readonly duplicate: number
  /** A frame that may overtake the frames sent before it on its link. */
  readonly reorder: number
  readonly delay: readonly [number, number]
  readonly spike: number
  readonly spikeDelay: readonly [number, number]
  /** The link is cut after this frame: half of the cuts tell both sides, half tell nobody. */
  readonly cut: number
}

export const PROFILES = {
  calm: {
    name: 'calm',
    drop: 0,
    duplicate: 0,
    reorder: 0,
    delay: [5, 40],
    spike: 0,
    spikeDelay: [0, 0],
    cut: 0,
  },
  lossy: {
    name: 'lossy',
    drop: 0.003,
    duplicate: 0.003,
    reorder: 0.01,
    delay: [10, 120],
    spike: 0.02,
    spikeDelay: [300, 3000],
    cut: 0.001,
  },
  hostile: {
    name: 'hostile',
    drop: 0.01,
    duplicate: 0.01,
    reorder: 0.03,
    delay: [20, 300],
    spike: 0.05,
    spikeDelay: [500, 8000],
    cut: 0.003,
  },
} as const satisfies Record<string, Profile>

/** What a simulated client hears. */
export type Client = {
  readonly frame: (frame: ServerFrame) => void
  readonly close: (code: number) => void
}

export type Link = {
  readonly conn: ConnectionId
  readonly client: Client
  /** A probe's link: no delay, no loss, no cut. */
  readonly perfect: boolean
  /** The runtime still holds the socket. */
  serverOpen: boolean
  /** The client still holds the socket. */
  clientOpen: boolean
  /** Frames are lost both ways and nobody is told: a phone asleep. */
  asleep: boolean
  /** When the last frame in each direction arrives, so a frame waits for those before it. */
  up: number
  down: number
}

/** What the invariant checker sees of the traffic, as the runtime sends and receives it. */
export type Observer = {
  readonly received: (conn: ConnectionId, frame: unknown) => void
  readonly sent: (conn: ConnectionId, frame: ServerFrame, text: string) => void
  readonly published: (room: RoomKey, frame: ServerFrame) => void
  readonly closed: (conn: ConnectionId, code: number) => void
}

export type Network = {
  readonly transport: Transport
  /** The runtime frames are delivered to; a deploy swaps it. */
  readonly bind: (runtime: RoomRuntime) => void
  readonly connect: (
    client: Client,
    at: { readonly room: RoomKey; readonly ip: string; readonly perfect?: boolean },
  ) => Link
  readonly send: (link: Link, frame: object) => void
  /** The client closes the socket; `silent` when the server is never told (the radio went away). */
  readonly hangUp: (link: Link, silent: boolean) => void
  readonly sleep: (link: Link) => void
}

const summary = (frame: Record<string, unknown>): string => {
  switch (frame['frame']) {
    case 'hello':
      return `hello ${String(frame['name'])}${frame['seatToken'] === undefined ? '' : ' resume'}`
    case 'welcome':
      return `welcome seat=${String(frame['seat'])} seq=${String(frame['seq'])}`
    case 'cmd':
      return `cmd ${String(frame['id'])} ${String(frame['type'])}`
    case 'evt':
      return `evt ${String(frame['seq'])} ${String(frame['type'])}`
    case 'ack':
      return `ack ${String(frame['id'])}`
    case 'nack':
      return `nack ${String(frame['id'])} ${String(frame['reason'])}`
    case 'fx':
      return `fx ${String(frame['type'])}`
    default:
      return String(frame['frame'])
  }
}

export function network(world: {
  readonly clock: Scheduler
  readonly rng: Random
  readonly profile: Profile
  readonly observer: Observer
  readonly trace: (line: string) => void
}): Network {
  const { clock, rng, profile, observer, trace } = world
  const links = new Map<ConnectionId, Link>()
  const topics = new Map<RoomKey, Set<ConnectionId>>()
  let runtime: RoomRuntime | undefined
  let count = 0

  const delay = (link: Link): number => {
    if (link.perfect) return 1
    const base = rng.int(profile.delay[0], profile.delay[1])
    return rng.chance(profile.spike)
      ? base + rng.int(profile.spikeDelay[0], profile.spikeDelay[1])
      : base
  }

  /** When a frame sent now arrives: after the frames before it, unless it overtakes them. */
  const arrival = (link: Link, last: number): number => {
    const at = clock.now() + delay(link)
    if (!link.perfect && rng.chance(profile.reorder)) return at
    return Math.max(at, last + 1)
  }

  const lossy = (link: Link, p: number) => !link.perfect && rng.chance(p)

  function cut(link: Link) {
    const told = rng.chance(0.5)
    trace(`${clock.now()} ${link.conn} cut${told ? '' : ' silent'}`)
    if (!told) {
      link.asleep = true
      return
    }
    const at = clock.now() + delay(link)
    clock.at(at, () => {
      if (!link.clientOpen) return
      link.clientOpen = false
      link.client.close(1006)
    })
    clock.at(at, () => serverLost(link))
  }

  function serverLost(link: Link) {
    if (!link.serverOpen) return
    link.serverOpen = false
    runtime?.closed(link.conn)
  }

  function down(link: Link, copy: ServerFrame) {
    if (!link.serverOpen || link.asleep || lossy(link, profile.drop)) return
    const copies = lossy(link, profile.duplicate) ? 2 : 1
    for (let sent = 0; sent < copies; sent += 1) {
      const at = arrival(link, link.down)
      link.down = Math.max(link.down, at)
      clock.at(at, () => {
        if (!link.clientOpen || link.asleep) return
        link.client.frame(copy)
      })
    }
    if (lossy(link, profile.cut)) cut(link)
  }

  /**
   * One frame to one socket. The caller makes its text and the copy the client receives once, so a published frame
   * is serialised once for the whole room; clients treat what they receive as read-only.
   */
  function deliver(conn: ConnectionId, frame: ServerFrame, text: string, copy: ServerFrame) {
    observer.sent(conn, frame, text)
    trace(`${clock.now()} ${conn} < ${summary(frame as unknown as Record<string, unknown>)}`)
    const link = links.get(conn)
    if (link) down(link, copy)
  }

  const transport: Transport = {
    send(conn, frame) {
      const text = JSON.stringify(frame)
      deliver(conn, frame, text, JSON.parse(text) as ServerFrame)
    },
    subscribe(conn, room) {
      const topic = topics.get(room) ?? new Set<ConnectionId>()
      topic.add(conn)
      topics.set(room, topic)
    },
    unsubscribe(conn, room) {
      topics.get(room)?.delete(conn)
    },
    publish(room, frame) {
      observer.published(room, frame)
      const text = JSON.stringify(frame)
      const copy = JSON.parse(text) as ServerFrame
      for (const conn of Array.from(topics.get(room) ?? [])) deliver(conn, frame, text, copy)
    },
    close(conn, code) {
      observer.closed(conn, code)
      trace(`${clock.now()} ${conn} x ${code}`)
      for (const topic of topics.values()) topic.delete(conn)
      const link = links.get(conn)
      if (link === undefined || !link.serverOpen) return
      link.serverOpen = false
      const at = arrival(link, link.down)
      link.down = Math.max(link.down, at)
      clock.at(at, () => {
        if (!link.clientOpen || link.asleep) return
        link.clientOpen = false
        link.client.close(code)
      })
    },
  }

  return {
    transport,
    bind(next) {
      runtime = next
      for (const topic of topics.values()) topic.clear()
    },
    connect(client, at) {
      count += 1
      const conn = `c${count}`
      const now = clock.now()
      const link: Link = {
        conn,
        client,
        perfect: at.perfect === true,
        serverOpen: true,
        clientOpen: true,
        asleep: false,
        up: now,
        down: now,
      }
      links.set(conn, link)
      trace(`${now} ${conn} open`)
      runtime?.open(conn, { room: at.room, ip: at.ip })
      return link
    },
    send(link, frame) {
      if (!link.clientOpen || link.asleep || lossy(link, profile.drop)) return
      const text = JSON.stringify(frame)
      const copies = lossy(link, profile.duplicate) ? 2 : 1
      const target = runtime
      for (let sent = 0; sent < copies; sent += 1) {
        const at = arrival(link, link.up)
        link.up = Math.max(link.up, at)
        clock.at(at, async () => {
          if (!link.serverOpen || link.asleep || target !== runtime || target === undefined) return
          const parsed: unknown = JSON.parse(text)
          trace(`${clock.now()} ${link.conn} > ${summary(parsed as Record<string, unknown>)}`)
          observer.received(link.conn, parsed)
          await target.receive(link.conn, text)
        })
      }
      if (lossy(link, profile.cut)) cut(link)
    },
    hangUp(link, silent) {
      if (!link.clientOpen) return
      link.clientOpen = false
      trace(`${clock.now()} ${link.conn} hang up${silent ? ' silent' : ''}`)
      if (silent) {
        link.asleep = true
        return
      }
      clock.at(clock.now() + delay(link), () => serverLost(link))
    },
    sleep(link) {
      link.asleep = true
      trace(`${clock.now()} ${link.conn} asleep`)
    },
  }
}
