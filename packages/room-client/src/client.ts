/* oxlint-disable unicorn/prefer-add-event-listener -- one handler per socket, replaced or removed with the socket; a stale socket's events are ignored by its generation */
/**
 * The room client (docs/v9/ARCHITECTURE.md, Client): one object per room that holds the connection, the seat's view,
 * the commands still waiting for an answer, and the seat's secret. It touches the world only through its ports.
 * The figures `connection.svg` and `entry.svg` are this file as a picture.
 */
import { evolveView, withOwnVote } from '@fpp/room-core/view'
import {
  CLOSE_CODES,
  findCard,
  parseSlug,
  PROTOCOL_VERSION,
  type Command,
  type Event,
  type HelloFrame,
  type NackReason,
  type RoundId,
  type ServerFrame,
  type Slug,
  type View,
} from '@fpp/room-core/types'
import { backoffDelay, drainDelay, WAITS } from './backoff.ts'
import type { ClientPorts, RoomLookup, SocketLike } from './ports.ts'
import { createLocalStore, randomId, type Profile } from './storage.ts'

export type ClientStatus =
  | 'connecting'
  | 'locked'
  | 'changed-hands'
  | 'live'
  | 'reconnecting'
  | 'draining'
  | 'reload-required'
  | 'kicked'
  | 'gone'

export type PendingCommand = {
  readonly id: string
  readonly command: Command
  readonly sentAt: number
}

/** A nack's reason, or why no answer will come: `offline` (not connected, not worth queueing) or `lost` (its seat or connection ended first). */
export type CommandResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: NackReason | 'offline' | 'lost' }

export type RoomClientState = {
  readonly status: ClientStatus
  /** The seat's view; stays as it was while the connection is lost, `null` before the first welcome. */
  readonly view: View | null
  /** The room's `seq` this view is at; `0` before the first welcome. */
  readonly seq: number
  /** Commands sent and not answered, oldest first. */
  readonly pending: readonly PendingCommand[]
  /** The latest vote or clear not yet acknowledged: `card` is the label voted, `null` for a clear. The only optimism there is. */
  readonly pendingVote: { readonly round: RoundId; readonly card: string | null } | null
  /** The seat's own card as the interface shows it, before the view holds it: a vote sent, or one acknowledged whose event is still on its way. */
  readonly ownVote: {
    readonly round: RoundId
    readonly card: string
    readonly pending: boolean
  } | null
  /** The code of the last close, `null` before any. */
  readonly closeCode: number | null
  /** In status `locked`: a code was sent and refused (as against none held). */
  readonly codeRefused: boolean
  /** In status `changed-hands`: when this device remembers the room as created, and when the address's room was. */
  readonly changedHands: { readonly remembered: number; readonly found: number } | null
}

export type RoomClientOptions = {
  /** The address from the URL: a number or a name. One that is neither ends in `gone` without a socket. */
  readonly slug: string
  /** Name and avatar seed for a new seat; a function is read at each `hello`, so a rename is used by a later join. */
  readonly profile: Profile | (() => Profile)
  readonly ports: ClientPorts
  /** The origin of the server, as in `https://free-planning-poker.com`; the socket is at `/api/ws/<slug>` on it. */
  readonly origin: string
  /** The access code from the link's fragment, decoded. */
  readonly code?: string
  /** The build, sent in `hello`. */
  readonly build?: string
}

export type RoomClient = {
  readonly state: {
    /** For `useSyncExternalStore`: the listener runs after every change of the state. */
    readonly subscribe: (listener: () => void) => () => void
    /** The same object until the state changes. */
    readonly getSnapshot: () => RoomClientState
  }
  /** Sends a command. A vote or a clear waits for a lost connection and is sent again after the resume; anything else is refused with `offline`. */
  readonly send: (command: Command) => Promise<CommandResult>
  /** In status `locked`: connects again with this code. */
  readonly submitCode: (code: string) => void
  /** In status `changed-hands`: takes the address's room as a new one, forgetting the old one's password, and joins it. */
  readonly acceptNewRoom: () => void
  /** In status `kicked` or `gone`: asks for a new seat. */
  readonly rejoin: () => void
  /** Closes the socket and every timer; nothing runs afterwards. */
  readonly dispose: () => void
}

type Entry = {
  readonly id: string
  readonly command: Command
  readonly sentAt: number
  readonly resolve: (result: CommandResult) => void
}

type CodeSource = 'link' | 'recent' | 'typed'

const INITIAL: RoomClientState = {
  status: 'connecting',
  view: null,
  seq: 0,
  pending: [],
  pendingVote: null,
  ownVote: null,
  closeCode: null,
  codeRefused: false,
  changedHands: null,
}

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === 'object' && input !== null && !Array.isArray(input)

const isVoteKind = (command: Command) =>
  command.type === 'poker.vote' || command.type === 'poker.clearVote'

export function createRoomClient(options: RoomClientOptions): RoomClient {
  const { ports } = options
  const { timers } = ports
  const build = options.build ?? 'dev'
  const slug: Slug | undefined = parseSlug(options.slug)
  const store = createLocalStore({ storage: ports.storage, now: timers.now, random: ports.random })
  const device = store.deviceId()
  const session = randomId(ports.random, 8)
  const profileNow = (): Profile =>
    typeof options.profile === 'function' ? options.profile() : options.profile
  const socketUrl = `${options.origin.replace(/^http/, 'ws')}/api/ws/${slug ?? ''}`

  const listeners = new Set<() => void>()
  let state: RoomClientState = INITIAL
  let disposed = false
  /** No socket is wanted until somebody decides (a code, a new room, a new seat) or for good (a terminal status). */
  let halted = false
  /** The lookup has been answered or skipped: from here on a socket may open. */
  let started = false

  let socket: SocketLike | null = null
  let generation = 0
  let welcomed = false
  let heard = 0
  let sentToken: string | null = null
  let sentCode: string | undefined

  let token: string | null = slug === undefined ? null : store.seat.get(slug)
  let lastSeq = 0
  let attempt = 0
  let counter = 0
  let latestVote: string | null = null
  /** The own vote the server last acknowledged and nobody cleared: re-asserted when a welcome of the same round lacks it. */
  let confirmed: { readonly round: RoundId; readonly card: string } | null = null
  let knownCreatedAt: number | null = null
  let found: Extract<RoomLookup, { kind: 'room' }> | null = null

  let code: string | undefined = options.code
  let codeSource: CodeSource = 'link'
  if (code === undefined && slug !== undefined) {
    code = store.recent.get(slug)?.code ?? undefined
    codeSource = 'recent'
  }

  const pending = new Map<string, Entry>()
  let reconnectTimer: unknown = null
  let lossTimer: unknown = null
  let stableTimer: unknown = null
  let connectTimer: unknown = null
  let watchdogTimer: unknown = null

  const clear = (handle: unknown) => {
    if (handle !== null) timers.clearTimeout(handle)
  }

  function ownVoteOf(next: RoomClientState): RoomClientState['ownVote'] {
    const { pendingVote, view } = next
    if (pendingVote !== null)
      return pendingVote.card === null
        ? null
        : { round: pendingVote.round, card: pendingVote.card, pending: true }
    const round = view?.activity.rounds.find((candidate) => candidate.id === view.activity.current)
    if (confirmed === null || round?.id !== confirmed.round || round.state !== 'voting') return null
    return { round: round.id, card: confirmed.card, pending: false }
  }

  function set(change: Partial<RoomClientState>) {
    state = { ...state, ...change }
    state = { ...state, ownVote: ownVoteOf(state) }
    for (const listener of Array.from(listeners)) listener()
  }

  function publishPending() {
    const entries = Array.from(pending.values())
    let pendingVote: RoomClientState['pendingVote'] = null
    for (const { command } of entries) {
      if (command.type === 'poker.vote')
        pendingVote = { round: command.payload.round, card: command.payload.card }
      else if (command.type === 'poker.clearVote')
        pendingVote = { round: command.payload.round, card: null }
    }
    set({
      pending: entries.map(({ id, command, sentAt }) => ({ id, command, sentAt })),
      pendingVote,
    })
  }

  function failPending(reason: 'offline' | 'lost') {
    if (pending.size === 0) return
    const entries = Array.from(pending.values())
    pending.clear()
    latestVote = null
    publishPending()
    for (const entry of entries) entry.resolve({ ok: false, reason })
  }

  // The seat's secret and the list of rooms.

  function forgetSeat() {
    token = null
    confirmed = null
    lastSeq = 0
    if (slug !== undefined) store.seat.clear(slug)
    set({})
    const primary = state.view?.room.slug
    if (primary !== undefined) store.seat.clear(primary)
    failPending('lost')
  }

  function remember(view: View) {
    if (slug === undefined) return
    const address = view.room.slug
    const existing = store.recent.get(slug) ?? store.recent.get(address)
    const locked = view.room.access === 'locked'
    store.recent.upsert({
      slug: address,
      name: view.room.name,
      createdAt: knownCreatedAt ?? existing?.createdAt ?? null,
      code: locked ? (view.room.code ?? sentCode ?? existing?.code ?? null) : null,
      pinned: existing?.pinned ?? false,
      visitedAt: timers.now(),
    })
    if (address !== slug) store.recent.remove(slug)
    if (token !== null) {
      store.seat.set(slug, token)
      store.seat.set(address, token)
    }
  }

  // The socket.

  function closeSocket() {
    const old = socket
    socket = null
    generation += 1
    welcomed = false
    clear(connectTimer)
    clear(watchdogTimer)
    connectTimer = null
    watchdogTimer = null
    if (old === null) return
    old.onopen = null
    old.onmessage = null
    old.onclose = null
    old.onerror = null
    try {
      old.close(1000)
    } catch {
      // Already closed.
    }
  }

  function hello(): HelloFrame {
    const { name, avatar } = profileNow()
    return {
      frame: 'hello',
      v: PROTOCOL_VERSION,
      build,
      name,
      avatar,
      device,
      ...(token === null ? {} : { seatToken: token, ...(state.view === null ? {} : { lastSeq }) }),
      ...(code === undefined ? {} : { code }),
    }
  }

  function transmit(frame: object) {
    try {
      socket?.send(JSON.stringify(frame))
    } catch {
      // A socket that cannot send is about to close; the close ends the wait.
    }
  }

  function openSocket() {
    if (disposed || halted || !started || slug === undefined) return
    clear(reconnectTimer)
    reconnectTimer = null
    closeSocket()
    const mine = generation
    sentToken = token
    sentCode = code
    let ws: SocketLike
    try {
      ws = new ports.WebSocket(socketUrl)
    } catch {
      return scheduleReconnect(backoffDelay(attempt++, ports.random))
    }
    socket = ws
    connectTimer = timers.setTimeout(() => {
      if (mine === generation && !welcomed) dropped()
    }, WAITS.connectTimeoutMs)
    ws.onopen = () => {
      if (mine !== generation) return
      heard = timers.now()
      transmit(hello())
      armWatchdog(mine)
    }
    ws.onmessage = (message) => {
      if (mine !== generation) return
      heard = timers.now()
      if (typeof message.data === 'string') receive(message.data)
    }
    ws.onclose = (closing) => {
      if (mine !== generation) return
      closed(closing.code)
    }
    ws.onerror = null
  }

  function armWatchdog(mine: number, wait: number = WAITS.silenceMs) {
    clear(watchdogTimer)
    watchdogTimer = timers.setTimeout(() => {
      if (mine !== generation) return
      const silent = timers.now() - heard
      if (silent >= WAITS.silenceMs) dropped()
      else armWatchdog(mine, WAITS.silenceMs - silent)
    }, wait)
  }

  /** The socket is given up without a close frame: no welcome, no sign of life, a gap in `seq`. */
  function dropped() {
    closeSocket()
    closed(1006)
  }

  function scheduleReconnect(delay: number) {
    if (disposed || halted) return
    clear(reconnectTimer)
    reconnectTimer = timers.setTimeout(() => {
      reconnectTimer = null
      openSocket()
    }, delay)
  }

  /** Shows `reconnecting` only when the loss has lasted. */
  function startLossTimer() {
    if (lossTimer !== null || state.view === null) return
    lossTimer = timers.setTimeout(() => {
      lossTimer = null
      if (state.status === 'live' || state.status === 'draining') set({ status: 'reconnecting' })
    }, WAITS.reconnectingAfterMs)
  }

  function stop(status: ClientStatus) {
    halted = true
    clear(reconnectTimer)
    clear(lossTimer)
    clear(stableTimer)
    reconnectTimer = null
    lossTimer = null
    stableTimer = null
    failPending('lost')
    set({ status })
  }

  function closed(closeCode: number) {
    const sawSeat = sentToken !== null || welcomed
    closeSocket()
    clear(stableTimer)
    stableTimer = null
    set({ closeCode })
    switch (closeCode) {
      case CLOSE_CODES.version_unsupported:
        return stop('reload-required')
      case CLOSE_CODES.kicked:
        forgetSeat()
        return stop('kicked')
      case CLOSE_CODES.expired:
        // A token the room does not know: sit down again. A first hello refused the same way means no live room.
        if (!sawSeat) return stop('gone')
        forgetSeat()
        set({ status: 'connecting', view: null })
        return openSocket()
      case CLOSE_CODES.access_required:
        if (codeSource === 'recent' && sentCode !== undefined && slug !== undefined)
          store.recent.update(slug, { code: null })
        code = undefined
        set({ codeRefused: sentCode !== undefined })
        return stop('locked')
      case CLOSE_CODES.draining:
        startLossTimer()
        set({ status: state.status === 'live' ? 'draining' : state.status })
        return scheduleReconnect(drainDelay(ports.random))
      case 1000:
        forgetSeat()
        return stop('gone')
      default:
        startLossTimer()
        return scheduleReconnect(backoffDelay(attempt++, ports.random))
    }
  }

  // Frames from the server.

  function receive(text: string) {
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      return
    }
    if (!isRecord(raw)) return
    const frame = raw as ServerFrame
    switch (frame.frame) {
      case 'welcome':
        return isRecord(frame.view) && typeof frame.seatToken === 'string'
          ? welcome(frame)
          : undefined
      case 'evt':
        return typeof frame.seq === 'number' && typeof frame.type === 'string'
          ? applyEvent(frame)
          : undefined
      case 'ack':
        return answer(frame.id, { ok: true })
      case 'nack':
        return answer(frame.id, { ok: false, reason: frame.reason })
      case 'ping':
        return transmit({ frame: 'pong' })
      default:
        return
    }
  }

  function welcome(frame: Extract<ServerFrame, { frame: 'welcome' }>) {
    if (state.status === 'locked' || halted) return
    welcomed = true
    clear(connectTimer)
    connectTimer = null
    clear(lossTimer)
    lossTimer = null
    clear(stableTimer)
    stableTimer = timers.setTimeout(() => {
      stableTimer = null
      attempt = 0
    }, WAITS.stableMs)
    const joined = sentToken === null
    token = frame.seatToken
    lastSeq = frame.seq
    if (joined) {
      // A new seat owns nothing of the old one: what was waiting for an answer belonged to somebody else.
      confirmed = null
      failPending('lost')
    }
    set({ status: 'live', view: frame.view, seq: frame.seq, codeRefused: false })
    remember(frame.view)
    resume(frame.view)
  }

  /** After a welcome: what was not acknowledged goes again with its id; the own vote is asserted if the view lacks it. */
  function resume(view: View) {
    for (const entry of Array.from(pending.values())) {
      if (isVoteKind(entry.command)) transmitEntry(entry)
      else {
        pending.delete(entry.id)
        entry.resolve({ ok: false, reason: 'lost' })
      }
    }
    publishPending()
    const mine = confirmed
    if (mine === null || latestVote !== null) return
    const round = view.activity.rounds.find((candidate) => candidate.id === view.activity.current)
    if (round?.id !== mine.round || round.state !== 'voting') return
    if (round.votes.some((vote) => vote.seat === view.self)) return
    void send({ type: 'poker.vote', payload: { round: mine.round, card: mine.card } })
  }

  function applyEvent(frame: Extract<ServerFrame, { frame: 'evt' }>) {
    const view = state.view
    if (view === null || frame.seq <= lastSeq) return
    if (frame.seq !== lastSeq + 1) return dropped()
    const { frame: _frame, seq: _seq, ...rest } = frame
    let next = evolveView(view, rest as Event)
    // A vote the room dropped (cleared elsewhere, or the seat became a spectator) is no longer the seat's to assert.
    if (
      (rest.type === 'poker.voteCleared' && rest.payload.seat === next.self) ||
      (rest.type === 'seat.roleChanged' &&
        rest.payload.seat === next.self &&
        rest.payload.role === 'spectator')
    )
      confirmed = null
    // The seat's own card comes from its command: an ack that beat its event waited here, so the order of votes stays the server's.
    if (rest.type === 'poker.voted' && rest.payload.seat === next.self)
      next = ownCard(next, rest.payload.round)
    lastSeq = frame.seq
    if (next === view) return set({ seq: lastSeq })
    set({ view: next, seq: lastSeq })
    const room = next.room
    if (
      room.name !== view.room.name ||
      room.access !== view.room.access ||
      room.code !== view.room.code ||
      room.slug !== view.room.slug
    )
      remember(next)
  }

  function answer(id: string, result: CommandResult) {
    const entry = pending.get(id)
    if (entry === undefined) return
    pending.delete(id)
    if (id === latestVote) {
      latestVote = null
      if (result.ok) settleVote(entry.command)
    }
    publishPending()
    entry.resolve(result)
  }

  /** The card the seat's latest unanswered vote names in `round`, if that is what it last asked for. */
  function waitingCard(round: RoundId): string | undefined {
    let card: string | undefined
    for (const { command } of pending.values()) {
      if (command.type === 'poker.vote' && command.payload.round === round)
        card = command.payload.card
      else if (command.type === 'poker.clearVote' && command.payload.round === round)
        card = undefined
    }
    return card
  }

  /**
   * The view with the seat's own card in `round`, where the round is voting and holds the seat's vote: the card of
   * the vote still waiting for its answer, else the acknowledged one.
   */
  function ownCard(view: View, round: RoundId): View {
    const voting = view.activity.rounds.find((candidate) => candidate.id === round)
    if (voting?.state !== 'voting') return view
    if (!voting.votes.some((vote) => vote.seat === view.self)) return view
    const label = waitingCard(round) ?? (confirmed?.round === round ? confirmed.card : undefined)
    const card = label === undefined ? undefined : findCard(voting.deck, label)
    return card === undefined ? view : withOwnVote(view, round, card)
  }

  /** An acknowledged vote shows as the seat's own card, whichever of its event and its ack came first. */
  function settleVote(command: Command) {
    const view = state.view
    if (view === null) return
    if (command.type === 'poker.clearVote') {
      confirmed = null
      return set({})
    }
    if (command.type !== 'poker.vote') return
    confirmed = { round: command.payload.round, card: command.payload.card }
    set({ view: ownCard(view, command.payload.round) })
  }

  function transmitEntry(entry: Entry) {
    transmit({ frame: 'cmd', id: entry.id, ...entry.command })
  }

  // What the interface calls.

  function send(command: Command): Promise<CommandResult> {
    const queued = isVoteKind(command)
    const live = welcomed && socket !== null
    if (disposed || halted || state.view === null || (!live && !queued))
      return Promise.resolve({ ok: false, reason: 'offline' })
    counter += 1
    const id = `${session}-${counter}`
    return new Promise<CommandResult>((resolve) => {
      const entry: Entry = { id, command, sentAt: timers.now(), resolve }
      pending.set(id, entry)
      if (queued) latestVote = id
      if (live) transmitEntry(entry)
      publishPending()
    })
  }

  function submitCode(typed: string) {
    if (state.status !== 'locked' || typed.length === 0) return
    code = typed
    codeSource = 'typed'
    begin()
  }

  function acceptNewRoom() {
    if (state.status !== 'changed-hands' || slug === undefined || found === null) return
    knownCreatedAt = found.createdAt
    store.recent.upsert({
      slug,
      name: found.name,
      createdAt: found.createdAt,
      code: null,
      pinned: false,
      visitedAt: timers.now(),
    })
    store.seat.clear(slug)
    token = null
    if (codeSource === 'recent') code = undefined
    set({ changedHands: null })
    begin()
  }

  function rejoin() {
    if (state.status !== 'kicked' && state.status !== 'gone') return
    begin()
  }

  /** A person decided: connect now, as for a first visit. */
  function begin() {
    halted = false
    started = true
    attempt = 0
    set({ status: 'connecting', codeRefused: false, view: token === null ? null : state.view })
    openSocket()
  }

  function onOnline() {
    if (halted || !started) return
    attempt = 0
    closeSocket()
    startLossTimer()
    openSocket()
  }

  function onVisible() {
    if (halted || !started) return
    if (socket === null) return openSocket()
    if (welcomed && timers.now() - heard > WAITS.staleMs) {
      closeSocket()
      startLossTimer()
      openSocket()
    }
  }

  const offOnline = ports.signals.onOnline(onOnline)
  const offVisible = ports.signals.onVisible(onVisible)

  function dispose() {
    if (disposed) return
    disposed = true
    offOnline()
    offVisible()
    closeSocket()
    clear(reconnectTimer)
    clear(lossTimer)
    clear(stableTimer)
    failPending('offline')
    listeners.clear()
  }

  // The way in (figure entry.svg): look the address up, then join.

  function proceed() {
    started = true
    openSocket()
  }

  function decide(result: RoomLookup) {
    if (disposed || slug === undefined) return
    if (result.kind === 'free') return stop('gone')
    found = result
    const remembered = store.recent.get(slug)?.createdAt ?? null
    if (remembered !== null && remembered !== result.createdAt) {
      stop('changed-hands')
      set({ changedHands: { remembered, found: result.createdAt } })
      return
    }
    knownCreatedAt = result.createdAt
    proceed()
  }

  if (slug === undefined) stop('gone')
  else if (ports.lookup === undefined) proceed()
  else
    ports.lookup(slug).then(decide, () => {
      if (!disposed) proceed()
    })

  return {
    state: {
      subscribe: (listener) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
      getSnapshot: () => state,
    },
    send,
    submitCode,
    acceptNewRoom,
    rejoin,
    dispose,
  }
}
