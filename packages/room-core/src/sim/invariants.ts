/**
 * The simulator's invariants (docs/plan.yaml, v9-room-runtime, change 2), checked on every frame the runtime sends
 * and after every step of the run:
 *
 * - secrecy: no frame and no view holds another seat's card of a round still voting (property (a) of v9-room-core);
 * - a welcome's view is `project(state, seat)` at that moment, and a seat's caught-up view equals it too;
 * - `seq` rises by one per event in a room, and per socket;
 * - a vote counts for the round it names, at most one per seat per round (`check`), and every revealed card is the
 *   seat's latest accepted vote of that round;
 * - every acknowledged vote is in the view after a resume in the same round;
 * - a reclaimed seat never yields a vote cast before the reclaim;
 * - the limits hold: the token bucket per socket, one fx per seat in 2 s, the table's size;
 * - no frame, snapshot or telemetry carries a device id, and no frame to an unseated socket carries an access code;
 * - the runtime records no failure.
 */
import { check } from '../check.ts'
import { project } from '../project.ts'
import type { ServerFrame, View } from '../protocol/types.ts'
import { RUNTIME_LIMITS } from '../runtime/limits.ts'
import type { ConnectionId, RoomKey } from '../runtime/ports.ts'
import type { RoomSnapshot } from '../runtime/snapshot.ts'
import type { RoomState } from '../state.ts'
import type { SeatIndex } from '../values.ts'
import type { MemoryStore, TelemetryRecorder } from './adapters.ts'
import type { Observer } from './network.ts'

type Socket = {
  resume: boolean
  seat: SeatIndex | null
  seq: number
  answered: number[]
}

type Tracked = { readonly label: string; readonly mark: number }

export type Stats = {
  frames: number
  events: number
  welcomes: number
  resumes: number
  reclaims: number
  reveals: number
  closes: Record<string, number>
  /** Welcome views compared with `project` at the moment they were sent. */
  projected: number
  /** Caught-up client views compared with `project`. */
  caughtUp: number
}

export type Checker = Observer & {
  /** After each step of the run: the room's invariants and what the store and telemetry received. */
  readonly step: () => void
  /** A bot's view after it applied a frame; `self` is the seat it holds. */
  readonly viewed: (view: View, caughtUp: boolean) => void
  readonly violations: string[]
  readonly stats: Stats
}

/** Another seat's card in a round still voting: what no view may ever hold. */
export function foreignCards(view: View): string[] {
  return view.activity.rounds.flatMap((round) =>
    round.state === 'voting'
      ? round.votes
          .filter((vote) => vote.seat !== view.self && vote.card !== null)
          .map(
            (vote) => `seat ${view.self} sees the card of seat ${vote.seat} in round ${round.id}`,
          )
      : [],
  )
}

/** Structural equality of plain data, key order ignored. */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (let index = 0; index < a.length; index += 1) if (!same(a[index], b[index])) return false
    return true
  }
  if (Array.isArray(b)) return false
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = Object.keys(left)
  if (keys.length !== Object.keys(right).length) return false
  return keys.every((key) => key in right && same(left[key], right[key]))
}

/**
 * A view without its own hidden card, votes in seat order. Which own vote a client shows, and where, depends on which
 * acks reached it and when, so the caught-up comparison leaves it out; the resume and reveal checks hold it instead.
 */
const withoutOwnCard = (view: View): View => ({
  ...view,
  activity: {
    ...view.activity,
    rounds: view.activity.rounds.map((round) =>
      round.state === 'voting'
        ? {
            ...round,
            votes: round.votes
              .map((vote) => (vote.seat === view.self ? { ...vote, card: null } : vote))
              .toSorted((a, b) => a.seat - b.seat),
          }
        : round,
    ),
  },
})

/** Where two JSON texts first part, with a little context: enough to read a failure without the trace. */
const differ = (a: string, b: string): string => {
  let at = 0
  while (at < a.length && a[at] === b[at]) at += 1
  return `at ${at}: ${a.slice(Math.max(0, at - 60), at + 60)} | ${b.slice(Math.max(0, at - 60), at + 60)}`
}

const carries = (text: string, values: readonly string[]) =>
  values.some((value) => text.includes(value))

export function checker(world: {
  readonly room: RoomKey
  readonly now: () => number
  readonly inspect: () => RoomSnapshot | undefined
  readonly devices: () => readonly string[]
  /** Every access code the room has had, lower-cased. */
  readonly codes: () => readonly string[]
  readonly store: MemoryStore
  readonly telemetry: TelemetryRecorder
}): Checker {
  const violations: string[] = []
  const stats: Stats = {
    frames: 0,
    events: 0,
    welcomes: 0,
    resumes: 0,
    reclaims: 0,
    reveals: 0,
    closes: {},
    projected: 0,
    caughtUp: 0,
  }
  const sockets = new Map<ConnectionId, Socket>()
  /** The latest accepted vote of each seat, by round. */
  const tracked = new Map<string, Map<SeatIndex, Tracked>>()
  const reclaimed = new Map<SeatIndex, number>()
  const known = new Set<SeatIndex>()
  const fxAt = new Map<SeatIndex, number>()
  let current: { conn: ConnectionId; frame: Record<string, unknown> } | null = null
  let lastSeq: number | undefined
  let mark = 0
  let lastState: RoomState | undefined
  let written = 0
  let failures = 0

  const fail = (what: string) => {
    if (violations.length < 20) violations.push(`t=${world.now()} ${what}`)
  }

  const socket = (conn: ConnectionId): Socket => {
    let found = sockets.get(conn)
    if (found === undefined) {
      found = { resume: false, seat: null, seq: -1, answered: [] }
      sockets.set(conn, found)
    }
    return found
  }

  const votesOf = (round: string) => {
    let votes = tracked.get(round)
    if (votes === undefined) {
      votes = new Map()
      tracked.set(round, votes)
    }
    return votes
  }

  const forgetSeat = (seat: SeatIndex) => {
    for (const votes of tracked.values()) votes.delete(seat)
  }

  /** Frames a socket may have had answered since `t`: a full bucket, then the refill. */
  function bucket(conn: ConnectionId, s: Socket) {
    const now = world.now()
    s.answered.push(now)
    if (s.answered.length > 40) s.answered.shift()
    for (let i = 0; i < s.answered.length; i += 1) {
      const since = s.answered[i]!
      const allowed = RUNTIME_LIMITS.burst + ((now - since) * RUNTIME_LIMITS.refillPerSecond) / 1000
      if (s.answered.length - i > allowed + 1e-9) {
        fail(`${conn} had ${s.answered.length - i} frames answered within ${now - since} ms`)
        return
      }
    }
  }

  function welcome(
    conn: ConnectionId,
    s: Socket,
    frame: Extract<ServerFrame, { frame: 'welcome' }>,
  ) {
    stats.welcomes += 1
    const room = world.inspect()
    for (const problem of foreignCards(frame.view)) fail(`welcome: ${problem}`)
    if (room === undefined) return fail('a welcome from a room that is not loaded')
    const truth = project(room.state, frame.seat)
    if (!same(frame.view, truth))
      fail(
        `the welcome of seat ${frame.seat} is not project(state, seat) ${differ(JSON.stringify(frame.view), JSON.stringify(truth))}`,
      )
    else stats.projected += 1
    if (frame.seq !== room.seq) fail(`welcome seq ${frame.seq}, room seq ${room.seq}`)
    s.seat = frame.seat
    s.seq = frame.seq
    const round = frame.view.activity.rounds.find((r) => r.id === frame.view.activity.current)
    const own = round?.votes.find((vote) => vote.seat === frame.seat)
    if (s.resume) {
      stats.resumes += 1
      const accepted = round === undefined ? undefined : tracked.get(round.id)?.get(frame.seat)
      if (
        round?.state === 'voting' &&
        accepted !== undefined &&
        own?.card?.label !== accepted.label
      )
        fail(`seat ${frame.seat} resumed without its acknowledged vote ${accepted.label}`)
    } else if (known.has(frame.seat)) {
      stats.reclaims += 1
      reclaimed.set(frame.seat, mark)
      if (round?.state === 'voting' && own !== undefined)
        fail(`seat ${frame.seat} was reclaimed with its hidden vote`)
    }
    known.add(frame.seat)
  }

  function published(_room: RoomKey, frame: ServerFrame) {
    mark += 1
    if (frame.frame === 'fx') {
      const seat = frame.seat
      if (seat === undefined) return fail('an fx without its sender')
      const last = fxAt.get(seat)
      if (last !== undefined && world.now() - last < RUNTIME_LIMITS.fxIntervalMs)
        fail(`seat ${seat} sent two fx within ${world.now() - last} ms`)
      fxAt.set(seat, world.now())
      return
    }
    if (frame.frame !== 'evt') return
    stats.events += 1
    if (lastSeq !== undefined && frame.seq !== lastSeq + 1)
      fail(`seq ${frame.seq} follows ${lastSeq}`)
    lastSeq = frame.seq
    switch (frame.type) {
      case 'poker.voted': {
        const keys = Object.keys(frame.payload).toSorted().join(',')
        if (keys !== 'round,seat') fail(`poker.voted carries ${keys}`)
        const cast = current?.frame
        const by = current === null ? undefined : sockets.get(current.conn)?.seat
        const payload = cast?.['payload'] as Record<string, unknown> | undefined
        if (cast?.['frame'] !== 'cmd' || cast['type'] !== 'poker.vote' || by !== frame.payload.seat)
          return fail(`seat ${frame.payload.seat} voted without casting a vote`)
        if (payload?.['round'] !== frame.payload.round)
          return fail(
            `a vote naming round ${String(payload?.['round'])} counted for ${frame.payload.round}`,
          )
        votesOf(frame.payload.round).set(frame.payload.seat, {
          label: String(payload['card']),
          mark,
        })
        return
      }
      case 'poker.voteCleared':
        tracked.get(frame.payload.round)?.delete(frame.payload.seat)
        return
      case 'seat.left':
      case 'seat.kicked':
        return forgetSeat(frame.payload.seat)
      case 'seat.roleChanged':
        if (frame.payload.role === 'spectator') forgetSeat(frame.payload.seat)
        return
      case 'poker.revealed': {
        stats.reveals += 1
        const votes = tracked.get(frame.payload.round) ?? new Map<SeatIndex, Tracked>()
        for (const { seat, card } of frame.payload.votes) {
          const accepted = votes.get(seat)
          if (accepted === undefined) fail(`seat ${seat} revealed a vote no accepted command cast`)
          else if (accepted.label !== card.label)
            fail(
              `seat ${seat} revealed ${card.label}, its last accepted vote was ${accepted.label}`,
            )
          else if ((reclaimed.get(seat) ?? -1) > accepted.mark)
            fail(`reclaimed seat ${seat} yielded a vote cast before the reclaim`)
        }
        for (const seat of votes.keys())
          if (!frame.payload.votes.some((vote) => vote.seat === seat))
            fail(`the accepted vote of seat ${seat} is missing from the reveal`)
        tracked.delete(frame.payload.round)
        return
      }
      default:
        return
    }
  }

  return {
    violations,
    stats,
    published,
    received(conn, frame) {
      mark += 1
      const record =
        typeof frame === 'object' && frame !== null ? (frame as Record<string, unknown>) : {}
      current = { conn, frame: record }
      if (record['frame'] === 'hello') socket(conn).resume = typeof record['seatToken'] === 'string'
    },
    sent(conn, frame, text) {
      stats.frames += 1
      const s = socket(conn)
      if (carries(text, world.devices()))
        fail(`a ${frame.frame} frame to ${conn} carries a device id`)
      if (
        s.seat === null &&
        frame.frame !== 'welcome' &&
        carries(text.toLowerCase(), world.codes())
      )
        fail(`a ${frame.frame} frame to unseated ${conn} carries the access code`)
      switch (frame.frame) {
        case 'welcome':
          return welcome(conn, s, frame)
        case 'evt':
          if (frame.seq <= s.seq) fail(`${conn} got seq ${frame.seq} after ${s.seq}`)
          s.seq = frame.seq
          return
        case 'ack':
        case 'pong':
          return bucket(conn, s)
        case 'nack':
          if (frame.reason !== 'rate_limited') bucket(conn, s)
          return
        default:
          return
      }
    },
    closed(conn, code) {
      stats.closes[code] = (stats.closes[code] ?? 0) + 1
      sockets.delete(conn)
    },
    viewed(view, caughtUp) {
      for (const problem of foreignCards(view)) fail(`client view: ${problem}`)
      if (!caughtUp) return
      const room = world.inspect()
      if (room === undefined || !room.state.seats.some((seat) => seat.index === view.self)) return
      // Every eighth seq: views grow with the topic list, and the other seeds cover the seqs between.
      if (room.seq % 8 !== 0) return
      stats.caughtUp += 1
      const seen = withoutOwnCard(view)
      const truth = withoutOwnCard(project(room.state, view.self))
      if (!same(seen, truth))
        fail(
          `the caught-up view of seat ${view.self} differs from project(state, seat) ${differ(JSON.stringify(seen), JSON.stringify(truth))}`,
        )
    },
    step() {
      current = null
      const room = world.inspect()
      if (room !== undefined && room.state !== lastState) {
        lastState = room.state
        for (const problem of check(room.state)) fail(`check: ${problem}`)
      }
      // Every eighth snapshot written: each holds the whole room, and a device id would stay in all that follow.
      for (; written < world.store.written.length; written += 1) {
        if (written % 8 !== 0) continue
        if (carries(JSON.stringify(world.store.written[written]), world.devices()))
          fail('a snapshot carries a device id')
      }
      for (; failures < world.telemetry.failures.length; failures += 1) {
        const { error, action } = world.telemetry.failures[failures]!
        fail(
          `runtime failure in ${action}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    },
  }
}
