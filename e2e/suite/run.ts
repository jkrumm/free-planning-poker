/**
 * Runs the suite against a stack of its own, on a port the system picks, with the arguments given here (`--shard=1/2`, a
 * file, `--grep`), and removes the stack whatever the outcome. Started by `make e2e` (in a factory slot) and by CI.
 *
 * Two modes, `E2E_MODE`:
 * - `native` (the default): the room app and the API are built as the Dockerfile builds them and run as plain processes
 *   on a private PostgreSQL (native.ts). No Docker engine, no VM.
 * - `image` (CI sets it): the stack is deploy/compose.yml, the file users self-host with, with secrets generated for the
 *   run. The image is built from the checkout unless E2E_NO_BUILD is set, and then E2E_IMAGE names an image that is
 *   already loaded (CI loads the artifact of the `image` job as `fpp-api:local`). A build is tagged for this run alone,
 *   so two runs on one host never overwrite each other's image. A stack that outlived its run (a killed process) is
 *   removed by the next run once it is two hours old (`make v9-sweep`).
 */
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import { buildNative, startNative } from './native.ts'
import { freePort } from './port.ts'

const root = resolve(import.meta.dirname, '../..')
const mode = process.env['E2E_MODE'] ?? 'native'
if (mode !== 'native' && mode !== 'image')
  throw new Error(`E2E_MODE is "native" or "image", got "${mode}"`)
const port = await freePort()
const baseURL = `http://127.0.0.1:${port}`
const build = process.env['E2E_NO_BUILD'] === undefined
const image = build ? `fpp-api:e2e-${process.pid}` : (process.env['E2E_IMAGE'] ?? 'fpp-api:local')
const env = {
  ...process.env,
  E2E_MODE: mode,
  // A local run is measured against the slot's memory budget (2 GiB): two workers peak at 2.1 GiB, one at 1.3 GiB. CI's hosted runners keep two.
  E2E_WORKERS: process.env['E2E_WORKERS'] ?? (mode === 'native' ? '1' : '2'),
  E2E_BASE_URL: baseURL,
  V9_PROJECT: `fpp-e2e-${process.pid}`,
  FPP_PORT: String(port),
  FPP_IMAGE: image,
  E2E_IMAGE: image,
  // The compose file has no default for its two secrets, as users get it: the run makes its own, like a self-hoster's `.env`.
  POSTGRES_PASSWORD: randomBytes(24).toString('hex'),
  VISITOR_KEY: randomBytes(32).toString('hex'),
  ALLOWED_ORIGINS: baseURL,
  V9_UP_FLAGS: '--no-build',
}

const exec = (command: string, args: readonly string[]): Promise<number> =>
  new Promise((done) => {
    const child = spawn(command, args, { cwd: root, env, stdio: 'inherit' })
    child.on('error', () => done(127))
    child.on('close', (code) => done(code ?? 1))
  })
const make = (target: string) => exec('make', ['--no-print-directory', target])
const playwright = () =>
  exec('e2e/node_modules/.bin/playwright', [
    'test',
    '-c',
    'e2e/suite/playwright.config.ts',
    ...process.argv.slice(2),
  ])

/** What a run needs removed, and how: one cleanup, awaited by whoever asks first (a signal and the end of the run share it). */
type Stack = { readonly down: () => Promise<void>; readonly downSync: () => void }
let stack: Stack | undefined
let cleaning: Promise<void> | undefined
const cleanup = () => {
  cleaning ??= stack?.down() ?? Promise.resolve()
  return cleaning
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => void cleanup().then(() => process.exit(130)))
// The last resort, on any exit the handlers above did not see: the same removal, synchronously.
process.on('exit', () => {
  if (cleaning === undefined) stack?.downSync()
})

const runNative = async (): Promise<number> => {
  if ((await buildNative()) !== 0) throw new Error('the room app or the API did not build')
  const native = await startNative({ port })
  stack = { down: native.stop, downSync: () => undefined }
  const code = await playwright()
  if (code !== 0) console.log(`==> API output\n${native.current().output()}`)
  return code
}

const runImage = async (): Promise<number> => {
  // A run that was killed leaves its stack behind; this one removes any older than two hours. Never fatal.
  await make('v9-sweep')
  stack = {
    down: async () => {
      await make('v9-down')
      if (build) await exec('docker', ['image', 'rm', '--force', image])
    },
    downSync: () => {
      spawnSync('make', ['--no-print-directory', 'v9-down'], { cwd: root, env, stdio: 'ignore' })
    },
  }
  if (build && (await make('v9-image')) !== 0) throw new Error('the image did not build')
  if ((await make('v9-up')) !== 0) {
    await make('v9-logs')
    throw new Error('the stack did not come up')
  }
  const code = await playwright()
  if (code !== 0) await make('v9-logs')
  return code
}

let code = 1
try {
  code = await (mode === 'native' ? runNative() : runImage())
} finally {
  await cleanup()
}
process.exit(code)
