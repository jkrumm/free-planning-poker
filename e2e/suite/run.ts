/**
 * Runs the suite against a stack of its own: starts `deploy/compose.yml` through the Makefile on a port the system
 * picks, runs Playwright with the arguments given here (`--shard=1/2`, a file, `--grep`), and removes the stack,
 * whatever the outcome. Started by `make e2e` (in a factory slot) and by CI.
 *
 * The image is built from the checkout unless E2E_NO_BUILD is set, and then E2E_IMAGE names an image that is already
 * loaded (CI loads the artifact of the `image` job as `fpp-api:local`). A build is tagged for this run alone, so
 * two runs on one host never overwrite each other's image.
 */
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { freePort } from './port.ts'

const root = resolve(import.meta.dirname, '../..')
const port = await freePort()
const baseURL = `http://127.0.0.1:${port}`
const build = process.env['E2E_NO_BUILD'] === undefined
const image = build ? `fpp-api:e2e-${process.pid}` : (process.env['E2E_IMAGE'] ?? 'fpp-api:local')
const env = {
  ...process.env,
  V9_PROJECT: `fpp-e2e-${process.pid}`,
  FPP_PORT: String(port),
  FPP_IMAGE: image,
  E2E_IMAGE: image,
  ALLOWED_ORIGINS: baseURL,
  V9_UP_FLAGS: '--no-build',
  E2E_BASE_URL: baseURL,
}

const exec = (command: string, args: readonly string[]): Promise<number> =>
  new Promise((done) => {
    const child = spawn(command, args, { cwd: root, env, stdio: 'inherit' })
    child.on('error', () => done(127))
    child.on('close', (code) => done(code ?? 1))
  })
const make = (target: string) => exec('make', ['--no-print-directory', target])

// One cleanup, awaited by whoever asks first: a signal during the run and the end of the run share it.
let cleaning: Promise<void> | undefined
const cleanup = () => {
  cleaning ??= (async () => {
    await make('v9-down')
    if (build) await exec('docker', ['image', 'rm', '--force', image])
  })()
  return cleaning
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => void cleanup().then(() => process.exit(130)))

let code = 1
try {
  if (build && (await make('v9-image')) !== 0) throw new Error('the image did not build')
  if ((await make('v9-up')) !== 0) {
    await make('v9-logs')
    throw new Error('the stack did not come up')
  }
  code = await exec('e2e/node_modules/.bin/playwright', [
    'test',
    '-c',
    'e2e/suite/playwright.config.ts',
    ...process.argv.slice(2),
  ])
  if (code !== 0) await make('v9-logs')
} finally {
  await cleanup()
}
process.exit(code)
