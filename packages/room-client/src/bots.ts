/**
 * Development bots (docs/v9/ENGINEERING.md, The development loop): simulated participants that sit at a real room
 * through the room client, vote, reveal, move on, and some of them drop their connection and come back. One person
 * can fill a table with them. The command line is `scripts/bots.ts`; a test runs the same driver on the simulator's
 * transport.
 */
import { currentRound, ownSeat } from '@fpp/room-core/view'
import type { Command, View } from '@fpp/room-core/types'
import { createRoomClient, type RoomClient } from './client.ts'
import type { ClientPorts, SocketConstructor, SocketLike } from './ports.ts'

export const BOT_BEHAVIOURS = ['quick', 'lurker', 'sleeper', 'spectator', 'mixed'] as const
export type BotBehaviour = (typeof BOT_BEHAVIOURS)[number]
type Kind = Exclude<BotBehaviour, 'mixed'>

export type BotsOptions = {
  readonly origin: string
  /** The address of a room that exists. */
  readonly room: string
  readonly seats: number
  readonly behaviour: BotBehaviour
  /** 1 acts at the pace of people, 4 four times as fast. */
  readonly speed: number
  /** The bots stop acting at this time on their clock and stay seated; none by default. */
  readonly until?: number
  /** The access code of a locked room. */
  readonly code?: string
  /** The ports of bot `n`: its own storage, so each bot is its own device. */
  readonly portsFor: (n: number) => ClientPorts
  readonly random: () => number
}

export type Bots = {
  /** The bots started so far, in seat order. */
  readonly clients: readonly RoomClient[]
  readonly stop: () => void
}

/** How long a bot thinks between two acts, in milliseconds at speed 1. */
const THINK: Record<Kind, readonly [number, number]> = {
  quick: [800, 3_000],
  lurker: [4_000, 12_000],
  sleeper: [1_000, 4_000],
  spectator: [5_000, 15_000],
}

const MIX: readonly Kind[] = ['quick', 'quick', 'lurker', 'sleeper', 'spectator']
const JOIN_GAP_MS = 150
/** Close code a bot uses to cut its own connection: the client takes it for a lost one. */
const CUT = 4_000

/** A constructor that keeps the socket it made last, so a bot can cut its connection. */
function tracking(
  base: SocketConstructor,
  held: { current: SocketLike | null },
): SocketConstructor {
  // `new` on a function that returns an object yields that object: the base's own socket, seen on its way out.
  const watch = function (url: string) {
    const socket = new base(url)
    held.current = socket
    return socket
  }
  return watch as unknown as SocketConstructor
}

export function startBots(options: BotsOptions): Bots {
  const { random, speed } = options
  const clients: RoomClient[] = []
  const handles = new Set<{ readonly clear: () => void }>()
  let stopped = false

  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T
  const between = (low: number, high: number) => low + random() * (high - low)

  function seat(n: number) {
    const kind: Kind =
      options.behaviour === 'mixed' ? (MIX[n % MIX.length] ?? 'quick') : options.behaviour
    const base = options.portsFor(n)
    const held: { current: SocketLike | null } = { current: null }
    const ports: ClientPorts = { ...base, WebSocket: tracking(base.WebSocket, held) }
    const client = createRoomClient({
      slug: options.room,
      profile: { name: `Bot ${n + 1}`, avatar: `bot-${n + 1}` },
      ports,
      origin: options.origin,
      build: 'bots',
      ...(options.code === undefined ? {} : { code: options.code }),
    })
    clients.push(client)

    let timer: unknown = null
    handles.add({ clear: () => ports.timers.clearTimeout(timer) })
    const later = (ms: number, run: () => void) => {
      timer = ports.timers.setTimeout(run, Math.max(1, Math.round(ms / speed)))
    }
    const next = () => {
      if (stopped || (options.until !== undefined && ports.timers.now() >= options.until)) return
      later(between(...THINK[kind]), think)
    }

    const command = (c: Command) => void client.send(c)

    function play(view: View, kindNow: Kind) {
      const me = ownSeat(view)
      if (me === undefined) return
      if (kindNow === 'spectator') {
        if (me.role === 'player')
          command({ type: 'seat.setRole', payload: { seat: view.self, role: 'spectator' } })
        return
      }
      if (me.role !== 'player') return
      const round = currentRound(view)
      const asked = client.state.getSnapshot().ownVote
      const voted = round.votes.some((vote) => vote.seat === view.self) || asked?.round === round.id
      if (round.state === 'voting') {
        if (!voted)
          return command({
            type: 'poker.vote',
            payload: { round: round.id, card: pick(round.deck.cards).label },
          })
        const players = view.seats.filter(
          (other) => other.role === 'player' && other.presence === 'active',
        ).length
        if (round.votes.length >= players && random() < 0.5)
          command({ type: 'poker.reveal', payload: { round: round.id } })
        return
      }
      const roll = random()
      if (roll < 0.5) command({ type: 'topic.next', payload: { round: round.id } })
      else if (roll < 0.75) command({ type: 'poker.revote', payload: { round: round.id } })
    }

    function think() {
      const { status, view } = client.state.getSnapshot()
      if (status === 'live' && view !== null) {
        if (kind === 'sleeper' && random() < 0.04) held.current?.close(CUT)
        else play(view, kind)
      }
      next()
    }

    next()
  }

  for (let n = 0; n < options.seats; n += 1) {
    const starter = options.portsFor(n).timers
    const handle = starter.setTimeout(() => {
      if (!stopped) seat(n)
    }, n * JOIN_GAP_MS)
    handles.add({ clear: () => starter.clearTimeout(handle) })
  }

  return {
    clients,
    stop: () => {
      stopped = true
      for (const handle of handles) handle.clear()
      for (const client of clients) client.dispose()
    },
  }
}
