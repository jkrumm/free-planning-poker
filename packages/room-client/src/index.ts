/**
 * `@fpp/room-client`: the headless client of a room. No React, no DOM; its ports are a WebSocket constructor,
 * storage, timers, window signals and an optional lookup. The development bots are the entry `@fpp/room-client/bots`.
 */
export { createRoomClient } from './client.ts'
export type {
  ClientStatus,
  CommandResult,
  PendingCommand,
  RoomClient,
  RoomClientOptions,
  RoomClientState,
} from './client.ts'
export { NO_SIGNALS } from './ports.ts'
export type {
  ClientPorts,
  RoomLookup,
  Signals,
  SocketConstructor,
  SocketLike,
  StorageLike,
  Timers,
} from './ports.ts'
export { httpLookup } from './lookup.ts'
export type { FetchLike } from './lookup.ts'
export { createLocalStore, DEFAULT_PREFS, RECENT_KEEP_MS } from './storage.ts'
export type { LocalStore, LocalStoreOptions, Prefs, Profile, RecentRoom } from './storage.ts'
