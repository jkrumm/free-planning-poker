import { describe, expect, test } from 'bun:test'
import { createServerTelemetry, type ServerTelemetryConfig } from '../src/facade.server.ts'
import { leaksIn, memoryExporters } from '../src/facade.memory.ts'
import { ATTR, EVENT, SERVICE } from '../src/names.ts'

const base: ServerTelemetryConfig = {
  service: SERVICE.api,
  version: 'local',
  environment: 'dev',
  build: 'test',
  endpoint: undefined,
}
const info = { type: 'poker.vote', room: '1', seat: 0, traceparent: undefined }

const start = () => {
  const memory = memoryExporters()
  const telemetry = createServerTelemetry({
    ...base,
    lines: memory.line,
    exporters: memory.exporters,
  })
  return { memory, telemetry }
}

describe('with no endpoint', () => {
  test('nothing is built: commands run as they are, and nothing is exported or written', async () => {
    const lines: string[] = []
    const telemetry = createServerTelemetry({ ...base, lines: (line) => lines.push(line) })
    let ran = 0
    telemetry.command(info, () => {
      ran += 1
      return { ok: true }
    })
    telemetry.fanout(() => {
      ran += 1
    })
    telemetry.recordEvent(EVENT.ROOM_LOADED)
    telemetry.roomEnded(3)
    await telemetry.flush()
    await telemetry.shutdown()
    expect(telemetry.exporting).toBe(false)
    expect(ran).toBe(2)
    expect(lines).toEqual([])
  })

  test('a bug is still one structured line: the operator sees it without a collector', () => {
    const lines: string[] = []
    const telemetry = createServerTelemetry({ ...base, lines: (line) => lines.push(line) })
    telemetry.recordError(new Error('boom'), { component: 'room-runtime', action: 'cmd' }, 'high')
    expect(lines.length).toBe(1)
    expect(JSON.parse(lines[0]!)).toMatchObject({
      level: 'error',
      service: SERVICE.api,
      [ATTR.COMPONENT]: 'room-runtime',
      [ATTR.ACTION]: 'cmd',
      [ATTR.EXCEPTION_TYPE]: 'Error',
    })
  })
})

describe('an exported command and error', () => {
  test('an error is exported by its type and its frames, never its message', async () => {
    const { memory, telemetry } = start()
    telemetry.recordError(
      new Error('duplicate key (slug)=(zq7-secret-slug)'),
      { component: 'room-runtime', action: 'store' },
      'high',
    )
    const exported = await memory.exported(telemetry)
    expect(leaksIn(exported, ['zq7-secret-slug', 'duplicate key'])).toEqual([])
    const record = exported.logs[0]!
    expect(record['attributes']).toMatchObject({ [ATTR.EXCEPTION_TYPE]: 'Error' })
    expect(
      String((record['attributes'] as Record<string, unknown>)[ATTR.EXCEPTION_STACKTRACE]),
    ).toContain('facade.test.ts')
  })

  test('a bug inside a command marks its span, a refusal does not', async () => {
    const { memory, telemetry } = start()
    telemetry.command(info, () => ({ ok: false, reason: 'round_unknown' }))
    telemetry.command(info, () => ({ ok: false, reason: 'internal' }))
    expect(() =>
      telemetry.command(info, () => {
        throw new Error('bug')
      }),
    ).toThrow('bug')
    const exported = await memory.exported(telemetry)
    const status = exported.spans.map((span) => (span['status'] as { code: number }).code)
    // 0 unset, 2 error.
    expect(status).toEqual([0, 2, 2])
    expect(
      exported.spans.map(
        (span) => (span['attributes'] as Record<string, unknown>)[ATTR.COMMAND_OUTCOME],
      ),
    ).toEqual(['nack', 'internal', 'internal'])
  })

  test('a record written inside a command carries its trace ids', async () => {
    const { memory, telemetry } = start()
    telemetry.command(info, () => {
      telemetry.recordError(new Error('x'), { component: 'room-runtime', action: 'cmd' }, 'high')
      return { ok: true }
    })
    const exported = await memory.exported(telemetry)
    expect(exported.logs[0]?.['traceId']).toBe(exported.spans[0]?.['traceId'])
    expect(JSON.parse(exported.lines[0]!).trace_id).toBe(exported.spans[0]?.['traceId'])
  })
})
