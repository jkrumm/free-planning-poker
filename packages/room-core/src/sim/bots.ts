/**
 * Simulated participants. Each bot speaks the protocol as a browser would (hello, resume with its token and last
 * seq, a gap in seq means reconnect, unacknowledged commands are sent again with the same id after a welcome) and
 * acts by its kind: a quick voter, a lurker, a phone that sleeps, a spectator, a spammer. Every choice is drawn from
 * the run's seeded source.
 */
import { findCard } from '../decks.ts'
import { PROTOCOL_VERSION } from '../protocol/names.ts'
import type { Command, Event, RoundView, ServerFrame, View } from '../protocol/types.ts'
import type { RoomKey } from '../runtime/ports.ts'
import { currentRound, evolveView, ownSeat, withOwnVote } from '../view.ts'
import type { Link, Network } from './network.ts'
import type { Random } from './random.ts'
import type { Scheduler } from './scheduler.ts'

export const BOT_KINDS = ['quick', 'lurker', 'sleeper', 'spectator', 'spammer'] as const
export type BotKind = (typeof BOT_KINDS)[number]

export type BotWorld = {
  readonly rng: Random
  readonly clock: Scheduler
  readonly network: Network
  readonly room: RoomKey
  /** The code a teammate reads out from the invite link: the room's current one, or null when it is open. */
  readonly invite: () => string | null
  /** Bots stop acting at this time and only answer the server after it. */
  readonly end: number
  /** A bot's view after it applied a frame: whether it is caught up, for the checker. */
  readonly viewed: (bot: Bot, view: View) => void
}

export type Bot = {
  readonly n: number
  readonly kind: BotKind
  readonly device: string
  name: string
  token: string | null
  view: View | null
  lastSeq: number
  /** Commands sent and not yet answered, by id. */
  readonly pending: Map<string, object>
  phase: 'offline' | 'connecting' | 'live' | 'asleep' | 'done'
  /** Connects at `at` and starts acting. */
  readonly start: (at: number) => void
}

const THINK: Record<BotKind, readonly [number, number]> = {
  quick: [300, 2500],
  lurker: [4000, 15000],
  sleeper: [1000, 5000],
  spectator: [2000, 8000],
  spammer: [3000, 12000],
}

const EMOJI = ['👍', '🎉', '☕', '🤔'] as const
const NAMES = ['Ada', 'Bo', 'Cem', 'Dana', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivo', 'Jo'] as const

const cards = (round: RoundView) => round.deck.cards.map((card) => card.label)

/** A wrong code, for the stranger who has only the room's number. */
export const WRONG_CODE = 'not-the-code'

export function createBot(
  world: BotWorld,
  n: number,
  kind: BotKind,
  options: {
    readonly ip: string
    readonly stranger: boolean
    /** A tab of another build speaks another protocol version and is sent away with 4001. */
    readonly version?: number
  },
): Bot {
  const { rng, clock, network } = world
  const bot: Bot = {
    n,
    kind,
    device: `device-${n}-${rng.bits().toString(36)}`,
    name: `${NAMES[n % NAMES.length]!}${n >= NAMES.length ? n : ''}`,
    token: null,
    view: null,
    lastSeq: 0,
    pending: new Map(),
    phase: 'offline',
    start(at) {
      clock.at(at, () => {
        connect()
        clock.at(now() + rng.int(...THINK[kind]), think)
      })
    },
  }
  let link: Link | null = null
  let counter = 0
  let heard = 0
  let tries = 0
  /** The id of the latest vote or clear sent: an older vote's late ack must not put its card back. */
  let latestVote: string | null = null

  const now = () => clock.now()

  /** The token is gone: what was sent for the old seat belongs to nobody now. */
  const forget = () => {
    bot.token = null
    bot.pending.clear()
    latestVote = null
  }
  const acting = () => now() < world.end

  function connect() {
    if (bot.phase === 'done' || bot.phase === 'asleep') return
    const code = options.stranger ? WRONG_CODE : world.invite()
    let mine: Link | null = null
    const client = {
      frame(frame: ServerFrame) {
        if (mine === null || mine !== link) return
        heard = now()
        receive(frame)
      },
      close(reason: number) {
        if (mine === null || mine !== link) return
        link = null
        closed(reason)
      },
    }
    const opened = network.connect(client, { room: world.room, ip: options.ip })
    mine = opened
    link = opened
    bot.phase = 'connecting'
    heard = now()
    const hello: Record<string, unknown> = {
      frame: 'hello',
      v: options.version ?? PROTOCOL_VERSION,
      build: 'sim',
      name: bot.name,
      avatar: bot.name,
      device: bot.device,
    }
    if (bot.token !== null) {
      hello['seatToken'] = bot.token
      hello['lastSeq'] = bot.lastSeq
    }
    if (code !== null) hello['code'] = code
    network.send(opened, hello)
    // A welcome lost on the way: try again.
    clock.at(now() + 10_000, () => {
      if (link === opened && bot.phase === 'connecting') drop(rng.int(500, 3000))
    })
  }

  /** Leaves the current socket and connects again after `after` ms. */
  function drop(after: number, silent = false) {
    if (link !== null) network.hangUp(link, silent)
    link = null
    if (bot.phase === 'done') return
    bot.phase = 'offline'
    clock.at(now() + after, () => {
      if (bot.phase === 'offline') connect()
    })
  }

  function send(command: Command) {
    if (link === null || bot.phase !== 'live') return
    counter += 1
    const frame = { frame: 'cmd', id: `b${n}-${counter}`, ...command }
    bot.pending.set(frame.id, frame)
    if (command.type === 'poker.vote' || command.type === 'poker.clearVote') latestVote = frame.id
    if (bot.pending.size > 30) bot.pending.delete(bot.pending.keys().next().value!)
    network.send(link, frame)
  }

  const raw = (frame: object) => {
    if (link !== null && bot.phase === 'live') network.send(link, frame)
  }

  function receive(frame: ServerFrame) {
    switch (frame.frame) {
      case 'welcome': {
        bot.phase = 'live'
        bot.token = frame.seatToken
        bot.view = frame.view
        bot.lastSeq = frame.seq
        tries = 0
        world.viewed(bot, frame.view)
        // Commands nobody answered go again with their ids; the room applies each once.
        for (const pending of bot.pending.values()) raw(pending)
        return
      }
      case 'evt': {
        if (bot.view === null || frame.seq <= bot.lastSeq) return
        if (frame.seq !== bot.lastSeq + 1) return drop(rng.int(100, 1000))
        const { frame: _frame, seq: _seq, ...event } = frame
        bot.view = evolveView(bot.view, event as Event)
        bot.lastSeq = frame.seq
        const me = ownSeat(bot.view)
        if (me !== undefined) bot.name = me.name
        world.viewed(bot, bot.view)
        return
      }
      case 'ack': {
        const sent = bot.pending.get(frame.id) as (Command & { frame: 'cmd' }) | undefined
        bot.pending.delete(frame.id)
        if (sent?.type === 'poker.vote' && frame.id === latestVote && bot.view !== null) {
          const round = bot.view.activity.rounds.find((r) => r.id === sent.payload.round)
          const card = round === undefined ? undefined : findCard(round.deck, sent.payload.card)
          if (card !== undefined && round?.state === 'voting')
            bot.view = withOwnVote(bot.view, round.id, card)
          world.viewed(bot, bot.view)
        }
        return
      }
      case 'nack':
        bot.pending.delete(frame.id)
        return
      case 'ping':
        return raw({ frame: 'pong' })
      default:
        return
    }
  }

  function closed(code: number) {
    bot.phase = 'offline'
    switch (code) {
      case 4001:
        bot.phase = 'done'
        return
      case 4002:
        return drop(rng.int(0, 2000))
      case 4003:
        // Kicked: some come back as a new seat later.
        forget()
        if (rng.chance(0.5)) return drop(rng.int(10_000, 60_000))
        bot.phase = 'done'
        return
      case 4004:
        forget()
        return drop(rng.int(500, 5000))
      case 4005:
        tries += 1
        if (tries > 6) {
          bot.phase = 'done'
          return
        }
        return drop(rng.int(5000, 30_000))
      case 4008:
        return drop(rng.int(5000, 30_000))
      case 1000:
        forget()
        if (rng.chance(0.5)) return drop(rng.int(5000, 30_000))
        bot.phase = 'done'
        return
      default:
        return drop(rng.int(500, 5000))
    }
  }

  // Behaviour.

  function vote(round: RoundView) {
    send({ type: 'poker.vote', payload: { round: round.id, card: rng.pick(cards(round)) } })
  }

  /** A vote that names a round which is no longer current: what a slow network delivers late. */
  function voteStale(view: View) {
    const old = view.activity.rounds.filter((round) => round.id !== view.activity.current)
    if (old.length === 0) return
    const round = rng.pick(old)
    send({ type: 'poker.vote', payload: { round: round.id, card: rng.pick(cards(round)) } })
  }

  function runRoom(view: View, round: RoundView, r: number) {
    const others = view.seats.filter((seat) => seat.index !== view.self)
    if (round.state === 'revealed') {
      if (r < 0.4) return send({ type: 'topic.next', payload: { round: round.id } })
      if (r < 0.5) return send({ type: 'poker.revote', payload: { round: round.id } })
      if (r < 0.6) {
        const numbered = round.deck.cards.filter((card) => card.value !== null)
        if (numbered.length === 0) return
        const card = rng.pick(numbered).label
        return send({ type: 'poker.settle', payload: { round: round.id, card } })
      }
    }
    if (r < 0.62)
      return send({
        type: 'topic.add',
        payload: {
          topics: Array.from({ length: rng.int(1, 3) }, () => ({
            title: `Topic ${rng.int(1, 999)}`,
            url: null,
            ref: null,
          })),
        },
      })
    if (r < 0.64)
      return send({
        type: 'room.setSettings',
        payload: {
          autoReveal: rng.chance(0.6),
          revealCountdown: rng.int(0, 3),
          timer: rng.pick([0, 30, 60] as const),
        },
      })
    if (r < 0.68)
      return raw({ frame: 'fx', type: 'seat.react', payload: { emoji: rng.pick(EMOJI), to: null } })
    if (r < 0.685 && others.length > 0)
      return send({ type: 'seat.kick', payload: { seat: rng.pick(others).index } })
    if (r < 0.69) {
      // A cleared browser: the token is gone, the name is not.
      forget()
      return drop(rng.int(1000, 10_000))
    }
    if (r < 0.7)
      return send({
        type: 'seat.setPresence',
        payload: { presence: ownSeat(view)?.presence === 'away' ? 'active' : 'away' },
      })
    if (r < 0.702) return send({ type: 'seat.leave', payload: {} })
    if (r < 0.706)
      return send({ type: 'seat.rename', payload: { name: `${bot.name.slice(0, 20)}'` } })
  }

  function quick(view: View) {
    const round = currentRound(view)
    const me = ownSeat(view)
    if (me === undefined) return
    const voting = round.state === 'voting'
    const mine = round.votes.some((v) => v.seat === view.self && v.card !== null)
    const r = rng.next()
    if (me.role === 'player' && voting && !mine && r < 0.8) return vote(round)
    if (voting && r < 0.05) return vote(round)
    if (voting && r < 0.07) return send({ type: 'poker.clearVote', payload: { round: round.id } })
    if (voting && round.votes.length > 0 && r < 0.2)
      return send({ type: 'poker.reveal', payload: { round: round.id } })
    if (voting && round.countdown !== null && r < 0.25)
      return send({ type: 'poker.cancelReveal', payload: { round: round.id } })
    runRoom(view, round, r)
  }

  function act() {
    const view = bot.view
    if (view === null) return
    const round = currentRound(view)
    const me = ownSeat(view)
    if (me === undefined) return
    switch (kind) {
      case 'quick':
        return quick(view)
      case 'lurker': {
        const mine = round.votes.some((v) => v.seat === view.self && v.card !== null)
        if (round.state === 'voting' && me.role === 'player' && !mine && rng.chance(0.6))
          return vote(round)
        if (rng.chance(0.1))
          return send({
            type: 'seat.setPresence',
            payload: { presence: me.presence === 'away' ? 'active' : 'away' },
          })
        return
      }
      case 'sleeper': {
        if (rng.chance(0.05) && link !== null) {
          // The screen goes off: nothing in or out, and nobody is told.
          const asleep = link
          network.sleep(asleep)
          bot.phase = 'asleep'
          clock.at(now() + rng.int(20_000, 150_000), () => {
            if (bot.phase !== 'asleep') return
            bot.phase = 'offline'
            if (link === asleep) drop(0, true)
          })
          return
        }
        return quick(view)
      }
      case 'spectator': {
        if (me.role === 'player' && rng.chance(0.9))
          return send({ type: 'seat.setRole', payload: { seat: view.self, role: 'spectator' } })
        if (me.role === 'spectator' && rng.chance(0.05))
          return send({ type: 'seat.setRole', payload: { seat: view.self, role: 'player' } })
        if (rng.chance(0.3))
          return raw({
            frame: 'fx',
            type: 'seat.react',
            payload: { emoji: rng.pick(EMOJI), to: me.index },
          })
        return
      }
      case 'spammer': {
        if (!rng.chance(0.4)) return quick(view)
        const burst = rng.int(12, 40)
        for (let i = 0; i < burst; i += 1) {
          const r = rng.next()
          if (r < 0.35) vote(round)
          else if (r < 0.55) voteStale(view)
          else if (r < 0.7)
            raw({ frame: 'fx', type: 'seat.react', payload: { emoji: '🎉', to: null } })
          else if (r < 0.8) raw({ frame: 'ping' })
          else if (r < 0.9)
            raw({ frame: 'cmd', id: `junk-${i}`, type: 'poker.nothing', payload: {} })
          else send({ type: 'room.setTitle', payload: { name: `Room ${rng.int(1, 99)}` } })
        }
        return
      }
    }
  }

  function think() {
    if (!acting()) return
    if (bot.phase === 'live') {
      // No frame for 60 s, pings included: the socket is dead without anyone saying so.
      if (now() - heard > 60_000) drop(rng.int(500, 3000), true)
      else act()
    }
    const [low, high] = THINK[kind]
    clock.at(now() + rng.int(low, high), think)
  }

  return bot
}
