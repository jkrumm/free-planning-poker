/** The seats of a table: rename, kick, leave, and what a spectator cannot do. */
import { expect, expectRevealed, everyone, ownSeat, seatOf, test, vote } from './room.ts'

test('a seat is renamed, removed and left, and the others see each change', async ({ room }) => {
  const { seats } = await room(3)
  const [a, b, c] = seats
  if (a === undefined || b === undefined || c === undefined) throw new Error('three seats')

  await c.page.getByTestId('rename-input').fill('Cleo')
  await c.page.getByTestId('rename').click()
  await expect(seatOf(a.page, 'Cleo')).toHaveCount(1)
  await expect(seatOf(b.page, 'Cleo')).toHaveCount(1)
  await expect(seatOf(a.page, c.name)).toHaveCount(0)

  await seatOf(a.page, b.name).getByTestId('kick').click()
  await expect(b.page.getByTestId('status')).toHaveAttribute('data-status', 'kicked')
  await expect(b.page.getByTestId('rejoin')).toBeVisible()
  await expect(a.page.getByTestId('seat')).toHaveCount(2)
  await expect(c.page.getByTestId('seat')).toHaveCount(2)

  await c.page.getByTestId('leave').click()
  await expect(a.page.getByTestId('seat')).toHaveCount(1)
})

test('a spectator watches and cannot reveal', async ({ room }) => {
  const { seats } = await room(2)
  const [a, watcher] = seats
  if (a === undefined || watcher === undefined) throw new Error('two seats')
  await watcher.page.getByTestId('role-toggle').click()
  await expect(ownSeat(watcher.page)).toHaveAttribute('data-role', 'spectator')
  await expect(seatOf(a.page, watcher.name)).toHaveAttribute('data-role', 'spectator')

  // The spectator's page offers no hand and no reveal; the player's does.
  await expect(watcher.page.getByTestId('deck')).toHaveCount(0)
  await expect(watcher.page.getByTestId('reveal')).toHaveCount(0)
  await expect(a.page.getByTestId('reveal')).toBeVisible()

  await vote(a, '8')
  await a.page.getByTestId('reveal').click()
  await everyone(seats, ({ page }) => expectRevealed(page))
})
