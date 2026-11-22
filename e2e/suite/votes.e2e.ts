/**
 * Voting: a card is private until the reveal, a re-vote keeps the topic, the reveal waits for players only and its
 * countdown can be cancelled, a reload gives the seat back with its card. Each test makes its own room.
 */
import {
  card,
  expect,
  expectRevealed,
  expectVoting,
  everyone,
  leakedIn,
  markupWithoutHand,
  ownSeat,
  round,
  seatOf,
  test,
  valuesIn,
  vote,
} from './room.ts'

// Three cards of the default deck that differ from each other and from the counters of a short test: a leak is a value found, not a coincidence.
const VALUES = ['21', '13', '8'] as const

test(
  'three seats vote: nobody sees a card before the reveal, then everybody sees all',
  { tag: '@smoke' },
  async ({ room }) => {
    const { seats } = await room(3)
    await Promise.all(seats.map((seat, index) => vote(seat, VALUES[index] ?? '')))
    await everyone(seats, async ({ page }) => {
      await expect(page.locator('[data-testid=seat][data-state=voted]')).toHaveCount(3)
      await expect(page.getByTestId('vote-meter')).toContainText('3 of 3')
    })

    // A reload makes every seat fetch a fresh snapshot of the round while it holds three votes: the projection, not only
    // the live events, is what keeps the others' cards out.
    await Promise.all(seats.map((seat) => seat.page.reload()))
    await everyone(seats, async ({ page }) => {
      await expect(page.getByTestId('status')).toHaveAttribute('data-status', 'live')
      await expect(page.locator('[data-testid=seat][data-state=voted]')).toHaveCount(3)
    })
    for (const [index, seat] of seats.entries()) {
      await expect(ownSeat(seat.page).getByTestId('seat-vote')).toHaveText('voted')
      const others = VALUES.filter((_, other) => other !== index)
      expect(seat.frames.length, `${seat.name} received frames`).toBeGreaterThan(0)
      expect(leakedIn(seat.frames, others), `frames ${seat.name} received`).toEqual([])
      expect(valuesIn(await markupWithoutHand(seat.page), others), `DOM of ${seat.name}`).toEqual(
        [],
      )
      await expect(seat.page.getByTestId('result')).toHaveCount(0)
    }

    await seats[0]?.page.getByTestId('reveal').click()
    await everyone(seats, async ({ page }) => {
      await expectRevealed(page)
      for (const [index, other] of seats.entries()) {
        await expect(
          page.locator(`[data-testid=result-card][data-card="${VALUES[index]}"]`),
        ).toBeVisible()
        await expect(seatOf(page, other.name).getByTestId('seat-vote')).toHaveText(
          VALUES[index] ?? '',
        )
      }
    })
  },
)

test('a re-vote clears the cards and keeps the topic', async ({ room }) => {
  const { seats } = await room(2)
  const [a, b] = seats
  if (a === undefined || b === undefined) throw new Error('two seats')
  await a.page.getByTestId('topic-paste').fill('Checkout flow')
  await a.page.getByTestId('topic-add').click()
  await a.page
    .locator('[data-testid=topic][data-state=queued]')
    .getByTestId('topic-activate')
    .click()
  await everyone(seats, ({ page }) =>
    expect(page.getByTestId('round-topic')).toHaveText('Checkout flow'),
  )

  await vote(a, '3')
  await vote(b, '8')
  await a.page.getByTestId('reveal').click()
  await everyone(seats, ({ page }) => expectRevealed(page))

  await b.page.getByTestId('revote').click()
  await everyone(seats, async ({ page }) => {
    await expectVoting(page)
    await expect(page.getByTestId('round-topic')).toHaveText('Checkout flow')
    await expect(page.locator('[data-testid=card][aria-pressed=true]')).toHaveCount(0)
    await expect(page.locator('[data-testid=seat][data-state=thinking]')).toHaveCount(2)
  })
})

test('a spectator does not hold up the automatic reveal', async ({ room }) => {
  const { seats } = await room(3)
  const [a, b, watcher] = seats
  if (a === undefined || b === undefined || watcher === undefined) throw new Error('three seats')
  await watcher.page.getByTestId('role-toggle').click()
  await expect(ownSeat(watcher.page)).toHaveAttribute('data-role', 'spectator')
  await a.page.getByTestId('setting-countdown').selectOption('1')
  await a.page.getByTestId('auto-reveal').click()
  await everyone(seats, async ({ page }) => {
    await expect(page.getByTestId('auto-reveal')).toBeChecked()
    await expect(page.getByTestId('setting-countdown')).toHaveValue('1')
  })

  await vote(a, '5')
  await vote(b, '13')
  await everyone(seats, ({ page }) => expectRevealed(page))
})

test('the countdown of the automatic reveal can be cancelled', async ({ room }) => {
  const { seats } = await room(2)
  const [a, b] = seats
  if (a === undefined || b === undefined) throw new Error('two seats')
  await a.page.getByTestId('setting-countdown').selectOption('10')
  await a.page.getByTestId('auto-reveal').click()
  await expect(b.page.getByTestId('auto-reveal')).toBeChecked()
  await expect(b.page.getByTestId('setting-countdown')).toHaveValue('10')

  await vote(a, '5')
  await vote(b, '8')
  await everyone(seats, ({ page }) => expect(page.getByTestId('countdown')).toBeVisible())
  await b.page.getByTestId('cancel-reveal').click()
  await everyone(seats, async ({ page }) => {
    await expect(page.getByTestId('countdown')).toHaveCount(0)
    await expectVoting(page)
  })

  // The cancelled round is still open: a person can reveal it.
  await a.page.getByTestId('reveal').click()
  await everyone(seats, ({ page }) => expectRevealed(page))
})

test('a seat that reloads mid-round returns to its seat with its vote', async ({ room }) => {
  const { seats } = await room(3)
  const [a, b, c] = seats
  if (a === undefined || b === undefined || c === undefined) throw new Error('three seats')
  await vote(a, '21')
  await vote(b, '13')
  await expect(a.page.locator('[data-testid=seat][data-state=voted]')).toHaveCount(2)
  const index = await ownSeat(b.page).getAttribute('data-seat')

  await b.page.reload()
  await expect(b.page.getByTestId('status')).toHaveAttribute('data-status', 'live')
  await expect(ownSeat(b.page)).toHaveAttribute('data-seat', index ?? '')
  await expect(card(b.page, '13')).toHaveAttribute('aria-pressed', 'true')
  await expect(b.page.getByTestId('seat')).toHaveCount(3)
  await expect(a.page.getByTestId('seat')).toHaveCount(3)
  await expect(round(b.page)).toHaveAttribute('data-state', 'voting')

  await vote(c, '8')
  await a.page.getByTestId('reveal').click()
  await everyone(seats, async ({ page }) => {
    await expectRevealed(page)
    await expect(seatOf(page, b.name).getByTestId('seat-vote')).toHaveText('13')
  })
})
