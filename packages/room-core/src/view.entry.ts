/**
 * `@fpp/room-core/view`: what a client runs on a seat's view. It holds no rule of the room: those stay on the server.
 */
export {
  activeTopicOf,
  currentRound,
  evolveView,
  latestRound,
  ownSeat,
  withOwnVote,
} from './view.ts'
export { buildDecidedResult, buildRevealedResult, distribution, isConsensus } from './result.ts'
export type { ResultInput } from './result.ts'
export { parseTopicLine, parseTopicLines, refFromUrl } from './paste.ts'
