/**
 * The shape of a load run and its two sizes, shared by the k6 scenario and the orchestrator (`load/run.ts`). Pure data:
 * k6 runs the scenario in its own runtime, so nothing here may touch Bun.
 */

export type Profile = {
  readonly rooms: number
  readonly seats: number
  /** Rooms one k6 virtual user plays side by side; a user costs memory, a room's sockets cost almost none. */
  readonly roomsPerVu: number
  /** Seconds from the start in which rooms are created and their seats join, spread evenly. */
  readonly joinS: number
  /** Seconds from the start at which the first round's slot opens. */
  readonly roundsAtS: number
  readonly roundGapS: number
  /** A room starts its round at a random moment this long after the slot opens. */
  readonly roundSpreadS: number
  /** The seats of a room vote at random moments within this. */
  readonly voteSpreadS: number
  /** Seconds from the start at which every room leaves. */
  readonly endAtS: number
  /** Seconds from the start at which the handoff run stops the old API container. */
  readonly handoffAtS: number
  /** The share of seats that lose their socket and reconnect each minute. */
  readonly reconnectPerMinute: number
}

/** Every room plays this many rounds: vote, reveal, and a revote between them. */
export const ROUNDS = 3

/** The thresholds of docs/v9/ARCHITECTURE.md (Server, Scale target) and the plan row `v9-load`. */
export const THRESHOLDS = {
  /** p99 from sending a command to the last seat receiving its event. */
  fanoutP99Ms: 100,
  /** Failed operations (join, resume, command, reveal check) over all of them. */
  errorRate: 0.001,
  /** The drain of the old container; latency is not held to the threshold while it runs. */
  handoffWindowS: 20,
} as const

export const PROFILES = {
  /** The claim: 500 rooms of 10 seats. The handoff lands in round 2, while its votes are coming in. */
  full: {
    rooms: 500,
    seats: 10,
    roomsPerVu: 5,
    joinS: 30,
    roundsAtS: 50,
    roundGapS: 40,
    roundSpreadS: 10,
    voteSpreadS: 5,
    endAtS: 170,
    handoffAtS: 95,
    reconnectPerMinute: 0.01,
  },
  /** The nightly guard on a hosted runner: a tenth of the rooms, the same shape. Not a capacity claim. */
  nightly: {
    rooms: 50,
    seats: 10,
    roomsPerVu: 5,
    joinS: 10,
    roundsAtS: 20,
    roundGapS: 20,
    roundSpreadS: 5,
    voteSpreadS: 3,
    endAtS: 85,
    handoffAtS: 43,
    reconnectPerMinute: 0.01,
  },
} as const satisfies Record<string, Profile>

export type ProfileName = keyof typeof PROFILES
