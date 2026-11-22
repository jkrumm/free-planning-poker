import { Counter, Rate, Trend } from 'k6/metrics'

/** From sending a command to the last seat having its event; tagged `kind` (vote, reveal, revote) and `phase` (steady, handoff). */
export const fanout = new Trend('fanout_ms', true)
/** From losing a socket to the welcome of its replacement. */
export const resume = new Trend('resume_ms', true)
/** One sample per operation: 0 when it succeeded, 1 when it failed. */
export const errors = new Rate('errors')
/** Acknowledged votes a reveal did not carry, or carried with another card. */
export const votesMissing = new Counter('votes_missing')
/** Acknowledged votes compared with their reveal. */
export const votesChecked = new Counter('votes_checked')
export const commandsAcked = new Counter('commands_acked')
/** Events that skipped a seq: the seat reconnected with its last seq, as the protocol says. */
export const seqGaps = new Counter('seq_gaps')
/** Sockets replaced after they were lost, resumed with their seat. */
export const reconnects = new Counter('reconnects')
/** Upgrades that ended before a welcome; each is retried. */
export const upgradeFailures = new Counter('upgrade_failures')
/** Sockets of one room open when its first round started: summed over rooms, the sockets open at once. */
export const socketsAtRound1 = new Trend('sockets_at_round1')
