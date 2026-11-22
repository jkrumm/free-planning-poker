/**
 * The room's Umami events, sent by the client that caused them (docs/v9/ARCHITECTURE.md, Measurement). Each carries
 * the activity and a bucket or a flag, never a vote value, a name or a slug: `track` takes only what the registry in
 * `@fpp/telemetry/umami` lists, which is the content policy (rule `telemetry.md`).
 */
import { track } from '@fpp/telemetry/browser'
import { bucketOf, UMAMI_EVENT } from '@fpp/telemetry/umami'
import type { Command, RoundId, View } from '@fpp/room-core/types'
import { distribution, isConsensus } from '@fpp/room-core/view'

export type Funnel = {
  /** A command of this seat and whether the room accepted it. */
  readonly command: (command: Command, accepted: boolean) => void
  /** The seat's view as it is now; `null` before the room has sent one. */
  readonly view: (view: View | null) => void
}

/**
 * One per room and page load: `room_joined` and `vote_cast` are sent once whatever the connection does. A reveal or a
 * decision is sent by the seat that issued the command, when the view shows its result; an automatic reveal has no
 * such seat and sends none.
 */
export function createFunnel(): Funnel {
  let latest: View | null = null
  let joined = false
  let voted = false
  const revealedBy = new Set<RoundId>()
  const decidedBy = new Set<RoundId>()
  const sent = new Set<string>()

  const once = (key: string, send: () => void) => {
    if (sent.has(key)) return
    sent.add(key)
    send()
  }

  const settle = () => {
    const view = latest
    if (view === null) return
    for (const round of view.activity.rounds) {
      if (round.state !== 'revealed') continue
      if (revealedBy.has(round.id))
        once(`revealed:${round.id}`, () =>
          track(UMAMI_EVENT.roundRevealed, {
            activity: 'poker',
            votes: bucketOf(round.votes.length),
            consensus: isConsensus(distribution(round.deck, round.votes)),
          }),
        )
      const topic = view.topics.find((candidate) => candidate.final?.round === round.id)
      if (topic?.final && decidedBy.has(round.id)) {
        const how = topic.final.decidedBy === 'agreed' ? 'unanimous' : 'settled'
        once(`decided:${round.id}:${how}`, () =>
          track(UMAMI_EVENT.topicDecided, { activity: 'poker', how }),
        )
      }
    }
  }

  return {
    view: (view) => {
      latest = view
      if (view === null) return
      if (!joined) {
        joined = true
        track(UMAMI_EVENT.roomJoined, { activity: 'poker', seats: bucketOf(view.seats.length) })
      }
      settle()
    },
    command: (command, accepted) => {
      if (!accepted) return
      if (command.type === 'poker.vote' && !voted) {
        voted = true
        track(UMAMI_EVENT.voteCast, { activity: 'poker' })
      }
      if (command.type === 'poker.reveal') {
        revealedBy.add(command.payload.round)
        decidedBy.add(command.payload.round)
      }
      if (command.type === 'poker.cancelReveal') {
        revealedBy.delete(command.payload.round)
        decidedBy.delete(command.payload.round)
      }
      if (command.type === 'poker.settle') decidedBy.add(command.payload.round)
      settle()
    },
  }
}
