/**
 * One room server of the transport bake-off in its own process, so its memory and its event loop are its own. It
 * answers commands on stdin, one per line: `stats`, `prepare <slug,...>`, `flood <slug> <evt frame json>`, `stop`.
 */
import type { ServerFrame } from '@fpp/room-core/types'
import { parseSlug } from '@fpp/room-core/types'
import { ADAPTERS, type AdapterName, SETTINGS, startServer } from '../test/contract/harness.ts'

const [name, portText] = Bun.argv.slice(2)
if (name === undefined || !(name in ADAPTERS))
  throw new Error(`usage: bake-off-server <${Object.keys(ADAPTERS).join('|')}> <port>`)
const started = await startServer(name as AdapterName, Number(portText))
// Every room of the run uses the bake-off's deck; the directory opens a room at its first visit.
const resolve = started.rooms.directory.resolve
const opened = new Set<string>()

const say = (message: Record<string, unknown>) => console.log(JSON.stringify(message))
const stats = () => {
  const usage = process.memoryUsage()
  // maxRSS is in kilobytes, the peak the OS saw for this process.
  return { maxRss: process.resourceUsage().maxRSS * 1024, rss: usage.rss, heapUsed: usage.heapUsed }
}

say({ ready: true, port: started.server.port, ...stats() })

for await (const line of console) {
  const [command, slugText, ...rest] = line.trim().split(' ')
  if (command === 'stats') say({ stats: true, ...stats() })
  if (command === 'prepare' && slugText !== undefined) {
    // Opens a room with the bake-off's settings before its first socket.
    for (const text of slugText.split(',')) {
      const slug = parseSlug(text)
      if (slug === undefined || opened.has(slug)) continue
      started.rooms.put(slug, { settings: SETTINGS })
      opened.add(slug)
    }
    say({ prepared: true })
  }
  if (command === 'flood' && slugText !== undefined) {
    const slug = parseSlug(slugText)
    const key = slug === undefined ? null : await resolve(slug)
    if (key === null) throw new Error(`no room at ${slugText}`)
    const frame = JSON.parse(rest.join(' ')) as Extract<ServerFrame, { frame: 'evt' }>
    const before = stats()
    // One event per millisecond: a reading seat keeps up across processes, a paused one fills its buffers.
    for (let index = 0; index < 1_000; index += 1) {
      started.server.transport.publish(key, { ...frame, seq: frame.seq + index })
      await Bun.sleep(1)
    }
    say({ flooded: true, before, after: stats() })
  }
  if (command === 'stop') {
    await started.stop()
    say({
      stopped: true,
      closes: started.telemetry.closes.length,
      failures: started.telemetry.failures.length,
    })
    process.exit(0)
  }
}
