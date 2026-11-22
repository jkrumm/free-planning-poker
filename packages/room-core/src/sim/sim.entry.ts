/**
 * `@fpp/room-core/sim`: deterministic context for tests, the in-memory adapters of the runtime's ports, the seeded
 * scheduler and network, the bots, the invariants, and `simulate`, which plays one seeded session.
 */
export { EPOCH, generator, seededClock, uuidv7 } from './clock.ts'
export type { SeededClock } from './clock.ts'
export { random } from './random.ts'
export type { Random } from './random.ts'
export { scheduler } from './scheduler.ts'
export type { Scheduler } from './scheduler.ts'
export { sha256 } from './sha256.ts'
export {
  memoryHistory,
  memoryIds,
  memorySecrets,
  memoryStore,
  telemetryRecorder,
} from './adapters.ts'
export type { MemoryHistory, MemoryStore, TelemetryRecorder } from './adapters.ts'
export { network, PROFILES } from './network.ts'
export type { Client, Link, Network, Observer, Profile } from './network.ts'
export { BOT_KINDS, createBot, WRONG_CODE } from './bots.ts'
export type { Bot, BotKind, BotWorld } from './bots.ts'
export { checker, foreignCards } from './invariants.ts'
export type { Checker, Stats } from './invariants.ts'
export { replayCommand, simulate } from './simulate.ts'
export type { SimOptions, SimResult } from './simulate.ts'
