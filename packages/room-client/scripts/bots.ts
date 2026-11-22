/**
 * Seats bots in a real room through the room client (`bun run bots`), so one person can fill a local table.
 *
 *   bun run bots --room 482913 --seats 12 [--behaviour mixed] [--speed 2] [--origin http://localhost:7740] [--code <password>]
 *
 * It lives outside `src` because it reads its arguments and the clock. The room must exist: open one in the browser
 * (Start planning) and pass its address.
 */
import { BOT_BEHAVIOURS, type BotBehaviour, startBots } from '../src/bots.ts'
import { httpLookup } from '../src/lookup.ts'
import {
  NO_SIGNALS,
  type ClientPorts,
  type SocketConstructor,
  type StorageLike,
} from '../src/ports.ts'

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? undefined : args[index + 1]
}
const number = (name: string, fallback: number): number => {
  const value = flag(name)
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new Error(`--${name} needs a positive number, got ${value}`)
  return parsed
}

const room = flag('room')
if (room === undefined)
  throw new Error('--room <address> is needed: the number or name of a room that exists')
const behaviour = (flag('behaviour') ?? 'mixed') as BotBehaviour
if (!BOT_BEHAVIOURS.includes(behaviour))
  throw new Error(`--behaviour is one of ${BOT_BEHAVIOURS.join(', ')}`)
const origin = flag('origin') ?? 'http://localhost:7740'
const seats = Math.floor(number('seats', 5))
const speed = number('speed', 1)
const code = flag('code')

/** The server checks the origin of an upgrade; a bot is not a browser, so it names the one it stands for. */
class OriginSocket extends WebSocket {
  constructor(url: string) {
    // Bun takes request headers as the second argument; its type lists only subprotocols.
    super(url, { headers: { Origin: origin } } as unknown as string[])
  }
}

const memory = (): StorageLike => {
  const items = new Map<string, string>()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  }
}

const lookup = httpLookup({ origin, fetch })
const found = await lookup(room).catch((error: unknown) => {
  throw new Error(
    `${origin} does not answer: ${error instanceof Error ? error.message : String(error)}`,
  )
})
if (found.kind === 'free')
  throw new Error(`no room has the address ${room} on ${origin}; open one first`)

const portsFor = (): ClientPorts => ({
  WebSocket: OriginSocket as unknown as SocketConstructor,
  storage: memory(),
  timers: {
    now: Date.now,
    setTimeout: (run, ms) => setTimeout(run, ms),
    clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  },
  signals: NO_SIGNALS,
  random: Math.random,
})

const bots = startBots({
  origin,
  room,
  seats,
  behaviour,
  speed,
  portsFor,
  random: Math.random,
  ...(code === undefined ? {} : { code }),
})

const report = setInterval(() => {
  const states = bots.clients.map((client) => client.state.getSnapshot().status)
  const live = states.filter((status) => status === 'live').length
  console.log(
    `${live} of ${seats} bots live (${states.filter((status) => status !== 'live').join(', ') || 'all seated'})`,
  )
}, 5_000)

process.on('SIGINT', () => {
  clearInterval(report)
  bots.stop()
  process.exit(0)
})
console.log(`seating ${seats} ${behaviour} bots in ${room} on ${origin}; Ctrl-C stops them`)
