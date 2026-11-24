/**
 * The promise of a deploy: replacing the API under a running round costs nobody a seat or a vote
 * (docs/v9/ARCHITECTURE.md, Server, Ownership and handoff). This test owns a stack of its own, on a port the system
 * picks and with its own database, because the other tests share the suite's stack and must not meet a restart.
 * In native mode (`E2E_MODE`, the default) the API is a process: SIGTERM, wait for the drain to exit 0, a new process on
 * the same port and database. In image mode it is the container, replaced by `make v9-replace-api`, and needs Docker
 * and the image of the suite (E2E_IMAGE, `fpp-api:local` by default). Neither is tagged @smoke.
 */
import { execFile, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { startNative } from './native.ts'
import { freePort } from './port.ts'
import { expect, expectRevealed, everyone, ownSeat, seatOf, test, vote } from './room.ts'

const run = promisify(execFile)
const ROOT = resolve(import.meta.dirname, '../..')

/** A stack of this test's own, whichever mode: where it listens, how a deploy replaces the API, what it logged, how it goes. */
type Stack = {
  readonly baseURL: string
  replaceApi(): Promise<void>
  logs(): Promise<string>
  down(): Promise<void>
}

const startNativeStack = async (port: number): Promise<Stack> => {
  const native = await startNative({ port })
  return {
    baseURL: `http://127.0.0.1:${port}`,
    replaceApi: native.replaceApi,
    logs: async () => native.current().output(),
    down: native.stop,
  }
}

const startImageStack = async (port: number, name: string): Promise<Stack> => {
  const baseURL = `http://127.0.0.1:${port}`
  const env = {
    ...process.env,
    V9_PROJECT: name,
    FPP_PORT: String(port),
    FPP_IMAGE: process.env['E2E_IMAGE'] ?? 'fpp-api:local',
    ALLOWED_ORIGINS: baseURL,
    V9_UP_FLAGS: '--no-build',
  }
  const make = (target: string) =>
    run('make', ['-C', ROOT, '--no-print-directory', target], { env })
  // The exit guard: a worker that is killed (a timeout, a crashed run) never reaches `down`, and the stack would outlive it.
  const guard = () =>
    void spawnSync('make', ['-C', ROOT, '--no-print-directory', 'v9-down'], {
      env,
      stdio: 'ignore',
    })
  process.once('exit', guard)
  try {
    await make('v9-up')
  } catch (error) {
    process.removeListener('exit', guard)
    await make('v9-down').catch(() => undefined)
    throw error
  }
  return {
    baseURL,
    replaceApi: async () => void (await make('v9-replace-api')),
    logs: async () => (await make('v9-logs')).stdout,
    down: async () => {
      process.removeListener('exit', guard)
      await make('v9-down')
    },
  }
}

// Registered for the whole test, so a timeout and a failing assertion reach it too, not only the end of the body.
let stack: Stack | undefined
test.afterEach(async () => {
  const done = stack
  stack = undefined
  await done?.down()
})

test('the API is replaced mid-round: every seat resumes and the reveal shows every vote', async ({
  room,
}, testInfo) => {
  test.setTimeout(240_000)
  const port = await freePort()
  const native = (process.env['E2E_MODE'] ?? 'native') === 'native'
  try {
    stack = await test.step('start a stack of its own', () =>
      native
        ? startNativeStack(port)
        : startImageStack(port, `fpp-e2e-restart-${testInfo.workerIndex}-${port}`))
    const { baseURL } = stack
    const { seats } = await room(3, { baseURL })
    const [a, b, c] = seats
    if (a === undefined || b === undefined || c === undefined) throw new Error('three seats')
    await vote(a, '21')
    await vote(b, '13')
    await expect(c.page.locator('[data-testid=seat][data-state=voted]')).toHaveCount(2)
    const indexes = await Promise.all(
      seats.map((seat) => ownSeat(seat.page).getAttribute('data-seat')),
    )

    // Stop with SIGTERM (the drain closes every socket), then start a new API on the same database.
    await test.step('replace the API', () => stack?.replaceApi() ?? Promise.resolve())
    await everyone(seats, async ({ page }) => {
      await expect(page.getByTestId('status')).toHaveAttribute('data-status', 'live', {
        timeout: 90_000,
      })
    })

    // Same seats, same votes: nobody was removed and nobody voted twice.
    await everyone(seats, async (seat) => {
      await expect(seat.page.getByTestId('seat')).toHaveCount(3)
      await expect(seat.page.locator('[data-testid=seat][data-state=voted]')).toHaveCount(2)
      await expect(ownSeat(seat.page)).toHaveAttribute(
        'data-seat',
        indexes[seats.indexOf(seat)] ?? '',
      )
    })
    await vote(c, '8')
    await a.page.getByTestId('reveal').click()
    await everyone(seats, async ({ page }) => {
      await expectRevealed(page)
      for (const [seat, value] of [
        [a, '21'],
        [b, '13'],
        [c, '8'],
      ] as const)
        await expect(seatOf(page, seat.name).getByTestId('seat-vote')).toHaveText(value)
    })
  } catch (error) {
    const logs = await stack?.logs().catch(() => undefined)
    if (logs !== undefined) await testInfo.attach('api-logs', { body: logs })
    throw error
  }
})
