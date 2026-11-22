/**
 * One room of the scenario: its seats join, play ROUNDS rounds (every seat votes, one seat reveals, one revotes) and stay
 * until the run ends, while a few seats lose their socket and resume. The measurements are taken here:
 * - fan-out: from sending a command to the last of the room's seats having its event, on its socket or in the welcome
 *   that replaced it, so a seat caught by a reconnect counts its whole wait;
 * - the votes: every vote an ack promised is in the reveal that follows.
 */
import http from 'k6/http'
import { clearTimeout, setInterval, setTimeout, clearInterval } from 'k6/timers'
import { errors, fanout, socketsAtRound1, votesChecked, votesMissing } from './metrics.ts'
import { ROUNDS, THRESHOLDS, type Profile } from './profile.ts'
import { Seat, type EvtFrame, type Welcome } from './seat.ts'

const TRACK_TIMEOUT_MS = 15_000
/** How many of the deck's first cards the seats vote with: enough that a round is never unanimous. */
const CARD_SPREAD = 5

export type RoomContext = {
  readonly profile: Profile
  readonly t0: number
  readonly handoff: boolean
  readonly baseUrl: string
  readonly origin: string
  readonly index: number
}

export type RoomOutcome = {
  /** Upgrade attempts by the second of the run in which they started. */
  readonly upgrades: ReadonlyMap<number, number>
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)))

/** Counts a promise as one operation: a success or a failure, never a throw. */
async function operation(what: string, work: Promise<unknown>): Promise<boolean> {
  try {
    await work
    errors.add(0)
    return true
  } catch (error) {
    errors.add(1)
    console.error(`LOAD_ERROR ${what}: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

type Tracker = {
  readonly kind: string
  readonly sentAt: number
  readonly match: (evt: EvtFrame) => boolean
  readonly onFirst: ((evt: EvtFrame) => void) | undefined
  readonly delivered: Set<number>
  seq: number | undefined
  readonly done: (ok: boolean) => void
}

class Fanout {
  private readonly trackers = new Set<Tracker>()

  constructor(
    private readonly t0: number,
    private readonly seats: readonly Seat[],
    private readonly phaseOf: (at: number) => 'steady' | 'handoff',
  ) {}

  /** Register before sending: the event may beat the ack. */
  track(
    kind: string,
    match: (evt: EvtFrame) => boolean,
    onFirst?: (evt: EvtFrame) => void,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.trackers.delete(tracker)
        errors.add(1)
        const missing = this.seats
          .filter((seat) => !tracker.delivered.has(seat.index))
          .map((seat) => seat.describe())
        console.error(
          `LOAD_ERROR ${kind} sent at ${tracker.sentAt - this.t0} ms reached ${tracker.delivered.size} of ${this.seats.length} seats, event seq ${tracker.seq}; missing: ${missing.join('; ')}`,
        )
        resolve(false)
      }, TRACK_TIMEOUT_MS)
      const tracker: Tracker = {
        kind,
        sentAt: Date.now(),
        match,
        onFirst,
        delivered: new Set(),
        seq: undefined,
        done: (ok) => {
          clearTimeout(timer)
          resolve(ok)
        },
      }
      this.trackers.add(tracker)
    })
  }

  evt(seat: Seat, evt: EvtFrame): void {
    for (const tracker of this.trackers) {
      if (!tracker.match(evt)) continue
      if (tracker.seq === undefined) {
        tracker.seq = evt.seq
        tracker.onFirst?.(evt)
        // A seat whose welcome came before this event was first seen already holds it in its view.
        for (const other of this.seats) if (other.seq >= evt.seq) tracker.delivered.add(other.index)
      }
      tracker.delivered.add(seat.index)
      this.finish(tracker)
    }
  }

  welcome(seat: Seat, welcome: Welcome): void {
    for (const tracker of this.trackers) {
      if (tracker.seq === undefined || welcome.seq < tracker.seq) continue
      tracker.delivered.add(seat.index)
      this.finish(tracker)
    }
  }

  private finish(tracker: Tracker): void {
    if (tracker.delivered.size < this.seats.length) return
    this.trackers.delete(tracker)
    fanout.add(Date.now() - tracker.sentAt, {
      kind: tracker.kind,
      phase: this.phaseOf(tracker.sentAt),
    })
    errors.add(0)
    tracker.done(true)
  }
}

async function createRoom(ctx: RoomContext): Promise<string | undefined> {
  const response = await http.asyncRequest('POST', `${ctx.baseUrl}/api/rooms`, '{}', {
    headers: { 'Content-Type': 'application/json', Origin: ctx.origin },
    responseType: 'text',
  })
  const slug =
    response.status === 201
      ? (JSON.parse(String(response.body)) as { slug: string }).slug
      : undefined
  errors.add(slug === undefined ? 1 : 0)
  if (slug === undefined) console.error(`room ${ctx.index}: create answered ${response.status}`)
  return slug
}

export async function playRoom(ctx: RoomContext): Promise<RoomOutcome> {
  const { profile } = ctx
  const at = (seconds: number) => ctx.t0 + seconds * 1000
  const upgrades = new Map<number, number>()
  const outcome = { upgrades }
  const slug = await createRoom(ctx)
  if (slug === undefined) return outcome

  const seats: Seat[] = []
  const handoffStart = at(profile.handoffAtS)
  const phaseOf = (sentAt: number) =>
    ctx.handoff &&
    sentAt >= handoffStart &&
    sentAt < handoffStart + THRESHOLDS.handoffWindowS * 1000
      ? 'handoff'
      : 'steady'
  const room = new Fanout(ctx.t0, seats, phaseOf)
  const hooks = {
    upgrade: () => {
      const second = Math.floor((Date.now() - ctx.t0) / 1000)
      upgrades.set(second, (upgrades.get(second) ?? 0) + 1)
    },
    welcome: (seat: Seat, welcome: Welcome) => room.welcome(seat, welcome),
    evt: (seat: Seat, evt: EvtFrame) => room.evt(seat, evt),
  }
  const url = `${ctx.baseUrl.replace(/^http/, 'ws')}/api/ws/${slug}`

  await sleep(at(Math.random() * profile.joinS) - Date.now())
  for (let index = 0; index < profile.seats; index += 1) {
    const seat = new Seat(index, url, ctx.origin, hooks)
    seats.push(seat)
    try {
      await seat.join()
    } catch {
      for (const joined of seats) joined.stop()
      return outcome
    }
    await sleep(20 + Math.random() * 180)
  }
  const host = seats[0]!

  // The decision to reveal is the scenario's, so the room's own countdown is off.
  await operation('settings', host.command('room.setSettings', { autoReveal: false }))

  const churn = setInterval(() => {
    for (const seat of seats)
      if (seat.live && Math.random() < profile.reconnectPerMinute / 60) seat.drop()
  }, 1000)

  for (let round = 1; round <= ROUNDS; round += 1) {
    await sleep(
      at(
        profile.roundsAtS + (round - 1) * profile.roundGapS + Math.random() * profile.roundSpreadS,
      ) - Date.now(),
    )
    if (round === 1) socketsAtRound1.add(seats.filter((seat) => seat.live).length)

    // seat number -> the card its vote was acknowledged with
    const acked = new Map<number, string>()
    await Promise.all(
      seats.map(async (seat, index) => {
        await sleep(Math.random() * profile.voteSpreadS * 1000)
        const target = seat.round
        const card = seat.cards[(index + round) % Math.min(CARD_SPREAD, seat.cards.length)]!
        const seen = room.track(
          'vote',
          (evt) =>
            evt.type === 'poker.voted' &&
            evt.payload.round === target &&
            evt.payload.seat === seat.seatNo,
        )
        if (
          await operation(
            `vote ${slug}/${index}`,
            seat.command('poker.vote', { round: target, card }),
          )
        )
          acked.set(seat.seatNo, card)
        await seen
      }),
    )

    const target = host.round
    const revealed = room.track(
      'reveal',
      (evt) => evt.type === 'poker.revealed' && evt.payload.round === target,
      (evt) => {
        for (const [seatNo, card] of acked) {
          votesChecked.add(1)
          const found = evt.payload.votes?.find((vote) => vote.seat === seatNo)
          if (found?.card?.label === card) continue
          votesMissing.add(1)
          console.error(`LOAD_MISSING room=${slug} round=${round} seat=${seatNo} card=${card}`)
        }
      },
    )
    await operation(`reveal ${slug}`, host.command('poker.reveal', { round: target }))
    await revealed

    if (round < ROUNDS) {
      const next = room.track('revote', (evt) => evt.type === 'poker.roundStarted')
      await operation(`revote ${slug}`, host.command('poker.revote', { round: target }))
      await next
    }
  }

  await sleep(at(profile.endAtS) - Date.now())
  clearInterval(churn)
  for (const seat of seats) seat.stop()
  return outcome
}
