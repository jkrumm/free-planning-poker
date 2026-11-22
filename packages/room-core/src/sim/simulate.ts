/**
 * One simulated session: a room on the runtime, a seeded network, bots, admin actions over "HTTP" (the lock) and a
 * deploy (drain, then a new runtime takes the room over), the invariants after every step. A run is a pure function
 * of its seed: the same seed gives the same trace.
 */
import { PROTOCOL_VERSION } from '../protocol/names.ts'
import { DEFAULT_SETTINGS } from '../room.ts'
import { createRoomRuntime, type RoomRuntime, type RuntimeOptions } from '../runtime/runtime.ts'
import type { RuntimePorts } from '../runtime/ports.ts'
import { parseAccessCode, parseSlug, type SeatIndex } from '../values.ts'
import {
  memoryHistory,
  memoryIds,
  memorySecrets,
  memoryStore,
  telemetryRecorder,
} from './adapters.ts'
import { type Bot, BOT_KINDS, type BotKind, createBot, WRONG_CODE } from './bots.ts'
import { EPOCH } from './clock.ts'
import { checker, type Stats } from './invariants.ts'
import { network, PROFILES, type Profile } from './network.ts'
import { random } from './random.ts'
import { scheduler } from './scheduler.ts'

export type SimOptions = {
  readonly seed: number
  /** How long the bots act, in simulated milliseconds. */
  readonly durationMs?: number
  readonly faults?: RuntimeOptions['faults']
  /** Extra sockets that resume a live seat at random moments, to compare their welcome with `project`. */
  readonly probes?: number
  /** Keep every line of the trace (the hash is computed either way). */
  readonly trace?: boolean
}

export type SimResult = {
  readonly seed: number
  readonly ok: boolean
  readonly violations: readonly string[]
  readonly profile: string
  readonly bots: readonly BotKind[]
  readonly stats: Stats & {
    readonly steps: number
    readonly probes: number
    readonly deploys: number
  }
  /** The trace's hash, 16 hex digits: equal for equal traces. */
  readonly hash: string
  readonly trace: readonly string[]
}

const ROOM = '1'
const CODES = ['Kröte am See', 'K7M2QX', 'café au lait', 'Ünter Wässer']

/** Two 32-bit FNV-1a lanes with different offsets over a string's UTF-16 code units: 64 bits of trace hash. */
function fnv(hash: readonly [number, number], text: string): [number, number] {
  let [a, b] = hash
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    a = Math.imul(a ^ code, 0x01000193)
    b = Math.imul(b ^ code, 0x01000193) ^ (b >>> 15)
  }
  return [a, b]
}

export const replayCommand = (seed: number, faults?: RuntimeOptions['faults']) =>
  `bun run sim --seed ${seed}${faults?.voteAnyRound === true ? ' --fault vote-any-round' : ''}`

export async function simulate(options: SimOptions): Promise<SimResult> {
  const rng = random(options.seed)
  const clock = scheduler(EPOCH)
  const duration = options.durationMs ?? 180_000
  const end = EPOCH + duration
  const store = memoryStore()
  const history = memoryHistory()
  const telemetry = telemetryRecorder()
  const ids = memoryIds(clock.now, rng.bits)
  const lines: string[] = []
  let hash: [number, number] = [0x811c9dc5, 0x2f0b3d5d]
  const trace = (line: string) => {
    hash = fnv(hash, `${line}\n`)
    if (options.trace === true) lines.push(line)
  }

  const profile: Profile = rng.pick([
    PROFILES.calm,
    PROFILES.lossy,
    PROFILES.lossy,
    PROFILES.hostile,
  ])
  const locked = rng.chance(0.35)
  const codes = new Set<string>()
  let code = locked ? rng.pick(CODES) : null
  if (code !== null) codes.add(code.toLowerCase())
  store.rows.set(ROOM, {
    slug: parseSlug('482913')!,
    name: 'Sim Room',
    access: locked ? 'locked' : 'open',
    code: code === null ? null : parseAccessCode(code)!,
    settings: { ...DEFAULT_SETTINGS, autoReveal: rng.chance(0.5) },
    accessEpoch: 0,
  })

  const bots: Bot[] = []
  let runtime: RoomRuntime | undefined
  const check = checker({
    room: ROOM,
    now: clock.now,
    inspect: () => runtime?.inspect(ROOM),
    devices: () => bots.map((bot) => bot.device),
    codes: () => [...codes, WRONG_CODE],
    store,
    telemetry,
  })
  const net = network({ clock, rng, profile, observer: check, trace })
  const ports: RuntimePorts = {
    transport: net.transport,
    clock,
    ids,
    secrets: memorySecrets,
    store: {
      ...store,
      claim: (room) => {
        check.claimed()
        return store.claim(room)
      },
    },
    history,
    telemetry,
  }
  const runtimeOptions: RuntimeOptions =
    options.faults === undefined ? { build: 'sim' } : { build: 'sim', faults: options.faults }
  runtime = createRoomRuntime(ports, runtimeOptions)
  net.bind(runtime)

  const world = {
    rng,
    clock,
    network: net,
    room: ROOM,
    invite: () => code,
    end,
    viewed: (bot: Bot, view: Parameters<typeof check.viewed>[0]) => {
      const room = runtime?.inspect(ROOM)
      check.viewed(view, room !== undefined && bot.lastSeq === room.seq && bot.pending.size === 0)
    },
  }

  // The table: one quick voter at least, then a mix; in a locked room sometimes a stranger with a wrong code.
  const count = rng.int(3, 8)
  const kinds: BotKind[] = ['quick']
  while (kinds.length < count) kinds.push(rng.pick(BOT_KINDS))
  const addresses = [`10.0.0.${rng.int(1, 9)}`, `10.0.1.${rng.int(1, 9)}`]
  kinds.forEach((kind, n) => {
    const bot = createBot(world, n, kind, { ip: rng.pick(addresses), stranger: false })
    bots.push(bot)
    bot.start(EPOCH + rng.int(0, 5000))
  })
  if (locked && rng.chance(0.5)) {
    const stranger = createBot(world, kinds.length, 'lurker', {
      ip: rng.pick(addresses),
      stranger: true,
    })
    bots.push(stranger)
    stranger.start(EPOCH + rng.int(0, 60_000))
  }

  // A tab left open from before a protocol change.
  if (rng.chance(0.15)) {
    const old = createBot(world, bots.length, 'lurker', {
      ip: rng.pick(addresses),
      stranger: false,
      version: PROTOCOL_VERSION + 1,
    })
    bots.push(old)
    old.start(EPOCH + rng.int(0, duration))
  }

  // A player changes the lock over HTTP, sometimes sending everyone else to the door.
  const liveSeat = (): SeatIndex | null => {
    const live = bots.filter((bot) => bot.phase === 'live' && bot.view !== null)
    return live.length === 0 ? null : rng.pick(live).view!.self
  }
  for (let change = rng.int(0, 2); change > 0; change -= 1) {
    clock.at(EPOCH + rng.int(20_000, duration - 20_000), () => {
      const by = liveSeat()
      if (by === null || runtime === undefined) return
      const lock = rng.chance(0.7)
      const next = lock ? rng.pick(CODES) : null
      const reseat = lock && rng.chance(0.5)
      const result = runtime.setAccess(ROOM, {
        access: lock ? 'locked' : 'open',
        code: next === null ? null : parseAccessCode(next)!,
        by,
        reseat,
      })
      trace(
        `${clock.now()} ! access ${lock ? 'locked' : 'open'}${reseat ? ' reseat' : ''} ${result.ok ? 'ok' : result.reason}`,
      )
      if (!result.ok) return
      code = next
      if (next !== null) codes.add(next.toLowerCase())
    })
  }

  // A deploy: the old process drains, a new one claims the room from its snapshot.
  let deploys = 0
  if (rng.chance(0.3)) {
    clock.at(EPOCH + rng.int(30_000, duration - 30_000), async () => {
      const old = runtime
      if (old === undefined) return
      trace(`${clock.now()} ! deploy`)
      deploys += 1
      await old.drain()
      runtime = createRoomRuntime(ports, runtimeOptions)
      net.bind(runtime)
    })
  }

  // Probes: a second socket resumes a live seat and must be welcomed with exactly its projection.
  let probes = 0
  for (let probe = 0; probe < (options.probes ?? 0); probe += 1) {
    clock.at(EPOCH + rng.int(5_000, duration), () => {
      const live = bots.filter((bot) => bot.phase === 'live' && bot.token !== null)
      if (live.length === 0 || runtime === undefined) return
      const bot = rng.pick(live)
      let link: ReturnType<typeof net.connect> | null = null
      link = net.connect(
        {
          frame: (frame) => {
            if (frame.frame !== 'welcome' || link === null) return
            probes += 1
            net.hangUp(link, false)
          },
          close: () => {},
        },
        { room: ROOM, ip: '10.9.9.9', perfect: true },
      )
      net.send(link, {
        frame: 'hello',
        v: 1,
        build: 'probe',
        name: bot.name,
        avatar: bot.name,
        seatToken: bot.token,
      })
    })
  }

  await clock.run(end + 30_000, check.step, () => check.violations.length > 0)

  return {
    seed: options.seed,
    ok: check.violations.length === 0,
    violations: check.violations,
    profile: profile.name,
    bots: bots.map((bot) => bot.kind),
    stats: { ...check.stats, steps: clock.steps(), probes, deploys },
    hash: hash.map((lane) => (lane >>> 0).toString(16).padStart(8, '0')).join(''),
    trace: lines,
  }
}
