/**
 * The promise of a deploy: replacing the API container under a running round costs nobody a seat or a vote
 * (docs/v9/ARCHITECTURE.md, Server, Ownership and handoff). This test owns a stack of its own, on a port the system
 * picks and with its own database, because the other tests share the suite's stack and must not meet a restart.
 * It needs Docker and the image of the suite (E2E_IMAGE, `fpp-api:local` by default), so it is not tagged @smoke.
 */
import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { freePort } from './port.ts'
import { expect, expectRevealed, everyone, ownSeat, seatOf, test, vote } from './room.ts'

const run = promisify(execFile)
const ROOT = resolve(import.meta.dirname, '../..')

test('the API container is replaced mid-round: every seat resumes and the reveal shows every vote', async ({
  room,
}, testInfo) => {
  test.setTimeout(240_000)
  const port = await freePort()
  const baseURL = `http://127.0.0.1:${port}`
  const env = {
    ...process.env,
    V9_PROJECT: `fpp-e2e-restart-${testInfo.workerIndex}-${port}`,
    FPP_PORT: String(port),
    FPP_IMAGE: process.env['E2E_IMAGE'] ?? 'fpp-api:local',
    ALLOWED_ORIGINS: baseURL,
    V9_UP_FLAGS: '--no-build',
  }
  const make = (target: string) =>
    run('make', ['-C', ROOT, '--no-print-directory', target], { env })

  await test.step('start a stack of its own', () => make('v9-up'))
  try {
    const { seats } = await room(3, { baseURL })
    const [a, b, c] = seats
    if (a === undefined || b === undefined || c === undefined) throw new Error('three seats')
    await vote(a, '21')
    await vote(b, '13')
    await expect(c.page.locator('[data-testid=seat][data-state=voted]')).toHaveCount(2)
    const indexes = await Promise.all(
      seats.map((seat) => ownSeat(seat.page).getAttribute('data-seat')),
    )

    // Stop with SIGTERM (the drain closes every socket), then start a new container on the same database.
    await test.step('replace the API container', () => make('v9-replace-api'))
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
    const logs = await make('v9-logs').catch(() => undefined)
    if (logs !== undefined) await testInfo.attach('compose-logs', { body: logs.stdout })
    throw error
  } finally {
    await make('v9-down')
  }
})
