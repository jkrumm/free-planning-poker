/**
 * With no OTLP endpoint in the environment the API builds no SDK, attempts no export and writes no line: asserted in
 * process against a stub collector, with the same round exporting to it as the control, and on the real entry file as a
 * process of its own.
 */
import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'
import { parseSlug } from '@fpp/room-core/types'
import { freePort } from '@fpp/test-kit/port'
import { join } from 'node:path'
import { parseEnv } from '../../src/env.ts'
import { createApiTelemetry } from '../../src/telemetry.ts'
import { join as joinRoom } from '../contract/client.ts'
import { SETTINGS, startServer } from '../contract/harness.ts'
import { ENV } from '../support.ts'

/** A collector that records the path of every request it receives. */
async function stubCollector() {
  const paths: string[] = []
  const server = Bun.serve({
    port: await freePort(),
    hostname: '127.0.0.1',
    fetch(request) {
      paths.push(new URL(request.url).pathname)
      return new Response(null, { status: 200 })
    },
  })
  return { paths, url: `http://127.0.0.1:${server.port}`, stop: () => server.stop(true) }
}

type Collector = Awaited<ReturnType<typeof stubCollector>>

/** One round played to its reveal against the API's telemetry, then flushed and shut down. */
async function playAndFlush(env: ReturnType<typeof parseEnv>) {
  const lines: string[] = []
  const telemetry = createApiTelemetry(env, { lines: (line) => lines.push(line) })
  const room = await startServer('bun', await freePort(), { telemetry: telemetry.port })
  telemetry.server.observeLoad(room.server.runtime.stats)
  room.rooms.put(parseSlug('482913')!, { settings: SETTINGS })
  const alice = await joinRoom(room.url('482913'), { name: 'Alice' })
  const bob = await joinRoom(room.url('482913'), { name: 'Bob' })
  const round = alice.welcome.view.activity.current
  alice.client.send({ frame: 'cmd', id: 'v1', type: 'poker.vote', payload: { round, card: 'M' } })
  await alice.client.next('ack', (frame) => frame.id === 'v1')
  alice.client.send({ frame: 'cmd', id: 'r1', type: 'poker.reveal', payload: { round } })
  await bob.client.next('evt', (frame) => frame.type === 'poker.revealed')
  alice.client.close()
  bob.client.close()
  await room.stop()
  await telemetry.server.flush()
  await telemetry.server.shutdown()
  return { exporting: telemetry.server.exporting, lines }
}

let collector: Collector
const trapped = [
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
  'OTEL_EXPORTER_OTLP_METRICS_ENDPOINT',
  'OTEL_EXPORTER_OTLP_LOGS_ENDPOINT',
] as const
const saved = new Map<string, string | undefined>()

beforeEach(async () => {
  collector = await stubCollector()
  // A collector the process environment names, which the API's own settings do not: a leak would reach it.
  for (const name of trapped) {
    saved.set(name, process.env[name])
    process.env[name] = collector.url
  }
})
afterEach(async () => {
  for (const name of trapped) {
    const before = saved.get(name)
    if (before === undefined) delete process.env[name]
    else process.env[name] = before
  }
  await collector.stop()
})

test('control: with an endpoint the same round reaches the collector as traces, metrics and logs', async () => {
  const { exporting } = await playAndFlush(
    parseEnv({ ...ENV, OTEL_EXPORTER_OTLP_ENDPOINT: collector.url }),
  )
  expect(exporting).toBe(true)
  expect(collector.paths).toContain('/v1/traces')
  expect(collector.paths).toContain('/v1/metrics')
  expect(collector.paths).toContain('/v1/logs')
})

test('with no endpoint the same round builds no SDK, sends nothing and writes no line', async () => {
  const written = [spyOn(console, 'error'), spyOn(console, 'warn')]
  const { exporting, lines } = await playAndFlush(parseEnv(ENV))
  expect(exporting).toBe(false)
  expect(collector.paths).toEqual([])
  expect(lines).toEqual([])
  for (const spy of written) {
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  }
})

test('the API process with no endpoint starts, answers and writes nothing but its startup line', async () => {
  const port = await freePort()
  const entry = join(import.meta.dir, '..', '..', 'src', 'main.ts')
  const child = Bun.spawn([process.execPath, entry], {
    // A database nobody listens on: the process starts and plays on without one, so no test touches a shared one.
    env: {
      PATH: process.env['PATH'] ?? '',
      PORT: String(port),
      DATABASE_URL: `postgres://postgres@127.0.0.1:${await freePort()}/none`,
      VISITOR_KEY: ENV.VISITOR_KEY,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  try {
    const reader = child.stdout.getReader()
    let out = ''
    while (!out.includes('\n')) {
      const chunk = await reader.read()
      if (chunk.done) break
      out += new TextDecoder().decode(chunk.value)
    }
    expect(out).toBe(`fpp api dev (unknown) on port ${port}\n`)
    const health = await fetch(`http://127.0.0.1:${port}/api/health`)
    expect(health.status).toBe(200)
  } finally {
    child.kill()
    await child.exited
  }
  expect(await new Response(child.stderr).text()).toBe('')
})
