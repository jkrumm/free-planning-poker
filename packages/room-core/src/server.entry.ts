/**
 * `@fpp/room-core/server`: the room's rules. `decide`, `evolve` and `step` change a room; `project` and `publish`
 * are the only ways anything about it leaves the server; `check` asserts its invariants.
 */
export { decide, DEFAULT_SETTINGS, evolve, initialState, step } from './room.ts'
export type { StepResult } from './room.ts'
export { project, publish } from './project.ts'
export { check } from './check.ts'
export { buildDecidedResult, buildRevealedResult } from './result.ts'
export type { ResultInput } from './result.ts'
export { parseTopicLine, parseTopicLines, refFromUrl } from './paste.ts'
export type * from './state.ts'
