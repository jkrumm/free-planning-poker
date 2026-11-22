/**
 * The content test of rule `telemetry.md`: a full round through the runtime on real sockets, with a marker string as
 * the display names, the room's slug, each vote value, the topic title and key, the access code and the device id.
 * Everything the API exports (spans, metrics, log records, structured lines) is searched for a marker, and the contract
 * attributes of the estate are asserted on what it does export.
 */
import { describe, expect, test } from 'bun:test'
import { DEFAULT_SETTINGS } from '@fpp/room-core/server'
import { parseAccessCode, parseDeck, parseSlug } from '@fpp/room-core/types'
import {
  ATTR,
  EVENT,
  METRIC,
  METRIC_LABELS,
  NAMESPACE,
  RESOURCE,
  SERVICE,
  SPAN,
} from '@fpp/telemetry/names'
import { createServerTelemetry } from '@fpp/telemetry/server'
import { leaksIn, memoryExporters, type Exported } from '@fpp/telemetry/memory'
import { freePort } from '@fpp/test-kit/port'
import { parseEnv } from '../../src/env.ts'
import { createApiTelemetry } from '../../src/telemetry.ts'
import { hello, join, TestClient } from '../contract/client.ts'
import { startServer, type Started } from '../contract/harness.ts'

const MARK = {
  alice: 'Zq7AliceMark',
  bob: 'Zq7BobMark',
  slug: 'zq7-slugmark',
  voteA: 'zq7va',
  voteB: 'zq7vb',
  topic: 'Zq7TopicMark',
  key: 'ZQ7KEY-1',
  code: 'zq7c0d',
  wrongCode: 'zq7wr0',
  device: 'zq7device',
} as const
const MARKERS = Object.values(MARK)

const TRACE = '0af7651916cd43dd8448eb211c80319c'
const PARENT = 'b7ad6b7169203331'

const slug = parseSlug(MARK.slug)
const code = parseAccessCode(MARK.code)
const deck = parseDeck({
  id: 'custom',
  cards: [
    { label: MARK.voteA, value: 1 },
    { label: MARK.voteB, value: 2 },
  ],
})
if (slug === undefined || code === undefined || deck === undefined) throw new Error('bad markers')

const env = parseEnv({
  NODE_ENV: 'production',
  GIT_SHA: 'abcdef1234567890',
  APP_VERSION: 'contract',
})

type Point = { readonly attributes: Record<string, unknown> }
type MetricRow = { readonly descriptor: { readonly name: string }; readonly dataPoints: Point[] }

const metricRows = (exported: Exported): MetricRow[] =>
  (exported.metrics as { scopeMetrics: { metrics: MetricRow[] }[] }[]).flatMap((resource) =>
    resource.scopeMetrics.flatMap((scope) => scope.metrics),
  )

const attr = (record: Record<string, unknown>, key: string) =>
  (record['attributes'] as Record<string, unknown>)[key]

/** A round played to its reveal, a refused command, a resume, a wrong code, then a drain. */
async function playRound(): Promise<Exported> {
  const memory = memoryExporters()
  const telemetry = createApiTelemetry(env, { exporters: memory.exporters, lines: memory.line })
  const room: Started = await startServer('bun', await freePort(), { telemetry: telemetry.port })
  telemetry.server.observeLoad(room.server.runtime.stats)
  room.rooms.put(slug!, {
    settings: { ...DEFAULT_SETTINGS, deck: deck!, revealCountdown: 0 },
    access: 'locked',
    code: code!,
  })
  const open: TestClient[] = []
  try {
    const alice = await TestClient.open(room.url(MARK.slug))
    open.push(alice)
    alice.send({ ...hello({ name: MARK.alice, code: MARK.code }), device: MARK.device })
    const welcome = await alice.next('welcome')
    const round = welcome.view.activity.current
    const bob = await join(room.url(MARK.slug), { name: MARK.bob, code: MARK.code })
    open.push(bob.client)

    const wrong = await TestClient.open(room.url(MARK.slug))
    open.push(wrong)
    wrong.send(hello({ name: 'Mallory', code: MARK.wrongCode }))
    await wrong.closed

    alice.send({
      frame: 'cmd',
      id: 't1',
      type: 'topic.add',
      payload: {
        topics: [
          {
            title: MARK.topic,
            url: null,
            ref: { source: 'jira', id: null, key: MARK.key, site: 'zq7.example.com' },
          },
        ],
      },
    })
    await alice.next('ack', (frame) => frame.id === 't1')
    alice.send({
      frame: 'cmd',
      id: 'v1',
      type: 'poker.vote',
      payload: { round, card: MARK.voteA },
      traceparent: `00-${TRACE}-${PARENT}-01`,
    })
    await alice.next('ack', (frame) => frame.id === 'v1')
    bob.client.send({
      frame: 'cmd',
      id: 'v2',
      type: 'poker.vote',
      payload: { round, card: MARK.voteB },
    })
    await bob.client.next('ack', (frame) => frame.id === 'v2')

    bob.client.send({
      frame: 'cmd',
      id: 'x1',
      type: 'poker.vote',
      payload: { round: '00000000-0000-7000-8000-000000000000', card: MARK.voteA },
    })
    await bob.client.next('nack', (frame) => frame.id === 'x1')
    bob.client.send({ frame: 'cmd', id: 'x2', type: 'poker.nope', payload: {} })
    await bob.client.next('nack', (frame) => frame.id === 'x2')

    alice.send({ frame: 'cmd', id: 'r1', type: 'poker.reveal', payload: { round } })
    await bob.client.next('evt', (frame) => frame.type === 'poker.revealed')

    bob.client.close()
    await bob.client.closed
    const back = await join(room.url(MARK.slug), {
      name: MARK.bob,
      seatToken: bob.welcome.seatToken,
    })
    open.push(back.client)
  } finally {
    for (const client of open) client.close()
    await room.stop()
  }
  return memory.exported(telemetry.server)
}

describe('the content of what the API exports', () => {
  let exported: Exported

  test('a full round exports no display name, slug, vote value, topic, key, code or device id', async () => {
    exported = await playRound()
    expect(leaksIn(exported, MARKERS)).toEqual([])
  })

  test('what it exports carries the estate contract on every span, log record and metric', async () => {
    exported = await playRound()
    const contract = {
      [RESOURCE.SERVICE_NAME]: SERVICE.api,
      [RESOURCE.SERVICE_NAMESPACE]: NAMESPACE,
      [RESOURCE.SERVICE_VERSION]: 'abcdef1',
      [RESOURCE.ENVIRONMENT]: 'prod',
    }
    expect(exported.spans.length).toBeGreaterThanOrEqual(5)
    for (const span of exported.spans) {
      expect(span['name']).toBe(SPAN.COMMAND)
      expect(span['resource']).toMatchObject(contract)
    }
    expect(exported.logs.length).toBeGreaterThan(0)
    for (const log of exported.logs) expect(log['resource']).toMatchObject(contract)
    for (const batch of exported.metrics as { resource: object }[])
      expect(batch.resource).toMatchObject(contract)
  })

  test("a command's span continues the trace of the frame's traceparent", async () => {
    exported = await playRound()
    const continued = exported.spans.filter((span) => span['traceId'] === TRACE)
    expect(continued.length).toBe(1)
    expect(continued[0]?.['parentSpanId']).toBe(PARENT)
    expect(attr(continued[0]!, ATTR.COMMAND_TYPE)).toBe('poker.vote')
    // The others begin traces of their own.
    expect(exported.spans.filter((span) => span['parentSpanId'] === undefined).length).toBe(
      exported.spans.length - 1,
    )
  })

  test('every metric of Measurement is exported, with build and fixed enums as its only labels', async () => {
    exported = await playRound()
    const rows = metricRows(exported)
    const names = new Set(rows.map((row) => row.descriptor.name))
    for (const metric of Object.values(METRIC)) expect(names).toContain(metric.name)
    for (const row of rows) {
      const allowed: readonly string[] =
        METRIC_LABELS[row.descriptor.name as keyof typeof METRIC_LABELS]
      for (const point of row.dataPoints)
        for (const key of Object.keys(point.attributes)) expect(allowed).toContain(key)
    }
    const rejected = rows.find((row) => row.descriptor.name === METRIC.COMMAND_REJECTED.name)
    const reasons = rejected?.dataPoints.map((point) => point.attributes[ATTR.NACK_REASON])
    expect(reasons).toContain('invalid')
    expect(reasons).toContain('round_unknown')
    for (const row of rows)
      for (const point of row.dataPoints) expect(point.attributes[ATTR.BUILD]).toBe('contract')
  })

  test('the room lifecycle and the reveal are log events with trace ids where a command caused them', async () => {
    exported = await playRound()
    const events = exported.logs.map((log) => attr(log, ATTR.EVENT_NAME))
    expect(events).toContain(EVENT.ROOM_LOADED)
    expect(events).toContain(EVENT.ROUND_REVEALED)
    expect(events).toContain(EVENT.ROOM_RELEASED)
    const revealed = exported.logs.find(
      (log) => attr(log, ATTR.EVENT_NAME) === EVENT.ROUND_REVEALED,
    )
    expect(revealed?.['traceId']).toMatch(/^[0-9a-f]{32}$/)
    expect(revealed?.['body']).toBe(EVENT.ROUND_REVEALED)
  })

  test('the guard fires: a slug given to a span attribute, a log attribute or a room id is found', async () => {
    const memory = memoryExporters()
    const telemetry = createServerTelemetry({
      service: SERVICE.api,
      version: 'abcdef1',
      environment: 'prod',
      build: 'contract',
      endpoint: undefined,
      lines: memory.line,
      exporters: memory.exporters,
    })
    telemetry.command(
      { type: 'poker.vote', room: MARK.slug, seat: 0, traceparent: undefined },
      () => ({
        ok: true,
      }),
    )
    telemetry.recordEvent(EVENT.ROOM_LOADED, { [ATTR.ROOM_ID]: MARK.slug })
    const planted = await memory.exported(telemetry)
    expect(leaksIn(planted, MARKERS)).toEqual([MARK.slug])
    expect(planted.spans.length).toBe(1)
  })
})
