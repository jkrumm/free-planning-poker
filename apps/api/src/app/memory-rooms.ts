/**
 * Rooms, snapshots and history in memory, until `v9-api-persistence` puts them in Postgres. Every valid address
 * leads to a room: the first visit opens one, open and with the default settings, as no HTTP route creates rooms yet.
 */
import type { ColdRoom, RoomKey } from '@fpp/room-core/server'
import { DEFAULT_SETTINGS } from '@fpp/room-core/server'
import {
  memoryHistory,
  memoryStore,
  type MemoryHistory,
  type MemoryStore,
} from '@fpp/room-core/sim'
import type { Slug } from '@fpp/room-core/types'
import type { RoomDirectory } from '../ws/edge.ts'

export type MemoryRooms = {
  readonly directory: RoomDirectory
  readonly store: MemoryStore
  readonly history: MemoryHistory
  /** Opens a room at an address, or changes the row of the one it leads to; returns its key. */
  readonly put: (slug: Slug, room?: Partial<Omit<ColdRoom, 'slug'>>) => RoomKey
}

export function memoryRooms(): MemoryRooms {
  const store = memoryStore()
  const history = memoryHistory()
  const keys = new Map<Slug, RoomKey>()

  function put(slug: Slug, room: Partial<Omit<ColdRoom, 'slug'>> = {}): RoomKey {
    const key = keys.get(slug) ?? String(keys.size + 1)
    keys.set(slug, key)
    const row = store.rows.get(key)
    store.rows.set(key, {
      slug,
      name: room.name ?? row?.name ?? slug,
      access: room.access ?? row?.access ?? 'open',
      code: room.code ?? row?.code ?? null,
      settings: room.settings ?? row?.settings ?? DEFAULT_SETTINGS,
      accessEpoch: room.accessEpoch ?? row?.accessEpoch ?? 0,
    })
    return key
  }

  return {
    directory: { resolve: async (slug) => keys.get(slug) ?? put(slug) },
    store,
    history,
    put,
  }
}
