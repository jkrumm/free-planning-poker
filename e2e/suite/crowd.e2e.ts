/** A full table of thirty players, and a phone. */
import { card, expect, expectRevealed, everyone, test, vote } from './room.ts'

test('thirty players in one room vote and reveal', async ({ room }) => {
  test.setTimeout(180_000)
  const { seats } = await room(30)
  const cards = ['3', '5', '8'] as const
  await Promise.all(seats.map((seat, index) => vote(seat, cards[index % cards.length] ?? '')))
  const [first] = seats
  if (first === undefined) throw new Error('thirty seats')
  await expect(first.page.getByTestId('vote-meter')).toContainText('30 of 30')
  await expect(first.page.locator('[data-testid=seat][data-state=voted]')).toHaveCount(30)

  await first.page.getByTestId('reveal').click()
  await everyone(seats, async ({ page }) => {
    await expectRevealed(page)
    await expect(page.locator('[data-testid=seat][data-state=revealed]')).toHaveCount(30)
  })
  for (const label of cards)
    await expect(
      first.page.locator(`[data-testid=result-card][data-card="${label}"]`),
    ).toContainText('10 votes')
})

test('a 390 by 844 phone completes a round', async ({ room }) => {
  const { seats } = await room(2, {
    contextOptions: {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    },
  })
  const [a, b] = seats
  if (a === undefined || b === undefined) throw new Error('two seats')
  // The page lays out at the phone's width, not at a desktop's.
  expect(await a.page.evaluate(() => window.innerWidth)).toBe(390)

  await vote(a, '5', { tap: true })
  await vote(b, '8', { tap: true })
  await a.page.getByTestId('reveal').tap()
  await everyone(seats, async ({ page }) => {
    await expectRevealed(page)
    await expect(page.locator('[data-testid=result-card][data-card="5"]')).toBeVisible()
    await expect(page.locator('[data-testid=result-card][data-card="8"]')).toBeVisible()
  })
  await expect(card(a.page, '5')).toHaveCount(0)
})
