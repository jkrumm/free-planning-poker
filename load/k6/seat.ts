/**
 * One seat of a room as a client: it opens the socket, says hello, resumes its seat with the token after a loss, and
 * sends commands that are re-sent until acknowledged. The waits are the room client's (packages/room-client/src/backoff.ts):
 * a first retry after a uniform 0 to 2 s, then full jitter from 500 ms to a cap of 30 s.
 */
import { clearTimeout, setTimeout } from 'k6/timers'
import { WebSocket } from 'k6/websockets'
import { commandsAcked, errors, reconnects, resume, seqGaps, upgradeFailures } from './metrics.ts'

const BACKOFF_BASE_MS = 500
const BACKOFF_CAP_MS = 30_000
const FIRST_RETRY_MAX_MS = 2_000
/** A socket with no welcome after this is given up (the room client's connectTimeoutMs). */
const WELCOME_TIMEOUT_MS = 10_000
/** A seat that cannot join within this has failed; one that cannot resume within it is counted failed once, and goes on trying. */
const GIVE_UP_MS = 30_000
const COMMAND_TIMEOUT_MS = 15_000
/** Close codes after which a seat cannot resume: kicked (4003) and a token the room does not know (4004). */
const TERMINAL_CODES = new Set([4003, 4004])

export type Payload = {
  round?: unknown
  seat?: number
  votes?: readonly { seat: number; card: { label: string } | null }[]
}
export type EvtFrame = { frame: 'evt'; seq: number; type: string; payload: Payload }
export type Welcome = {
  frame: 'welcome'
  seat: number
  seatToken: string
  seq: number
  view: {
    activity: { current: string }
    room: { settings: { deck: { cards: readonly { label: string }[] } } }
  }
}
type Frame = { frame: string } & Record<string, unknown>
type SocketEvent = { data?: unknown; code?: number }

export type SeatHooks = {
  /** A socket is about to be opened. */
  upgrade(): void
  welcome(seat: Seat, welcome: Welcome): void
  evt(seat: Seat, evt: EvtFrame): void
}

type Pending = { readonly frame: string; resolve(): void; reject(error: Error): void }

export class Seat {
  /** This seat's number in the room, from its welcome. */
  seatNo = -1
  /** The round commands go to: the welcome's current one, then each `poker.roundStarted`. */
  round = ''
  cards: readonly string[] = []
  live = false
  private lastSeq = 0
  private token: string | undefined
  private socket: WebSocket | undefined
  private welcomeTimer: number | undefined
  private retryTimer: number | undefined
  private attempt = 0
  private stopped = false
  private ids = 0
  private lostAt: number | undefined
  private gaveUp = false
  private firstWelcome: { resolve(): void; reject(error: Error): void } | undefined
  private readonly pending = new Map<string, Pending>()

  constructor(
    readonly index: number,
    private readonly url: string,
    private readonly origin: string,
    private readonly hooks: SeatHooks,
  ) {}

  /** Opens the first socket; resolves on its welcome, rejects when none comes within the give-up time. */
  join(): Promise<void> {
    return new Promise((resolve, reject) => {
      const giveUp = setTimeout(() => {
        this.firstWelcome = undefined
        errors.add(1)
        console.error(`LOAD_ERROR seat ${this.index} did not join in ${GIVE_UP_MS} ms`)
        reject(new Error(`seat ${this.index} did not join`))
      }, GIVE_UP_MS)
      this.firstWelcome = {
        resolve: () => {
          clearTimeout(giveUp)
          errors.add(0)
          resolve()
        },
        reject: (error) => {
          clearTimeout(giveUp)
          reject(error)
        },
      }
      this.open()
    })
  }

  /** Sends a command and resolves on its ack; a lost socket re-sends it, with the same id, on the next welcome. */
  command(type: string, payload: Record<string, unknown>): Promise<void> {
    this.ids += 1
    const id = `${this.index}-${this.ids}`
    const frame = JSON.stringify({ frame: 'cmd', id, type, payload })
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`no ack for ${type}`))
      }, COMMAND_TIMEOUT_MS)
      this.pending.set(id, {
        frame,
        resolve: () => {
          clearTimeout(timer)
          resolve()
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        },
      })
      if (this.live) this.socket?.send(frame)
    })
  }

  /** The room's seq this seat has caught up to, by events or by its last welcome. */
  get seq(): number {
    return this.lastSeq
  }

  /** For an error line: where this seat stood when something it waited for did not arrive. */
  describe(): string {
    return `seat ${this.index} live=${this.live} seq=${this.lastSeq} attempt=${this.attempt} pending=${this.pending.size}`
  }

  /** Loses the socket on purpose; the seat resumes like any seat whose network dropped. */
  drop(): void {
    this.socket?.close(1000, 'load')
  }

  stop(): void {
    this.stopped = true
    this.clearTimers()
    this.socket?.close(1000, 'done')
  }

  private clearTimers(): void {
    if (this.welcomeTimer !== undefined) clearTimeout(this.welcomeTimer)
    if (this.retryTimer !== undefined) clearTimeout(this.retryTimer)
    this.welcomeTimer = undefined
    this.retryTimer = undefined
  }

  private open(): void {
    if (this.stopped) return
    this.hooks.upgrade()
    const socket = new WebSocket(this.url, null, { headers: { Origin: this.origin } })
    this.socket = socket
    this.welcomeTimer = setTimeout(() => socket.close(1000, 'no welcome'), WELCOME_TIMEOUT_MS)
    socket.addEventListener('open', () => {
      socket.send(
        JSON.stringify({
          frame: 'hello',
          v: 1,
          build: 'load',
          name: `Seat ${this.index}`,
          avatar: `load-${this.index}`,
          ...(this.token === undefined ? {} : { seatToken: this.token, lastSeq: this.lastSeq }),
        }),
      )
    })
    socket.addEventListener('message', (event) => {
      if (socket === this.socket) this.onMessage(socket, event as unknown as SocketEvent)
    })
    socket.addEventListener('close', (event) => {
      if (socket === this.socket) this.onClose(event as unknown as SocketEvent)
    })
  }

  private onMessage(socket: WebSocket, event: SocketEvent): void {
    const frame = JSON.parse(String(event.data)) as Frame
    switch (frame.frame) {
      case 'welcome':
        return this.onWelcome(frame as unknown as Welcome)
      case 'evt':
        return this.onEvt(socket, frame as unknown as EvtFrame)
      case 'ack': {
        const pending = this.pending.get(String(frame['id']))
        if (pending === undefined) return
        this.pending.delete(String(frame['id']))
        commandsAcked.add(1)
        return pending.resolve()
      }
      case 'nack': {
        const pending = this.pending.get(String(frame['id']))
        if (pending === undefined) return
        this.pending.delete(String(frame['id']))
        return pending.reject(new Error(`nack ${String(frame['reason'])}`))
      }
      case 'ping':
        return socket.send('{"frame":"pong"}')
      default:
    }
  }

  private onWelcome(welcome: Welcome): void {
    if (this.welcomeTimer !== undefined) clearTimeout(this.welcomeTimer)
    this.welcomeTimer = undefined
    this.live = true
    this.attempt = 0
    this.token = welcome.seatToken
    this.seatNo = welcome.seat
    this.lastSeq = welcome.seq
    this.round = welcome.view.activity.current
    this.cards = welcome.view.room.settings.deck.cards.map((card) => card.label)
    if (this.lostAt !== undefined) {
      resume.add(Date.now() - this.lostAt)
      reconnects.add(1)
      if (!this.gaveUp) errors.add(0)
      this.lostAt = undefined
      this.gaveUp = false
    }
    this.hooks.welcome(this, welcome)
    this.firstWelcome?.resolve()
    this.firstWelcome = undefined
    for (const pending of this.pending.values()) this.socket?.send(pending.frame)
  }

  private onEvt(socket: WebSocket, evt: EvtFrame): void {
    if (evt.seq <= this.lastSeq) return
    if (evt.seq !== this.lastSeq + 1) {
      // A gap: the protocol's answer is to reconnect with the last seq and take the welcome's full view.
      seqGaps.add(1)
      return socket.close(1000, 'gap')
    }
    this.lastSeq = evt.seq
    if (evt.type === 'poker.roundStarted') {
      const round = evt.payload.round as { id: string }
      this.round = round.id
    }
    this.hooks.evt(this, evt)
  }

  private onClose(event: SocketEvent): void {
    const wasLive = this.live
    this.live = false
    this.socket = undefined
    if (this.welcomeTimer !== undefined) clearTimeout(this.welcomeTimer)
    this.welcomeTimer = undefined
    if (this.stopped) return
    if (event.code !== undefined && TERMINAL_CODES.has(event.code)) {
      errors.add(1)
      console.error(`LOAD_ERROR seat ${this.index} closed with ${event.code}`)
      this.firstWelcome?.reject(new Error(`closed with ${event.code}`))
      return
    }
    if (wasLive && this.lostAt === undefined) this.lostAt = Date.now()
    if (!wasLive) upgradeFailures.add(1)
    if (this.lostAt !== undefined && !this.gaveUp && Date.now() - this.lostAt > GIVE_UP_MS) {
      this.gaveUp = true
      errors.add(1)
      console.error(`LOAD_ERROR seat ${this.index} had no socket for ${GIVE_UP_MS} ms`)
    }
    const ceiling =
      this.attempt === 0
        ? FIRST_RETRY_MAX_MS
        : Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** this.attempt)
    this.attempt += 1
    this.retryTimer = setTimeout(() => this.open(), Math.floor(Math.random() * ceiling))
  }
}
