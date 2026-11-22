/**
 * What the plain room promises about itself, as tests: a literal in JSX fails the lint, and no design system is in it
 * (docs/plan.yaml, v9-room-plain: no basalt-ui, no Tailwind; row v9-ui-foundation installs basalt-ui).
 */
import { expect, test } from 'bun:test'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = join(import.meta.dirname, '../../..')

type Override = { files: string[]; rules?: Record<string, unknown> }

test('literal text in JSX fails oxlint in the room app', () => {
  const config = JSON.parse(readFileSync(join(root, '.oxlintrc.json'), 'utf8')) as {
    overrides: Override[]
  }
  const rule = config.overrides.find((override) =>
    override.files.includes('apps/room/src/**/*.tsx'),
  )
  expect(rule?.rules?.['react/jsx-no-literals']).toBe('error')

  const dir = mkdtempSync(join(tmpdir(), 'fpp-lint-'))
  try {
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({ plugins: ['react'], rules: rule?.rules }),
    )
    const run = (name: string, source: string) => {
      writeFileSync(join(dir, name), source)
      return Bun.spawnSync(
        ['bunx', '--no-install', 'oxlint', '-c', join(dir, 'config.json'), join(dir, name)],
        { cwd: root, stdout: 'pipe', stderr: 'pipe' },
      )
    }
    const planted = run('planted.tsx', 'export const A = () => <p>Reveal cards</p>\n')
    expect(planted.exitCode).toBe(1)
    expect(planted.stdout.toString()).toContain('jsx-no-literals')
    const clean = run('clean.tsx', 'export const A = (props: { t: string }) => <p>{props.t}</p>\n')
    expect(clean.exitCode).toBe(0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the room app imports no design system', () => {
  const source = join(root, 'apps/room')
  const files = readdirSync(source, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(tsx?|css|json)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !path.includes('node_modules') && !path.includes('/dist/'))
  expect(files.length).toBeGreaterThan(10)
  for (const file of files) {
    if (file.endsWith('rules.test.ts')) continue
    expect(readFileSync(file, 'utf8'), file).not.toMatch(
      /basalt-ui|tailwind|@import ['"]tailwindcss/i,
    )
  }
})

test('e2e/TESTIDS.md lists every test id of the source, and only those', () => {
  const listed = new Set(
    [...readFileSync(join(root, 'e2e/TESTIDS.md'), 'utf8').matchAll(/`([a-z][a-z-]+)`/g)].map(
      (match) => match[1] as string,
    ),
  )
  const used = new Set<string>()
  const sources = readdirSync(join(root, 'apps/room/src'), { recursive: true, withFileTypes: true })
  for (const entry of sources.filter((file) => file.isFile() && file.name.endsWith('.tsx'))) {
    const text = readFileSync(join(entry.parentPath, entry.name), 'utf8')
    for (const match of text.matchAll(/data-testid="([a-z-]+)"/g)) used.add(match[1] as string)
  }
  expect([...used].filter((id) => !listed.has(id)).toSorted()).toEqual([])
  const testids = readFileSync(join(root, 'e2e/TESTIDS.md'), 'utf8')
  const rowIds = [...testids.matchAll(/^\| `([a-z-]+)`/gm)].map((match) => match[1] as string)
  expect(rowIds.filter((id) => !used.has(id)).toSorted()).toEqual([])
})
