/** What the API's tests share that is not a port: a room API that serves no room, for servers that test sockets only. */
import type { RoomsApi } from '../src/http/rooms.ts'

export const NO_ROOMS: RoomsApi = {
  create: async () => ({ ok: false, error: 'unavailable' }),
  lookup: async () => ({ ok: true, room: { state: 'free' } }),
  setAccess: async () => ({ ok: false, error: 'unknown_room' }),
  setName: async () => ({ ok: false, error: 'unknown_room' }),
}

/** An environment `parseEnv` accepts; tests add what they test. */
export const ENV = {
  DATABASE_URL: 'postgres://postgres@127.0.0.1:5432/fpp',
  VISITOR_KEY: 'a-test-key-that-is-long-enough-000000',
} as const
