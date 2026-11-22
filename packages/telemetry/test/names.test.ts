import { describe, expect, test } from 'bun:test'
import { Glob } from 'bun'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ATTR, EVENT, METRIC, METRIC_LABELS, SERVICE, SPAN } from '../src/names.ts'
import { literalsOf, otelImportsOf, REGISTERED, trackLiteralsOf } from './literals.ts'

const ROOT = join(import.meta.dir, '..', '..', '..')

describe('the registry', () => {
  test('every name is unique, and a metric lists the labels it may carry, all from ATTR', () => {
    const names = [
      ...Object.values(ATTR),
      ...Object.values(EVENT),
      ...Object.values(SPAN),
      ...Object.values(SERVICE),
      ...Object.values(METRIC).map((metric) => metric.name),
    ]
    expect(new Set(names).size).toBe(names.length)
    expect(Object.keys(METRIC_LABELS).toSorted()).toEqual(
      Object.values(METRIC)
        .map((metric) => metric.name)
        .toSorted(),
    )
    for (const labels of Object.values(METRIC_LABELS))
      for (const label of labels) expect(Object.values(ATTR)).toContain(label)
  })

  test('a metric label is a build or a fixed enum: never an identifier of a room, a seat or a person', () => {
    const open: string[] = [ATTR.ROOM_ID, ATTR.SEAT_INDEX]
    for (const labels of Object.values(METRIC_LABELS))
      for (const label of labels) expect(open).not.toContain(label)
  })
})

describe('no name is written outside packages/telemetry', () => {
  test('the scan finds a registered name, any fpp. name and an OpenTelemetry import', () => {
    expect(literalsOf(`span('${SPAN.COMMAND}')`).map((hit) => hit.text)).toEqual([SPAN.COMMAND])
    expect(literalsOf('const key = "fpp.room.slug"').length).toBe(1)
    expect(literalsOf('const key = "event.name"').length).toBe(1)
    expect(trackLiteralsOf('track("room_created", {})').length).toBe(1)
    expect(trackLiteralsOf("const reason = 'topic_decided'").length).toBe(0)
    expect(literalsOf("// 'fpp.command' in a comment\nconst x = 'plain'").length).toBe(0)
    expect(otelImportsOf("import { trace } from '@opentelemetry/api'").length).toBe(1)
    expect(otelImportsOf("import { ATTR } from '@fpp/telemetry/names'").length).toBe(0)
    expect(REGISTERED.size).toBeGreaterThan(20)
  })

  test('no source or test file outside the package writes a telemetry name or imports OpenTelemetry', async () => {
    const hits: string[] = []
    const globs = ['{apps,packages}/*/{src,test,scripts}/**/*.{ts,tsx}', 'scripts/**/*.ts'].map(
      (pattern) => new Glob(pattern),
    )
    const paths: string[] = []
    for (const glob of globs) for await (const path of glob.scan({ cwd: ROOT })) paths.push(path)
    // A scan that finds nothing proves nothing: the apps and the core are in it.
    expect(paths).toContain('packages/room-core/src/runtime/runtime.ts')
    expect(paths).toContain('apps/api/src/main.ts')
    for (const path of paths) {
      if (path.startsWith('packages/telemetry/') || path.includes('node_modules')) continue
      const source = await readFile(join(ROOT, path), 'utf8')
      for (const hit of [
        ...literalsOf(source),
        ...trackLiteralsOf(source),
        ...otelImportsOf(source),
      ])
        hits.push(`${path}:${hit.line} ${hit.text}`)
    }
    expect(hits).toEqual([])
  })
})
