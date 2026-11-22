/**
 * `@fpp/room-core/protocol`: the Zod schemas that parse a frame where it enters the server, with the types, names and
 * value objects beside them. A browser bundle imports `/types` instead, which ships no validator.
 */
export * from './protocol/schema.ts'
export * from './types.entry.ts'
