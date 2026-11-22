/**
 * The room runtime: what sits between the reducer and a socket (docs/v9/ARCHITECTURE.md, Server and Protocol). It
 * knows who a connection is, what a reconnect receives, when a silent seat is away, and how a flood is refused. All
 * I/O goes through the ports, all time through the clock port, so the API, the tests and the simulator run it alike.
 *
 * The room loop is synchronous: a frame runs through `step` to the end before the next. Only a `hello` for a room
 * that is not loaded waits, on the store's claim.
 */
import { seatOf as seatIn } from '../kernel/kernel.evolve.ts'
import { project } from '../project.ts'
import { CLOSE_CODES, PROTOCOL_VERSION } from '../protocol/names.ts'
import { CmdFrameSchema, FxFrameSchema, HelloFrameSchema } from '../protocol/schema.ts'
import type {
  Access,
  Command,
  Event,
  HelloFrame,
  NackReason,
  ServerCommand,
  ServerFrame,
} from '../protocol/types.ts'
import { initialState, step, type StepResult } from '../room.ts'
import type { Ctx, Effect, Input, RoomState, Timer } from '../state.ts'
import {
  type AccessCode,
  parseAccessCode,
  sameAccessCode,
  type SeatIndex,
  type Slug,
} from '../values.ts'
import {
  type Attempts,
  type Bucket,
  countWrong,
  fullBucket,
  isBlocked,
  isSpent,
  NO_ATTEMPTS,
  RUNTIME_LIMITS,
  take,
  within,
} from './limits.ts'
import type {
  ConnectionId,
  RoomClaim,
  RoomKey,
  RuntimeAction,
  RuntimePorts,
  TimerHandle,
} from './ports.ts'
import { exportSnapshot, importSnapshot, type RoomSnapshot, type SeatSecret } from './snapshot.ts'

/** Close codes outside the application range: the socket protocol's own (RFC 6455, section 7.4.1). */
export const SOCKET_CLOSE = {
  /** The seat left the room. */
  normal: 1000,
  /** No frame for 60 s: the socket is dead. */
  goingAway: 1001,
  /** The first frame was not a valid `hello`. */
  policy: 1008,
  /** A frame above 16 KB. */
  tooBig: 1009,
  /** A bug while handling the frame. */
  internal: 1011,
  /** The table is full in both roles, or the store did not answer. */
  tryLater: 1013,
} as const

export type RuntimeOptions = {
  /** The server's build, sent in `welcome`. */
  readonly build: string
  /**
   * Faults the simulator plants to prove it finds them. `voteAnyRound` moves every vote to the current round, as if
   * the reducer's round id check were switched off. Never set outside a test.
   */
  readonly faults?: { readonly voteAnyRound?: boolean }
}

export type AccessChange = {
  readonly access: Access
  readonly code: AccessCode | null
  /** The seat that changed it: it stays seated when the others must enter again. */
  readonly by: SeatIndex | null
  /** Everyone else enters again: the access epoch goes up and their seats are closed with 4004. */
  readonly reseat: boolean
}

export type RoomRuntime = {
  /** A socket opened for a room; nothing is sent until its `hello`. */
  readonly open: (conn: ConnectionId, at: { readonly room: RoomKey; readonly ip: string }) => void
  /** A text frame arrived. Resolves when it has been handled, a claim of the room included. */
  readonly receive: (conn: ConnectionId, text: string) => Promise<void>
  /** The socket closed, by the client, the network or the runtime. */
  readonly closed: (conn: ConnectionId) => void
  /** The lock changed over HTTP. A room that is not loaded learns it from its row at the next claim. */
  readonly setAccess: (
    room: RoomKey,
    change: AccessChange,
  ) =>
    | { readonly ok: true; readonly accessEpoch: number }
    | { readonly ok: false; readonly reason: 'not_loaded' | NackReason }
  /** The room's primary address changed over HTTP. */
  readonly setSlug: (room: RoomKey, slug: Slug) => boolean
  /** The seat a token proves in a loaded room: what an HTTP route checks before it acts for a seat. */
  readonly seatOf: (room: RoomKey, token: string) => SeatIndex | undefined
  /** Closes every socket with 4002, writes every room a last time and gives it up. */
  readonly drain: () => Promise<void>
  /** The room as the store would receive it now, for tests and the simulator. */
  readonly inspect: (room: RoomKey) => RoomSnapshot | undefined
}

type Phase = 'hello' | 'joining' | 'seated'

type Conn = {
  readonly id: ConnectionId
  readonly room: RoomKey
  readonly ip: string
  phase: Phase
  seat: SeatIndex | null
  /** The device id of `hello`: handed to history with a seat's first vote of a day, and nowhere else. */
  device: string | null
  bucket: Bucket
  strikes: number[]
  heard: number
}

type Live = {
  readonly key: RoomKey
  state: RoomState
  seq: number
  accessEpoch: number
  readonly secrets: Map<SeatIndex, SeatSecret>
  /** Every socket of the room, from its `hello` on. */
  readonly conns: Set<ConnectionId>
  /** The seated sockets of each seat; one seat may hold several (two tabs share a token). */
  readonly seated: Map<SeatIndex, Set<ConnectionId>>
  readonly timers: Map<Timer, { readonly round: string; readonly handle: TimerHandle }>
  readonly holds: Map<SeatIndex, TimerHandle>
  readonly lastFx: Map<SeatIndex, number>
  attempts: Attempts
  save: TimerHandle | null
  unload: TimerHandle | null
}

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === 'object' && input !== null && !Array.isArray(input)

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** Bytes as unpadded base64url: a seat token is 32 bytes, 43 characters. */
export function base64url(bytes: Uint8Array): string {
  let out = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0
    const b = bytes[index + 1]
    const c = bytes[index + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += BASE64URL[(n >> 18) & 63]! + BASE64URL[(n >> 12) & 63]!
    if (b !== undefined) out += BASE64URL[(n >> 6) & 63]!
    if (c !== undefined) out += BASE64URL[n & 63]!
  }
  return out
}

/** The UTC calendar day of an instant, `YYYY-MM-DD`. */
export const utcDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

const TOKEN_BYTES = 32

const accepted = (result: StepResult | 'internal'): boolean => result !== 'internal' && result.ok

export function createRoomRuntime(ports: RuntimePorts, options: RuntimeOptions): RoomRuntime {
  const { transport, clock, ids, secrets, store, history, telemetry } = ports
  const conns = new Map<ConnectionId, Conn>()
  const rooms = new Map<RoomKey, Live>()
  const claiming = new Map<RoomKey, Promise<Live | null>>()
  const releasing = new Map<RoomKey, Promise<unknown>>()
  const addresses = new Map<string, Attempts>()
  let tick: TimerHandle | null = null
  let draining = false

  const ctx = (): Ctx => ({ now: clock.now(), newId: ids.newId })

  const failed = (error: unknown, action: RuntimeAction) => telemetry.failure(error, { action })

  /** Runs a port call whose promise nobody waits for; its failure is recorded, not thrown. */
  const detach = (action: RuntimeAction, call: () => Promise<unknown> | void) => {
    try {
      const result = call()
      if (result instanceof Promise) result.catch((error: unknown) => failed(error, action))
    } catch (error) {
      failed(error, action)
    }
  }

  // Applying a step.

  function commit(room: Live, result: Extract<StepResult, { ok: true }>) {
    room.state = result.state
    for (const event of result.events) {
      room.seq += 1
      const frame = { frame: 'evt', seq: room.seq, ...event } as ServerFrame
      transport.publish(room.key, frame)
      after(room, event)
    }
    for (const effect of result.effects) run(room, effect)
    if (result.events.length > 0) dirty(room)
  }

  /** One input through the reducer; a throw is a bug, recorded once, and the room stays as it was. */
  function apply(room: Live, input: Input, action: RuntimeAction): StepResult | 'internal' {
    let result: StepResult
    try {
      result = step(room.state, input, ctx())
    } catch (error) {
      failed(error, action)
      return 'internal'
    }
    if (result.ok && !result.duplicate) commit(room, result)
    return result
  }

  const serverStep = (room: Live, command: ServerCommand) =>
    apply(room, { by: 'server', command }, 'timer')

  const seatStep = (room: Live, seat: SeatIndex, command: Command, id: string = ids.newId()) =>
    apply(room, { by: seat, id, command }, 'cmd')

  /** What an event means beyond the state: a seat that left loses its secret and its sockets. */
  function after(room: Live, event: Event) {
    if (event.type !== 'seat.left' && event.type !== 'seat.kicked') return
    const seat = event.payload.seat
    room.secrets.delete(seat)
    room.lastFx.delete(seat)
    cancelHold(room, seat)
    const code = event.type === 'seat.kicked' ? CLOSE_CODES.kicked : SOCKET_CLOSE.normal
    for (const id of Array.from(room.seated.get(seat) ?? [])) {
      const conn = conns.get(id)
      if (conn) refuse(conn, code)
    }
  }

  function run(room: Live, effect: Effect) {
    switch (effect.type) {
      case 'schedule': {
        const running = room.timers.get(effect.timer)
        if (running) clock.cancel(running.handle)
        const handle = clock.schedule(effect.at, () => elapsed(room, effect.timer, effect.round))
        room.timers.set(effect.timer, { round: effect.round, handle })
        return
      }
      case 'cancel': {
        const running = room.timers.get(effect.timer)
        if (running === undefined || running.round !== effect.round) return
        clock.cancel(running.handle)
        room.timers.delete(effect.timer)
        return
      }
      case 'persistRound':
        detach('history', () =>
          history.round(room.key, { result: effect.result, round: effect.round }),
        )
        return
      case 'persistDecision':
        detach('history', () => history.decision(room.key, effect.result))
        return
    }
  }

  function elapsed(room: Live, timer: Timer, round: string) {
    if (rooms.get(room.key) !== room) return
    const running = room.timers.get(timer)
    if (running?.round === round) room.timers.delete(timer)
    serverStep(room, {
      type: timer === 'countdown' ? 'poker.countdownElapsed' : 'poker.timerElapsed',
      payload: { round },
    })
  }

  function startTimers(room: Live) {
    const round = room.state.activity.rounds.find((r) => r.id === room.state.activity.current)
    if (round === undefined || round.state !== 'voting') return
    if (round.countdown !== null)
      run(room, {
        type: 'schedule',
        timer: 'countdown',
        round: round.id,
        at: round.countdown.endsAt,
      })
    if (round.timerEndsAt !== null)
      run(room, { type: 'schedule', timer: 'timer', round: round.id, at: round.timerEndsAt })
  }

  // Presence: a seat whose last socket is lost is held, then gone.

  function cancelHold(room: Live, seat: SeatIndex) {
    const hold = room.holds.get(seat)
    if (hold === undefined) return
    clock.cancel(hold)
    room.holds.delete(seat)
  }

  function holdSeat(room: Live, seat: SeatIndex) {
    const current = seatIn(room.state, seat)
    if (current === undefined || current.presence === 'gone') return
    serverStep(room, { type: 'seat.setConnection', payload: { seat, presence: 'reconnecting' } })
    cancelHold(room, seat)
    const handle = clock.schedule(clock.now() + RUNTIME_LIMITS.holdMs, () => {
      if (rooms.get(room.key) !== room) return
      room.holds.delete(seat)
      serverStep(room, { type: 'seat.setConnection', payload: { seat, presence: 'gone' } })
    })
    room.holds.set(seat, handle)
  }

  /** A seat comes back to the table. A gone player who finds it full comes back as a spectator. */
  function back(room: Live, seat: SeatIndex): boolean {
    cancelHold(room, seat)
    const current = seatIn(room.state, seat)
    if (current === undefined) return false
    if (current.presence !== 'reconnecting' && current.presence !== 'gone') return true
    const active = { type: 'seat.setConnection', payload: { seat, presence: 'active' } } as const
    if (accepted(serverStep(room, active))) return true
    if (current.role !== 'player') return false
    if (
      !accepted(
        seatStep(room, seat, { type: 'seat.setRole', payload: { seat, role: 'spectator' } }),
      )
    )
      return false
    return accepted(serverStep(room, active))
  }

  // Rooms: claimed on the first hello, written after each change, released when idle.

  function start(key: RoomKey, claim: RoomClaim): Live | null {
    const base = {
      key,
      conns: new Set<ConnectionId>(),
      seated: new Map<SeatIndex, Set<ConnectionId>>(),
      timers: new Map<Timer, { round: string; handle: TimerHandle }>(),
      holds: new Map<SeatIndex, TimerHandle>(),
      lastFx: new Map<SeatIndex, number>(),
      attempts: NO_ATTEMPTS,
      save: null,
      unload: null,
    }
    if (claim.kind === 'missing') return null
    if (claim.kind === 'cold') {
      const { slug, name, access, code, settings, accessEpoch } = claim.room
      const state = initialState({ slug, name, access, code, settings }, ctx())
      return { ...base, state, seq: 0, accessEpoch, secrets: new Map() }
    }
    const snapshot = importSnapshot(claim.snapshot)
    if (snapshot === undefined) return null
    const room: Live = {
      ...base,
      state: snapshot.state,
      seq: snapshot.seq,
      accessEpoch: snapshot.accessEpoch,
      secrets: new Map(snapshot.seats.map((secret) => [secret.seat, secret])),
    }
    rooms.set(key, room)
    startTimers(room)
    // Nobody is connected to a room just claimed: every seat at the table counts as a lost socket.
    for (const seat of room.state.seats) if (seat.presence !== 'gone') holdSeat(room, seat.index)
    return room
  }

  function load(key: RoomKey): Promise<Live | null> {
    const live = rooms.get(key)
    if (live) return Promise.resolve(live)
    const pending = claiming.get(key)
    if (pending) return pending
    const promise = (async () => {
      await releasing.get(key)
      const room = start(key, await store.claim(key))
      if (room) rooms.set(key, room)
      return room
    })().finally(() => claiming.delete(key))
    claiming.set(key, promise)
    return promise
  }

  function dirty(room: Live) {
    if (room.save !== null) return
    room.save = clock.schedule(clock.now() + RUNTIME_LIMITS.snapshotDebounceMs, () => {
      room.save = null
      if (rooms.get(room.key) !== room) return
      void save(room)
    })
  }

  async function save(room: Live) {
    try {
      const ownership = await store.write(room.key, exportSnapshot(room))
      if (ownership === 'lost' && rooms.get(room.key) === room) lose(room)
    } catch (error) {
      failed(error, 'store')
    }
  }

  function stopTimers(room: Live) {
    for (const { handle } of room.timers.values()) clock.cancel(handle)
    for (const handle of room.holds.values()) clock.cancel(handle)
    if (room.save !== null) clock.cancel(room.save)
    if (room.unload !== null) clock.cancel(room.unload)
    room.timers.clear()
    room.holds.clear()
    room.save = null
    room.unload = null
  }

  /** Another process owns the room now: its sockets reconnect to that one. */
  function lose(room: Live) {
    rooms.delete(room.key)
    stopTimers(room)
    for (const id of Array.from(room.conns)) {
      const conn = conns.get(id)
      if (conn) refuse(conn, CLOSE_CODES.draining)
    }
  }

  function release(room: Live): Promise<unknown> {
    rooms.delete(room.key)
    stopTimers(room)
    const done = store
      .release(room.key, exportSnapshot(room))
      .catch((error: unknown) => failed(error, 'store'))
      .finally(() => {
        if (releasing.get(room.key) === done) releasing.delete(room.key)
      })
    releasing.set(room.key, done)
    return done
  }

  function idle(room: Live) {
    if (room.conns.size > 0 || room.unload !== null || draining) return
    room.unload = clock.schedule(clock.now() + RUNTIME_LIMITS.unloadMs, () => {
      room.unload = null
      if (rooms.get(room.key) === room && room.conns.size === 0) void release(room)
    })
  }

  // Connections.

  function heartbeat() {
    if (tick !== null || conns.size === 0) return
    tick = clock.schedule(clock.now() + RUNTIME_LIMITS.pingIntervalMs, () => {
      tick = null
      const now = clock.now()
      for (const conn of Array.from(conns.values())) {
        if (now - conn.heard >= RUNTIME_LIMITS.silenceMs) refuse(conn, SOCKET_CLOSE.goingAway)
        else if (conn.phase === 'seated') transport.send(conn.id, { frame: 'ping' })
      }
      heartbeat()
    })
  }

  /** Forgets a socket. A seat that loses its last one is held, unless the room is draining. */
  function forget(conn: Conn) {
    conns.delete(conn.id)
    const room = rooms.get(conn.room)
    if (room === undefined) return
    room.conns.delete(conn.id)
    if (conn.phase === 'seated' && conn.seat !== null) {
      transport.unsubscribe(conn.id, room.key)
      const sockets = room.seated.get(conn.seat)
      sockets?.delete(conn.id)
      if (sockets !== undefined && sockets.size === 0) {
        room.seated.delete(conn.seat)
        if (!draining) holdSeat(room, conn.seat)
      }
    }
    idle(room)
  }

  function refuse(conn: Conn, code: number) {
    if (conns.get(conn.id) !== conn) return
    forget(conn)
    transport.close(conn.id, code)
    telemetry.closed(code)
  }

  function send(conn: Conn, frame: ServerFrame) {
    if (conns.get(conn.id) === conn) transport.send(conn.id, frame)
  }

  /** A refused frame; the tenth within 10 s closes the socket. */
  function strike(conn: Conn) {
    conn.strikes = within(conn.strikes, clock.now(), RUNTIME_LIMITS.strikeWindowMs)
    if (conn.strikes.length >= RUNTIME_LIMITS.strikes) refuse(conn, CLOSE_CODES.rate_limited)
  }

  function welcomeSeat(room: Live, conn: Conn, index: SeatIndex, token: string) {
    conn.phase = 'seated'
    conn.seat = index
    const sockets = room.seated.get(index) ?? new Set<ConnectionId>()
    sockets.add(conn.id)
    room.seated.set(index, sockets)
    transport.subscribe(conn.id, room.key)
    send(conn, {
      frame: 'welcome',
      v: PROTOCOL_VERSION,
      build: options.build,
      seat: index,
      seatToken: token,
      seq: room.seq,
      view: project(room.state, index),
    })
  }

  function mint(room: Live, index: SeatIndex, votedOn: string | null): string {
    const token = base64url(ids.bytes(TOKEN_BYTES))
    room.secrets.set(index, {
      seat: index,
      hash: secrets.hash(token),
      epoch: room.accessEpoch,
      votedOn,
    })
    dirty(room)
    return token
  }

  const secretOf = (room: Live, token: string): SeatSecret | undefined => {
    const hash = secrets.hash(token)
    for (const secret of room.secrets.values()) if (secret.hash === hash) return secret
    return undefined
  }

  function resume(room: Live, conn: Conn, token: string) {
    const secret = secretOf(room, token)
    if (
      secret === undefined ||
      secret.epoch < room.accessEpoch ||
      seatIn(room.state, secret.seat) === undefined
    )
      return refuse(conn, CLOSE_CODES.expired)
    if (!back(room, secret.seat)) return refuse(conn, SOCKET_CLOSE.tryLater)
    welcomeSeat(room, conn, secret.seat, token)
  }

  /** Whether a new seat may enter a locked room: a missing or wrong code, or a pause, is refused. */
  function admitted(room: Live, conn: Conn, code: string | undefined): boolean {
    const lock = room.state.room.code
    if (room.state.room.access !== 'locked' || lock === null) return true
    const now = clock.now()
    const address = addresses.get(conn.ip) ?? NO_ATTEMPTS
    // During a pause nothing is compared, so a correct code waits too.
    if (code === undefined || isBlocked(room.attempts, now) || isBlocked(address, now)) return false
    const typed = parseAccessCode(code)
    if (typed !== undefined && sameAccessCode(typed, lock)) return true
    room.attempts = countWrong(room.attempts, now, RUNTIME_LIMITS.roomAttempts)
    addresses.set(conn.ip, countWrong(address, now, RUNTIME_LIMITS.addressAttempts))
    if (addresses.size > 1024)
      for (const [ip, attempts] of addresses) if (isSpent(attempts, now)) addresses.delete(ip)
    return false
  }

  function enter(room: Live, conn: Conn, hello: HelloFrame) {
    if (!admitted(room, conn, hello.code)) return refuse(conn, CLOSE_CODES.access_required)

    // A lost seat is taken back by name: its index and name, never its hidden vote or its old secret.
    const lost = room.state.seats.find(
      (candidate) =>
        candidate.name === hello.name &&
        (candidate.presence === 'reconnecting' || candidate.presence === 'gone'),
    )
    if (lost !== undefined) {
      if (!back(room, lost.index)) return refuse(conn, SOCKET_CLOSE.tryLater)
      const token = mint(room, lost.index, room.secrets.get(lost.index)?.votedOn ?? null)
      const round = room.state.activity.rounds.find((r) => r.id === room.state.activity.current)
      if (round?.state === 'voting' && round.votes.some((vote) => vote.seat === lost.index))
        seatStep(room, lost.index, { type: 'poker.clearVote', payload: { round: round.id } })
      return welcomeSeat(room, conn, lost.index, token)
    }

    const join = (role: 'player' | 'spectator') =>
      serverStep(room, {
        type: 'seat.join',
        payload: { name: hello.name, avatar: hello.avatar, role },
      })
    let joined = join('player')
    if (joined !== 'internal' && !joined.ok && joined.reason === 'players_full')
      joined = join('spectator')
    if (joined === 'internal' || !joined.ok) return refuse(conn, SOCKET_CLOSE.tryLater)
    const event = joined.events[0]
    if (event?.type !== 'seat.joined') throw new Error('seat.join without seat.joined')
    const index = event.payload.seat.index
    welcomeSeat(room, conn, index, mint(room, index, null))
  }

  async function onHello(conn: Conn, raw: Record<string, unknown>) {
    if (raw['v'] !== PROTOCOL_VERSION) return refuse(conn, CLOSE_CODES.version_unsupported)
    const parsed = HelloFrameSchema.safeParse(raw)
    if (!parsed.success) return refuse(conn, SOCKET_CLOSE.policy)
    const frame = parsed.data
    conn.phase = 'joining'
    let room: Live | null
    try {
      room = await load(conn.room)
    } catch (error) {
      failed(error, 'store')
      return refuse(conn, SOCKET_CLOSE.tryLater)
    }
    if (conns.get(conn.id) !== conn) {
      if (room !== null) idle(room)
      return
    }
    if (draining) return refuse(conn, CLOSE_CODES.draining)
    if (room === null) return refuse(conn, CLOSE_CODES.expired)
    room.conns.add(conn.id)
    if (room.unload !== null) {
      clock.cancel(room.unload)
      room.unload = null
    }
    conn.device = frame.device ?? null
    if (frame.seatToken !== undefined) return resume(room, conn, frame.seatToken)
    return enter(room, conn, frame)
  }

  /** A seat's first vote of a UTC day reaches history with the device id, once. */
  function estimating(room: Live, conn: Conn, index: SeatIndex) {
    const secret = room.secrets.get(index)
    if (secret === undefined) return
    const day = utcDay(clock.now())
    if (secret.votedOn === day) return
    room.secrets.set(index, { ...secret, votedOn: day })
    dirty(room)
    const device = conn.device
    if (device !== null) detach('history', () => history.estimatingDay({ day, device }))
  }

  function onCommand(room: Live, conn: Conn, index: SeatIndex, raw: Record<string, unknown>) {
    const parsed = CmdFrameSchema.safeParse(raw)
    if (!parsed.success) {
      const id = raw['id']
      if (typeof id === 'string' && id.length > 0 && id.length <= 64)
        send(conn, { frame: 'nack', id, reason: 'invalid' })
      return strike(conn)
    }
    const { id } = parsed.data
    let order = { type: parsed.data.type, payload: parsed.data.payload } as Command
    if (options.faults?.voteAnyRound === true && order.type === 'poker.vote')
      order = { ...order, payload: { ...order.payload, round: room.state.activity.current } }
    const result = seatStep(room, index, order, id)
    if (result === 'internal') return send(conn, { frame: 'nack', id, reason: 'internal' })
    if (!result.ok) return send(conn, { frame: 'nack', id, reason: result.reason })
    if (order.type === 'poker.vote' && result.events.some((event) => event.type === 'poker.voted'))
      estimating(room, conn, index)
    send(conn, { frame: 'ack', id })
  }

  function onFx(room: Live, conn: Conn, index: SeatIndex, raw: Record<string, unknown>) {
    const parsed = FxFrameSchema.safeParse(raw)
    if (!parsed.success) return strike(conn)
    const now = clock.now()
    const last = room.lastFx.get(index)
    if (last !== undefined && now - last < RUNTIME_LIMITS.fxIntervalMs) return strike(conn)
    room.lastFx.set(index, now)
    transport.publish(room.key, {
      frame: 'fx',
      seat: index,
      type: parsed.data.type,
      payload: parsed.data.payload,
    })
  }

  function seated(conn: Conn, raw: Record<string, unknown>) {
    const room = rooms.get(conn.room)
    const index = conn.seat
    if (room === undefined || index === null) return
    if (raw['frame'] === 'pong') return
    const taken = take(conn.bucket, clock.now())
    conn.bucket = taken.bucket
    if (!taken.ok) {
      const id = raw['id']
      if (raw['frame'] === 'cmd' && typeof id === 'string' && id.length > 0 && id.length <= 64)
        send(conn, { frame: 'nack', id, reason: 'rate_limited' })
      return strike(conn)
    }
    switch (raw['frame']) {
      case 'cmd':
        return onCommand(room, conn, index, raw)
      case 'fx':
        return onFx(room, conn, index, raw)
      case 'ping':
        return send(conn, { frame: 'pong' })
      default:
        return strike(conn)
    }
  }

  async function receive(id: ConnectionId, text: string) {
    const conn = conns.get(id)
    if (conn === undefined) return
    conn.heard = clock.now()
    if (text.length > RUNTIME_LIMITS.maxFrame) return refuse(conn, SOCKET_CLOSE.tooBig)
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      raw = undefined
    }
    const action: RuntimeAction = conn.phase === 'hello' ? 'hello' : 'cmd'
    try {
      if (conn.phase === 'hello') {
        if (!isRecord(raw) || raw['frame'] !== 'hello') return refuse(conn, SOCKET_CLOSE.policy)
        return await onHello(conn, raw)
      }
      if (conn.phase === 'joining') return
      if (!isRecord(raw)) return strike(conn)
      return seated(conn, raw)
    } catch (error) {
      failed(error, action)
      refuse(conn, SOCKET_CLOSE.internal)
    }
  }

  return {
    open(id, at) {
      const now = clock.now()
      const conn: Conn = {
        id,
        room: at.room,
        ip: at.ip,
        phase: 'hello',
        seat: null,
        device: null,
        bucket: fullBucket(now),
        strikes: [],
        heard: now,
      }
      conns.set(id, conn)
      if (draining) return refuse(conn, CLOSE_CODES.draining)
      heartbeat()
    },
    receive,
    closed(id) {
      const conn = conns.get(id)
      if (conn) forget(conn)
    },
    setAccess(key, change) {
      const room = rooms.get(key)
      if (room === undefined) return { ok: false, reason: 'not_loaded' }
      const result = serverStep(room, {
        type: 'room.setAccess',
        payload: { access: change.access, code: change.code },
      })
      if (result === 'internal') return { ok: false, reason: 'internal' }
      if (!result.ok) return { ok: false, reason: result.reason }
      if (change.reseat) {
        room.accessEpoch += 1
        for (const current of room.state.seats) {
          const index = current.index
          if (index === change.by) {
            const secret = room.secrets.get(index)
            if (secret) room.secrets.set(index, { ...secret, epoch: room.accessEpoch })
            continue
          }
          for (const id of Array.from(room.seated.get(index) ?? [])) {
            const conn = conns.get(id)
            if (conn === undefined) continue
            conn.phase = 'joining'
            room.seated.get(index)?.delete(id)
            transport.unsubscribe(id, room.key)
            refuse(conn, CLOSE_CODES.expired)
          }
          room.seated.delete(index)
          cancelHold(room, index)
          if (current.presence !== 'gone')
            serverStep(room, {
              type: 'seat.setConnection',
              payload: { seat: index, presence: 'gone' },
            })
        }
        dirty(room)
      }
      return { ok: true, accessEpoch: room.accessEpoch }
    },
    setSlug(key, slug) {
      const room = rooms.get(key)
      if (room === undefined) return false
      return accepted(serverStep(room, { type: 'room.setSlug', payload: { slug } }))
    },
    seatOf(key, token) {
      const room = rooms.get(key)
      if (room === undefined) return undefined
      const secret = secretOf(room, token)
      if (secret === undefined || secret.epoch < room.accessEpoch) return undefined
      return seatIn(room.state, secret.seat)?.index
    },
    async drain() {
      draining = true
      if (tick !== null) clock.cancel(tick)
      tick = null
      for (const conn of Array.from(conns.values())) refuse(conn, CLOSE_CODES.draining)
      await Promise.all([...claiming.values()].map((claim) => claim.catch(() => null)))
      await Promise.all([...rooms.values()].map(release))
    },
    inspect(key) {
      const room = rooms.get(key)
      return room === undefined ? undefined : exportSnapshot(room)
    },
  }
}
