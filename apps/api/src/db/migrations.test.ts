import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const API = new URL('../../', import.meta.url).pathname
const DRIZZLE_KIT = join(API, 'node_modules/.bin/drizzle-kit')

async function run(args: string[], cwd: string): Promise<{ code: number; output: string }> {
  const child = Bun.spawn([DRIZZLE_KIT, ...args], { cwd, stdout: 'pipe', stderr: 'pipe' })
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  return { code, output: out + err }
}

test('drizzle-kit check finds the migrations consistent', async () => {
  const result = await run(['check'], API)
  expect(result.output).toContain("Everything's fine")
  expect(result.code).toBe(0)
}, 30_000)

// Generates into a copy of the migrations folder, so a drift fails here and leaves the checkout untouched.
test('schema.ts and the migrations have no drift', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fpp-drift-'))
  try {
    await cp(join(API, 'drizzle'), join(dir, 'out'), { recursive: true })
    await writeFile(
      join(dir, 'drizzle.config.json'),
      JSON.stringify({
        dialect: 'postgresql',
        schema: join(API, 'src/db/schema.ts'),
        out: 'out',
        schemaFilter: ['fpp'],
        migrations: { schema: 'fpp', table: '__drizzle_migrations' },
      }),
    )
    const result = await run(['generate', '--config', 'drizzle.config.json'], dir)
    expect(result.output).toContain('No schema changes')
    expect(result.code).toBe(0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}, 30_000)
