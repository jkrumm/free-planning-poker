/**
 * A room as the store keeps it between processes (docs/v9/ARCHITECTURE.md, Server: Ownership and handoff): the
 * reducer's state, the room's `seq`, and beside them what only the server may hold, the hash of each seat's token
 * and the access epoch it was minted in. The device id is never part of it: it stays on the connection.
 */
import { check } from '../check.ts'
import type { RoomState } from '../state.ts'
import type { SeatIndex } from '../values.ts'

export const SNAPSHOT_VERSION = 1

/** What the server keeps about one seat beyond `RoomState`. */
export type SeatSecret = {
  readonly seat: SeatIndex
  /** SHA-256 of the seat token, hex. */
  readonly hash: string
  /** The room's access epoch when the seat was minted; a lower one than the room's is closed with 4004. */
  readonly epoch: number
  /** The UTC day of the seat's last vote that reached history as an estimating day, or null. */
  readonly votedOn: string | null
}

export type RoomSnapshot = {
  readonly v: typeof SNAPSHOT_VERSION
  readonly state: RoomState
  readonly seq: number
  readonly accessEpoch: number
  readonly seats: readonly SeatSecret[]
}

export function exportSnapshot(room: {
  readonly state: RoomState
  readonly seq: number
  readonly accessEpoch: number
  readonly secrets: ReadonlyMap<SeatIndex, SeatSecret>
}): RoomSnapshot {
  return {
    v: SNAPSHOT_VERSION,
    state: room.state,
    seq: room.seq,
    accessEpoch: room.accessEpoch,
    seats: [...room.secrets.values()],
  }
}

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === 'object' && input !== null && !Array.isArray(input)

const isCount = (input: unknown): input is number =>
  typeof input === 'number' && Number.isSafeInteger(input) && input >= 0

/**
 * Reads what the store returned. The store holds only what `exportSnapshot` wrote, so this checks the envelope and
 * the room's invariants and returns `undefined` for anything else: the room then starts cold.
 */
export function importSnapshot(input: unknown): RoomSnapshot | undefined {
  if (!isRecord(input) || input['v'] !== SNAPSHOT_VERSION) return undefined
  const { state, seq, accessEpoch, seats } = input
  if (!isRecord(state) || !isCount(seq) || !isCount(accessEpoch) || !Array.isArray(seats))
    return undefined
  const valid = seats.every(
    (entry) =>
      isRecord(entry) &&
      isCount(entry['seat']) &&
      typeof entry['hash'] === 'string' &&
      isCount(entry['epoch']) &&
      (entry['votedOn'] === null || typeof entry['votedOn'] === 'string'),
  )
  if (!valid) return undefined
  const room = state as RoomState
  if (!Array.isArray(room.seats) || check(room).length > 0) return undefined
  return input as RoomSnapshot
}
