/**
 * The transport bake-off (docs/v9/evidence/transport.md): against each adapter, in a server process of its own, a burst
 * of 2,000 sockets in 200 rooms that vote and reveal, and a slow consumer under a flood of 1,000 events. Prints one
 * JSON line per run. `bun apps/api/scripts/bake-off.ts [adapter ...] [--runs n]`.
 */
import type { ServerFrame } from '@fpp/room-core/types'
import { join, type TestClient } from '../test/contract/client.ts'
import { ADAPTERS, type AdapterName } from '../test/contract/harness.ts'

const args = Bun.argv.slice(2)
const runsAt = args.indexOf('--runs')
const runs = runsAt === -1 ? 3 : Number(args[runsAt + 1])
const chosen = args.filter((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--runs')
const adapters = (chosen.length > 0 ? chosen : Object.keys(ADAPTERS)) as AdapterName[]

const ROOMS = 200
const SEATS = 10
const PHASE_LIMIT_MS = 60_000

type Server = {
  readonly port: number
  readonly ask: (line: string, key: string) => Promise<Record<string, unknown>>
  readonly stop: () => Promise<Record<string, unknown>>
}

async function spawnServer(adapter: AdapterName): Promise<Server> {
  const child = Bun.spawn(
    ['bun', new URL('./bake-off-server.ts', import.meta.url).pathname, adapter, '0'],
    {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'inherit',
    },
  )
  const waiting = new Map<string, (message: Record<string, unknown>) => void>()
  const lines = (async () => {
    const decoder = new TextDecoder()
    let buffered = ''
    for await (const chunk of child.stdout) {
      buffered += decoder.decode(chunk)
      let end = buffered.indexOf('\n')
      while (end !== -1) {
        const line = buffered.slice(0, end)
        buffered = buffered.slice(end + 1)
        end = buffered.indexOf('\n')
        if (!line.startsWith('{')) continue
        const message = JSON.parse(line) as Record<string, unknown>
        for (const [key, resolve] of waiting)
          if (key in message) {
            waiting.delete(key)
            resolve(message)
          }
      }
    }
  })()
  const expect = (key: string) =>
    new Promise<Record<string, unknown>>((resolve) => {
      waiting.set(key, resolve)
    })
  const ready = await expect('ready')
  return {
    port: Number(ready['port']),
    ask(line, key) {
      const answer = expect(key)
      child.stdin.write(`${line}\n`)
      child.stdin.flush()
      return answer
    },
    async stop() {
      const answer = expect('stopped')
      child.stdin.write('stop\n')
      child.stdin.flush()
      const message = await answer
      await child.exited
      await lines
      return message
    },
  }
}

const percentile = (sorted: readonly number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? NaN

function bounded<T>(work: Promise<T>, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    work,
    new Promise<T>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${what} did not finish within ${PHASE_LIMIT_MS} ms`)),
        PHASE_LIMIT_MS,
      )
    }),
  ]).finally(() => clearTimeout(timer))
}

type Seat = {
  readonly client: TestClient
  readonly seat: number
  readonly round: string
  readonly seq: number
}

/** Every evt a socket got after its welcome, in seq order with no gap: no frame was lost. */
function contiguous(seat: Seat): boolean {
  let expected = seat.seq + 1
  for (const frame of seat.client.frames) {
    if (frame.frame !== 'evt') continue
    if (frame.seq !== expected) return false
    expected += 1
  }
  return true
}

async function burst(adapter: AdapterName) {
  const server = await spawnServer(adapter)
  const url = (room: number) => `ws://127.0.0.1:${server.port}/api/ws/${100_000 + room}`
  const slugs = Array.from({ length: ROOMS }, (_, room) => String(100_000 + room))
  await server.ask(`prepare ${slugs.join(',')}`, 'prepared')
  const idle = await server.ask('stats', 'stats')

  const rooms: Seat[][] = []
  const joinStarted = performance.now()
  for (let room = 0; room < ROOMS; room += 1) {
    const seats: Seat[] = []
    // A room's seats join one after the other, as people do; the rooms join side by side.
    rooms.push(seats)
  }
  await bounded(
    Promise.all(
      rooms.map(async (seats, room) => {
        for (let index = 0; index < SEATS; index += 1) {
          const { client, welcome } = await join(url(room), { name: `Seat ${index}` })
          seats.push({
            client,
            seat: welcome.seat,
            round: welcome.view.activity.current,
            seq: welcome.seq,
          })
        }
      }),
    ),
    'the joins',
  )
  const joinMs = performance.now() - joinStarted
  // Each seat's welcome fixed its seq; the events of later joins count from there.
  const latencies: number[] = []
  const fanOut = (seats: readonly Seat[], match: (frame: ServerFrame) => boolean) =>
    Promise.all(seats.map((seat) => seat.client.next('evt', match)))

  const votes = rooms.flatMap((seats) =>
    seats.map(async (seat, index) => {
      const sent = performance.now()
      const label = ['XS', 'S', 'M', 'L', 'XL'][index % 5]!
      seat.client.send({
        frame: 'cmd',
        id: `v${seat.seat}`,
        type: 'poker.vote',
        payload: { round: seat.round, card: label },
      })
      await fanOut(
        seats,
        (frame) =>
          frame.frame === 'evt' && frame.type === 'poker.voted' && frame.payload.seat === seat.seat,
      )
      latencies.push(performance.now() - sent)
    }),
  )
  await bounded(Promise.all(votes), 'the votes')
  const reveals = rooms.map(async (seats) => {
    const first = seats[0]!
    const sent = performance.now()
    first.client.send({
      frame: 'cmd',
      id: 'reveal',
      type: 'poker.reveal',
      payload: { round: first.round },
    })
    await fanOut(seats, (frame) => frame.frame === 'evt' && frame.type === 'poker.revealed')
    latencies.push(performance.now() - sent)
  })
  await bounded(Promise.all(reveals), 'the reveals')

  const loaded = await server.ask('stats', 'stats')
  const lost = rooms.flat().filter((seat) => !contiguous(seat)).length
  for (const seat of rooms.flat()) seat.client.close()
  const stopped = await server.stop()
  const sorted = latencies.toSorted((a, b) => a - b)
  return {
    phase: 'burst',
    adapter,
    sockets: ROOMS * SEATS,
    joinMs: Math.round(joinMs),
    commands: sorted.length,
    p50Ms: Number(percentile(sorted, 50).toFixed(2)),
    p99Ms: Number(percentile(sorted, 99).toFixed(2)),
    maxMs: Number((sorted.at(-1) ?? NaN).toFixed(2)),
    socketsWithAGap: lost,
    idleRssMb: Math.round(Number(idle['rss']) / 2 ** 20),
    peakRssMb: Math.round(Number(loaded['maxRss']) / 2 ** 20),
    failures: stopped['failures'],
  }
}

async function slowConsumer(adapter: AdapterName) {
  const server = await spawnServer(adapter)
  const slug = '200000'
  await server.ask(`prepare ${slug}`, 'prepared')
  const url = `ws://127.0.0.1:${server.port}/api/ws/${slug}`
  const fast = await join(url, { name: 'Fast' })
  const slow = await join(url, { name: 'Slow' })
  const topic = {
    title: 't'.repeat(300),
    url: `https://tracker.example/${'u'.repeat(2000)}`,
    ref: null,
  }
  fast.client.send({
    frame: 'cmd',
    id: 'a1',
    type: 'topic.add',
    payload: { topics: Array.from({ length: 5 }, () => topic) },
  })
  const added = await fast.client.next('evt', (frame) => frame.type === 'topic.added')
  await slow.client.next('evt', (frame) => frame.type === 'topic.added')
  const frameBytes = Buffer.byteLength(JSON.stringify(added))

  const flood = async (base: number) => {
    const started = performance.now()
    const answer = server.ask(`flood ${slug} ${JSON.stringify({ ...added, seq: base })}`, 'flooded')
    const fastClosed = fast.client.closed.then((closed) => {
      throw new Error(`the reading seat was closed with ${closed.code} during the flood`)
    })
    await bounded(
      Promise.race([fast.client.next('evt', (frame) => frame.seq === base + 999), fastClosed]),
      'the flood',
    )
    const ms = performance.now() - started
    return { ms, server: await answer }
  }
  // Both read: the baseline. Then the slow one stops reading.
  const baseline = await flood(1_000_000)
  slow.client.socket.pause()
  const slowed = await flood(2_000_000)
  const fastGotAll =
    fast.client.frames.filter((frame) => frame.frame === 'evt' && frame.seq >= 2_000_000).length ===
    1_000
  slow.client.socket.resume()
  const closed = await bounded(slow.client.closed, 'the slow close')
  const slowGot = slow.client.frames.filter(
    (frame) => frame.frame === 'evt' && frame.seq >= 2_000_000,
  ).length
  fast.client.close()
  await server.stop()
  const after = slowed.server['after'] as { rss: number; maxRss: number }
  const before = slowed.server['before'] as { rss: number }
  return {
    phase: 'slow-consumer',
    adapter,
    frameBytes,
    baselineFloodMs: Math.round(baseline.ms),
    slowFloodMs: Math.round(slowed.ms),
    fastGotAll,
    slowClosedWith: closed.code,
    slowGot,
    rssGrowthMb: Number(((after.rss - before.rss) / 2 ** 20).toFixed(1)),
    peakRssMb: Math.round(after.maxRss / 2 ** 20),
  }
}

for (let run = 1; run <= runs; run += 1)
  for (const adapter of adapters) {
    console.log(JSON.stringify({ run, ...(await burst(adapter)) }))
    console.log(JSON.stringify({ run, ...(await slowConsumer(adapter)) }))
  }
