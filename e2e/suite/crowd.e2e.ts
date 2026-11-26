/**
 * A full table of thirty players, and a phone. The first seat is a page, the one that is looked at: the table's thirty
 * seats, the vote meter and the result cards. The other twenty-nine take their seats over the socket (socket.ts): thirty
 * browser contexts held about 4.5 GiB, and what they add is the room's fan-out to thirty seats, which a socket proves.
 */
import { card, everyone, expect, expectRevealed, test, vote } from './room.ts'
import { joinBySocket } from './socket.ts'

const CROWD = 30
const baseURL = process.env['E2E_BASE_URL'] ?? ''

test('thirty players in one room vote and reveal', async ({ room }) => {
  test.setTimeout(180_000)
  const { seats, slug } = await room(1)
  const [first] = seats
  if (first === undefined) throw new Error('the first seat')
  const crowd = await Promise.all(
    Array.from({ length: CROWD - 1 }, (_, index) =>
      joinBySocket({ baseURL, slug, name: `Seat ${index + 2}` }),
    ),
  )
  try {
    await expect(first.page.getByTestId('seat')).toHaveCount(CROWD)

    const cards = ['3', '5', '8'] as const
    const cardOf = (index: number) => cards[index % cards.length] ?? ''
    await Promise.all([
      vote(first, cardOf(0)),
      ...crowd.map((seat, index) => seat.vote(cardOf(index + 1))),
    ])
    await expect(first.page.getByTestId('vote-meter')).toContainText('30 of 30')
    await expect(first.page.locator('[data-testid=seat][data-state=voted]')).toHaveCount(CROWD)

    await first.page.getByTestId('reveal').click()
    await expectRevealed(first.page)
    await expect(first.page.locator('[data-testid=seat][data-state=revealed]')).toHaveCount(CROWD)
    for (const label of cards)
      await expect(
        first.page.locator(`[data-testid=result-card][data-card="${label}"]`),
      ).toContainText('10 votes')

    // Every socket seat was sent the reveal, with all thirty cards.
    for (const seat of crowd) {
      const votes = await seat.revealed
      expect(votes, seat.name).toHaveLength(CROWD)
      for (const label of cards)
        expect(
          votes.filter((cast) => cast.card.label === label),
          seat.name,
        ).toHaveLength(10)
    }
  } finally {
    for (const seat of crowd) seat.close()
  }
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
