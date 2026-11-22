/** The final value of a topic, and a queue of topics worked through in order. */
import {
  expect,
  expectRevealed,
  expectVoting,
  everyone,
  round,
  test,
  vote,
  type Seat,
} from './room.ts'

const finalOn = (seat: Seat) => seat.page.getByTestId('final-value-result')

test('a unanimous reveal shows the final value without a click', async ({ room }) => {
  const { seats } = await room(2)
  const [a, b] = seats
  if (a === undefined || b === undefined) throw new Error('two seats')
  await vote(a, '5')
  await vote(b, '5')
  await a.page.getByTestId('reveal').click()
  await everyone(seats, async (seat) => {
    await expectRevealed(seat.page)
    await expect(finalOn(seat)).toHaveAttribute('data-card', '5')
    await expect(seat.page.getByTestId('topic-final')).toHaveAttribute('data-card', '5')
  })
})

test('after a split reveal one seat sets the final value, every seat sees it and the summary holds it', async ({
  room,
}) => {
  const { seats, slug } = await room(2)
  const [a, b] = seats
  if (a === undefined || b === undefined) throw new Error('two seats')
  await vote(a, '3')
  await vote(b, '8')
  await a.page.getByTestId('reveal').click()
  await everyone(seats, async (seat) => {
    await expectRevealed(seat.page)
    await expect(finalOn(seat)).toHaveCount(0)
  })

  await b.page.locator('[data-testid=final-value][data-card="5"]').click()
  await everyone(seats, async (seat) => {
    await expect(finalOn(seat)).toHaveAttribute('data-card', '5')
    await expect(seat.page.getByTestId('topic-final')).toHaveAttribute('data-card', '5')
  })

  // The summary route answers a seat of the room (docs/v9/ARCHITECTURE.md, HTTP API); the decision is stored behind the event.
  const token = await a.page.evaluate(
    (key) =>
      (JSON.parse(localStorage.getItem(key) ?? 'null') as { token?: string } | null)?.token ?? '',
    `fpp:v9:seat:${slug}`,
  )
  expect(token, 'the seat secret of the first seat').not.toBe('')
  await expect
    .poll(async () => {
      const response = await a.context.request.get(`/api/rooms/${slug}/summary`, {
        headers: { authorization: `Bearer ${token}` },
      })
      if (response.status() !== 200) return `status ${response.status()}`
      const body = (await response.json()) as {
        topics: { final: { label: string } | null }[]
        totals: { decided: number }
      }
      return `${body.topics.map((topic) => topic.final?.label ?? '-').join(',')} decided ${body.totals.decided}`
    })
    .toBe('5 decided 1')
})

test('a pasted queue of three topics is worked through in order', async ({ room }) => {
  const { seats } = await room(2)
  const [a, b] = seats
  if (a === undefined || b === undefined) throw new Error('two seats')
  const titles = ['Alpha', 'Beta', 'Gamma'] as const
  await a.page.getByTestId('topic-paste').fill(titles.join('\n'))
  await a.page.getByTestId('topic-add').click()
  await everyone(seats, ({ page }) =>
    expect(page.locator('[data-testid=topic][data-state=queued]')).toHaveCount(titles.length),
  )

  for (const [position, title] of titles.entries()) {
    // The first topic is estimated on request; each next one follows from "next topic".
    if (position === 0)
      await a.page
        .locator('[data-testid=topic][data-state=queued]')
        .first()
        .getByTestId('topic-activate')
        .click()
    else await a.page.getByTestId('next-topic').click()
    await everyone(seats, async (seat) => {
      await expect(seat.page.getByTestId('round-topic')).toHaveText(title)
      await expectVoting(seat.page)
    })
    await vote(a, '8')
    await vote(b, '8')
    await b.page.getByTestId('reveal').click()
    await everyone(seats, async (seat) => {
      await expectRevealed(seat.page)
      await expect(finalOn(seat)).toHaveAttribute('data-card', '8')
    })
  }
  await expect(round(a.page)).toHaveAttribute('data-state', 'revealed')
  // Every topic of the queue has its final value, in the order it was pasted.
  await everyone(seats, async (seat) => {
    const names = seat.page.getByTestId('topic-name')
    await expect(names.filter({ hasText: /^(Alpha|Beta|Gamma)$/ })).toHaveText([...titles])
    await expect(
      seat.page.locator('[data-testid=topic][data-topic] [data-testid=topic-final][data-card="8"]'),
    ).toHaveCount(3)
  })
})
