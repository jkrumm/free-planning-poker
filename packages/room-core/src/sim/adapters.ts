/**
 * The in-memory adapters of the runtime's ports: what tests and the simulator run the runtime on in place of
 * Postgres, OpenTelemetry and the system's clock and randomness (docs/v9/ARCHITECTURE.md, Server: the port table).
 */
import type {
  ColdRoom,
  History,
  IdSource,
  Ownership,
  RoomKey,
  RoomStore,
  RuntimeAction,
  RuntimeTelemetry,
  Secrets,
} from '../runtime/ports.ts'
import type { RoomSnapshot } from '../runtime/snapshot.ts'
import type { DecidedResult, RevealedResult } from '../protocol/types.ts'
import type { RoundRecord } from '../state.ts'
import { uuidv7 } from './clock.ts'
import { sha256 } from './sha256.ts'

/** UUID v7 at the clock's time and random bytes, both from one seeded source of 32-bit values. */
export function memoryIds(now: () => number, bits: () => number): IdSource {
  return {
    newId: () => uuidv7(now(), bits),
    bytes: (n) => {
      const out = new Uint8Array(n)
      for (let index = 0; index < n; index += 1) out[index] = bits() & 255
      return out
    },
  }
}

export const memorySecrets: Secrets = { hash: sha256 }

export type MemoryStore = RoomStore & {
  /** The rooms that exist, as a row would hold them. */
  readonly rows: Map<RoomKey, ColdRoom>
  /** The live snapshots, as the store last received them. */
  readonly snapshots: Map<RoomKey, RoomSnapshot>
  /** Every snapshot written, in order, for checks on what the store receives. */
  readonly written: RoomSnapshot[]
  /** Makes the next writes of a room report `lost`, as if another process had claimed it. */
  readonly steal: (room: RoomKey) => void
}

export function memoryStore(): MemoryStore {
  const rows = new Map<RoomKey, ColdRoom>()
  const snapshots = new Map<RoomKey, RoomSnapshot>()
  const stolen = new Set<RoomKey>()
  const written: RoomSnapshot[] = []
  const keep = (room: RoomKey, snapshot: RoomSnapshot): Ownership => {
    if (stolen.has(room)) return 'lost'
    // The runtime's state is immutable data and the snapshot a fresh envelope, so keeping it costs no copy; a claim
    // returns it through JSON, as a database would.
    snapshots.set(room, snapshot)
    written.push(snapshot)
    return 'owned'
  }
  return {
    rows,
    snapshots,
    written,
    steal: (room) => {
      stolen.add(room)
    },
    claim: async (room) => {
      stolen.delete(room)
      const snapshot = snapshots.get(room)
      if (snapshot !== undefined)
        return { kind: 'live', snapshot: JSON.parse(JSON.stringify(snapshot)) as unknown }
      const row = rows.get(room)
      return row === undefined ? { kind: 'missing' } : { kind: 'cold', room: row }
    },
    write: async (room, snapshot) => keep(room, snapshot),
    release: async (room, snapshot) => keep(room, snapshot),
  }
}

export type MemoryHistory = History & {
  readonly rounds: {
    readonly room: RoomKey
    readonly result: RevealedResult
    readonly round: RoundRecord
  }[]
  readonly decisions: { readonly room: RoomKey; readonly result: DecidedResult }[]
  /** `day|device` of every estimating day received, repeats included. */
  readonly days: string[]
}

export function memoryHistory(): MemoryHistory {
  const rounds: MemoryHistory['rounds'] = []
  const decisions: MemoryHistory['decisions'] = []
  const days: string[] = []
  return {
    rounds,
    decisions,
    days,
    round: (room, entry) => {
      rounds.push({ room, ...entry })
    },
    decision: (room, result) => {
      decisions.push({ room, result })
    },
    estimatingDay: ({ day, device }) => {
      days.push(`${day}|${device}`)
    },
  }
}

export type TelemetryRecorder = RuntimeTelemetry & {
  readonly failures: { readonly error: unknown; readonly action: RuntimeAction }[]
  readonly closes: number[]
}

export function telemetryRecorder(): TelemetryRecorder {
  const failures: TelemetryRecorder['failures'] = []
  const closes: number[] = []
  return {
    failures,
    closes,
    failure: (error, { action }) => {
      failures.push({ error, action })
    },
    closed: (code) => {
      closes.push(code)
    },
  }
}
