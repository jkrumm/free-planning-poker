/**
 * The ports of the room client (docs/v9/ARCHITECTURE.md, Client). Each is a plain interface: the browser's
 * `WebSocket`, `localStorage`, timers and window events fit them, and a test passes a fake, so nothing here needs a
 * DOM.
 */

/** A method type the compiler compares loosely, so the browser's `WebSocket` handlers fit `Handler<unknown>`. */
type Handler<E> = { bivarianceHack(event: E): void }['bivarianceHack']

/** What the client uses of a WebSocket. `close` must raise `onclose` unless the handlers were removed first. */
export type SocketLike = {
  onopen: Handler<unknown> | null
  onmessage: Handler<{ readonly data: unknown }> | null
  onclose: Handler<{ readonly code: number }> | null
  onerror: Handler<unknown> | null
  send(data: string): void
  close(code?: number): void
}

export type SocketConstructor = new (url: string) => SocketLike

/** The part of `localStorage` the client uses. */
export type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type Timers = {
  /** Milliseconds since the epoch. */
  readonly now: () => number
  readonly setTimeout: (run: () => void, ms: number) => unknown
  readonly clearTimeout: (handle: unknown) => void
}

/** Window events that end a wait: the device regained its network, the page became visible. */
export type Signals = {
  readonly onOnline: (listener: () => void) => () => void
  readonly onVisible: (listener: () => void) => () => void
}

/** No signal ever arrives: for a client that runs outside a browser. */
export const NO_SIGNALS: Signals = {
  onOnline: () => () => {},
  onVisible: () => () => {},
}

/**
 * What an address leads to, as `GET /api/rooms/:slug` tells it. `free` is an address nobody holds; a held or
 * released one still leads to its room.
 */
export type RoomLookup =
  | { readonly kind: 'free' }
  | {
      readonly kind: 'room'
      /** Milliseconds since the epoch. */
      readonly createdAt: number
      readonly name: string | null
      readonly access: 'open' | 'locked'
    }

export type ClientPorts = {
  readonly WebSocket: SocketConstructor
  readonly storage: StorageLike
  readonly timers: Timers
  readonly signals: Signals
  /** A float in [0, 1): backoff jitter, and the ids of this device and its commands. Nothing secret comes from it. */
  readonly random: () => number
  /**
   * The lookup before `hello`. Without it the client connects at once; a lookup that fails is skipped, so a slow
   * route never keeps anyone out of a room.
   */
  readonly lookup?: (slug: string) => Promise<RoomLookup>
}
