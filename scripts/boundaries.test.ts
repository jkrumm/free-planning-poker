import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile, copyFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { checkBoundaries, importsOf } from './boundaries.ts'

const TABLE = join(import.meta.dir, '..', 'boundaries.toml')

const MANIFESTS: Record<string, Record<string, string>> = {
  'packages/room-core': { './decks': './src/decks.ts' },
  'packages/table': { './seat': './src/seat.ts' },
  'packages/test-kit': { './port': './src/port.ts' },
  'apps/api': {},
  'apps/room': {},
}

let root = ''

/** A workspace with the real table, a manifest per module, and the given files. */
async function workspace(files: Record<string, string>): Promise<string> {
  root = await mkdtemp(join(tmpdir(), 'fpp-boundaries-'))
  await copyFile(TABLE, join(root, 'boundaries.toml'))
  for (const [path, exports] of Object.entries(MANIFESTS)) {
    await mkdir(join(root, path), { recursive: true })
    await writeFile(join(root, path, 'package.json'), JSON.stringify({ exports }))
  }
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), text)
  }
  return root
}

const rules = async (files: Record<string, string>) =>
  (await checkBoundaries(await workspace(files))).map((v) => `${v.file}: ${v.rule} (${v.detail})`)

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true })
})

const CLEAN = {
  'packages/room-core/src/decks.ts':
    "export const DECKS = ['fetch(', 'Date.now'] // Math.random in a comment\n",
  'packages/room-core/src/decks.test.ts':
    "import { test } from 'bun:test'\nimport { DECKS } from './decks.ts'\n",
  'packages/table/src/seat.ts':
    "import type { DECKS } from '@fpp/room-core/decks'\nexport type Seat = typeof DECKS\n",
  'apps/api/src/main.ts':
    "import { DECKS } from '@fpp/room-core/decks'\nconsole.log(DECKS, process.env.PORT, Date.now())\n",
  'apps/api/src/db/store.ts': "import { Effect } from 'effect'\nexport const store = Effect\n",
  'apps/api/src/http/app.test.ts': "import { freePort } from '@fpp/test-kit/port'\n",
}

describe('checkBoundaries', () => {
  test('a tree that keeps the rules passes', async () => {
    expect(await rules(CLEAN)).toEqual([])
  })

  test('a pure module that imports node:fs fails', async () => {
    expect(
      await rules({
        ...CLEAN,
        'packages/room-core/src/io.ts': "import { readFile } from 'node:fs'\n",
      }),
    ).toEqual([
      'packages/room-core/src/io.ts: a pure module does no I/O: no node:*, bun or bun:* (node:fs)',
    ])
  })

  test('effect imported in packages/room-core fails', async () => {
    expect(
      await rules({
        ...CLEAN,
        'packages/room-core/src/fx.ts': "import { Effect } from 'effect'\n",
      }),
    ).toEqual([
      'packages/room-core/src/fx.ts: effect is imported in apps/api/src/app, src/db and src/jobs only (effect)',
    ])
  })

  test('effect/unstable fails even where effect is allowed', async () => {
    expect(
      await rules({
        ...CLEAN,
        'apps/api/src/db/rpc.ts': "import { Rpc } from 'effect/unstable/rpc'\n",
      }),
    ).toEqual([
      'apps/api/src/db/rpc.ts: nothing is imported from effect/unstable (effect/unstable/rpc)',
    ])
  })

  test('a pure module that reads the clock, chance or the network fails', async () => {
    const found = await rules({
      ...CLEAN,
      'packages/room-core/src/clock.ts':
        'export const now = () => Date.now() + Math.random()\nexport const get = () => fetch("/x")\nsetTimeout(() => {}, 1)\n',
    })
    expect(found).toEqual([
      'packages/room-core/src/clock.ts: a pure module does no I/O and reads no clock or chance (fetch)',
      'packages/room-core/src/clock.ts: a pure module does no I/O and reads no clock or chance (a timer function)',
      'packages/room-core/src/clock.ts: a pure module does no I/O and reads no clock or chance (Date.now)',
      'packages/room-core/src/clock.ts: a pure module does no I/O and reads no clock or chance (Math.random)',
    ])
  })

  test('an arrow the table does not draw fails, and so does a value import where only types are allowed', async () => {
    expect(
      await rules({
        ...CLEAN,
        'packages/room-core/src/up.ts': "import { Seat } from '@fpp/table/seat'\n",
        'packages/table/src/value.ts': "import { DECKS } from '@fpp/room-core/decks'\n",
        'apps/room/src/main.tsx': "import { x } from '@fpp/api'\n",
      }),
    ).toEqual([
      'apps/room/src/main.tsx: @fpp/room may not import @fpp/api (boundaries.toml) (@fpp/api)',
      "apps/room/src/main.tsx: an import stays inside @fpp/api's exports map (@fpp/api)",
      'packages/room-core/src/up.ts: @fpp/room-core may not import @fpp/table (boundaries.toml) (@fpp/table/seat)',
      'packages/table/src/value.ts: @fpp/table imports only types from @fpp/room-core (@fpp/room-core/decks)',
    ])
  })

  test("reaching past a package's exports or across modules by path fails", async () => {
    expect(
      await rules({
        ...CLEAN,
        'apps/api/src/deep.ts':
          "import { x } from '@fpp/room-core/src/decks.ts'\nimport { y } from '../../../packages/room-core/src/decks.ts'\n",
      }),
    ).toEqual([
      "apps/api/src/deep.ts: an import stays inside @fpp/room-core's exports map (@fpp/room-core/src/decks.ts)",
      'apps/api/src/deep.ts: a module reaches another only by its package name (../../../packages/room-core/src/decks.ts)',
    ])
  })

  test('the test kit is for test files only', async () => {
    expect(
      await rules({
        ...CLEAN,
        'apps/api/src/http/app.ts': "import { freePort } from '@fpp/test-kit/port'\n",
      }),
    ).toEqual([
      'apps/api/src/http/app.ts: @fpp/test-kit is imported by test files only (@fpp/test-kit/port)',
    ])
  })

  test('an adapter that reads the environment fails', async () => {
    expect(
      await rules({
        ...CLEAN,
        'apps/api/src/ws/server.ts': 'export const port = process.env.PORT\n',
      }),
    ).toEqual([
      "apps/api/src/ws/server.ts: an adapter reads no environment: values come from the app's entry file (process.env)",
    ])
  })

  test('a module directory the table does not list fails', async () => {
    expect(
      await rules({ ...CLEAN, 'packages/stray/src/index.ts': 'export const x = 1\n' }),
    ).toEqual(['packages/stray: every module is listed in boundaries.toml (packages/stray)'])
  })
})

describe('importsOf', () => {
  test('reads value, type, inline-type, re-export and dynamic imports', () => {
    const source = [
      "import { a } from 'a'",
      "import type { B } from 'b'",
      "import { type C, type D } from 'c'",
      "import { type E, f } from 'e'",
      "export { g } from 'g'",
      "const h = await import('h')",
      "// import { z } from 'z'",
    ].join('\n')
    expect(importsOf(source)).toEqual([
      { specifier: 'a', typeOnly: false },
      { specifier: 'b', typeOnly: true },
      { specifier: 'c', typeOnly: true },
      { specifier: 'e', typeOnly: false },
      { specifier: 'g', typeOnly: false },
      { specifier: 'h', typeOnly: false },
    ])
  })
})
