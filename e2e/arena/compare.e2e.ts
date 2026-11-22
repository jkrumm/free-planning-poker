/**
 * The gallery's compare mode with the entry under test on both sides: through the split reveal at 30 seats, the two
 * stages hold the same DOM at every frame, so a comparison is always of one moment. The DOM, not the pixels: the same
 * text drawn at another horizontal offset is antialiased differently.
 */
import { expect, test } from '@playwright/test'
import { ENTRY, nextPaint, scenarios, settle, writePart } from './support.ts'

const hash = (frame: number) =>
  `#entry=${ENTRY}&vs=${ENTRY}&scenario=30-split-reveal&container=laptop&theme=light&motion=full&lang=en&frame=${frame}&bare=1`

test('compare mode holds two copies of the entry in step through the split reveal at 30 seats', async ({
  page,
}) => {
  await page.setViewportSize({ width: 2 * 1280 + 16, height: 800 })
  await page.goto(`${process.env['ARENA_URL']}${hash(0)}`)
  await page.waitForFunction(() => window.arenaHarness !== undefined)
  const info = (await scenarios(page)).find((scenario) => scenario.id === '30-split-reveal')
  expect(info?.reveal).not.toBeNull()
  const stages = page.locator('.arena-stage')
  const frames: { frame: number; same: boolean }[] = []
  for (let frame = Math.max(0, (info?.reveal ?? 0) - 1); frame < (info?.frames ?? 0); frame += 1) {
    await page.evaluate((next) => {
      window.location.hash = next
    }, hash(frame))
    await settle(page)
    await nextPaint(page)
    expect(await stages.count()).toBe(2)
    const [left, right] = await stages.evaluateAll((elements) =>
      elements.map((element) => element.innerHTML),
    )
    frames.push({ frame, same: left !== undefined && left === right })
  }
  writePart('compare', { scenario: '30-split-reveal', frames })
  expect(frames.filter((frame) => !frame.same)).toEqual([])
})
