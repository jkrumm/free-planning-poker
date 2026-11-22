/**
 * The scorecard of one entry (docs/v9/ARENA.md, Reading a scorecard): end-state screenshots of every scenario in
 * every container and theme, the floor's checks, axe's findings, a determinism check, the reveal's frame times with
 * the CPU slowed four times, and recordings of the split reveal. Each test writes its part under
 * arena/scores/<entry>/parts; report.ts turns the parts into index.html and score.json.
 */
import { readFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import {
  CONTAINERS,
  type ContainerId,
  ENTRY,
  entryProblem,
  floor,
  nextPaint,
  OUT,
  open,
  scenarios,
  settle,
  show,
  writePart,
} from './support.ts'

const THEMES = ['light', 'dark'] as const
const shot = (page: Page) =>
  page.locator('.arena-stage').screenshot({ animations: 'disabled', caret: 'hide' })

test('the entry is in the gallery', async ({ page }) => {
  await open(page, { scenario: '2-voting', container: 'laptop' })
  const entries = await page.evaluate(() => window.arenaHarness?.entries ?? [])
  const mine = entries.find((candidate) => candidate.name === ENTRY)
  expect(mine, `no entry ${ENTRY} under arena/entries`).toBeDefined()
  expect(mine?.problem ?? null, 'the entry module is malformed').toBeNull()
})

test('static floor: size, colours, imports', () => {
  const path = join(OUT, 'static.json')
  const result = JSON.parse(readFileSync(path, 'utf8')) as {
    size: { ownGzip: number; addsGzip: number }
    colours: unknown[]
    leaks: unknown[]
  }
  const limit = 60 * 1024
  floor('size', result.size.ownGzip <= limit, {
    ownGzip: result.size.ownGzip,
    addsGzip: result.size.addsGzip,
    limit,
  })
  floor('colours', result.colours.length === 0, result.colours)
  floor('contained', result.leaks.length === 0, result.leaks)
  writePart('size', result.size)
  expect(result.size.ownGzip, 'own code over 60 kB gzip').toBeLessThanOrEqual(limit)
  expect(result.colours, 'colour literals outside the tokens').toEqual([])
  expect(result.leaks, 'imports outside the contract or the entry directory').toEqual([])
})

const combos = (Object.keys(CONTAINERS) as ContainerId[]).flatMap((container) =>
  THEMES.map((theme) => ({ container, theme })),
)

for (const { container, theme } of combos) {
  test(`end states: ${container}, ${theme}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await open(page, { scenario: '2-voting', container, theme })
    const problems: { scenario: string; problem: string }[] = []
    const shots: string[] = []
    for (const scenario of await scenarios(page)) {
      await show(page, { scenario: scenario.id, container, theme })
      const problem = await entryProblem(page)
      if (problem !== null) problems.push({ scenario: scenario.id, problem })
      const file = `shots/${container}-${theme}/${scenario.id}.png`
      await page
        .locator('.arena-stage')
        .screenshot({ path: join(OUT, file), animations: 'disabled', caret: 'hide' })
      shots.push(file)
    }
    writePart(`shots-${container}-${theme}`, { container, theme, shots, problems, errors })
    floor('plays', problems.length === 0 && errors.length === 0, {
      problems,
      errors,
      container,
      theme,
    })
    expect(problems, 'scenarios the entry failed to render').toEqual([])
    expect(errors, 'errors thrown in the page').toEqual([])
  })
}

test('the same scenario and seed give the same end state', async ({ browser }) => {
  const takes: Buffer[] = []
  for (let run = 0; run < 2; run += 1) {
    const context = await browser.newContext()
    const page = await context.newPage()
    await open(page, { scenario: '9-split-reveal', container: 'laptop' })
    takes.push(await shot(page))
    await context.close()
  }
  const same = takes[0]!.equals(takes[1]!)
  writePart('determinism', { scenario: '9-split-reveal', container: 'laptop', same })
  expect(same, 'two runs of 9-split-reveal differ').toBe(true)
})

test('floor: seats and cards are elements in reading order with accessible names', async ({
  page,
}) => {
  await open(page, { scenario: '2-voting', container: 'laptop' })
  const failures: string[] = []
  const all = await scenarios(page)
  const checked = all.filter(
    (scenario) => scenario.phase === 'voting' || scenario.phase === 'split-reveal',
  )
  for (const scenario of checked) {
    await show(page, { scenario: scenario.id, container: 'laptop' })
    const facts = await page.evaluate(
      ({ id, frame }) => {
        const view = window.arenaHarness?.view(id, frame)
        const stage = document.querySelector('.arena-stage')
        if (!view || !stage) return null
        const round = view.activity.rounds.find(
          (candidate) => candidate.id === view.activity.current,
        )
        return {
          expected: view.seats.map((seat) => seat.index),
          found: [...stage.querySelectorAll<HTMLElement>('[data-seat]')].map((element) =>
            Number(element.dataset['seat']),
          ),
          revealed: round?.state === 'revealed',
          votes: (round?.votes ?? []).map((vote) => ({
            seat: vote.seat,
            label: vote.card?.label ?? null,
          })),
          cards: [...stage.querySelectorAll<HTMLElement>('[data-card-of]')].map((element) => ({
            seat: Number(element.dataset['cardOf']),
            label: element.dataset['card'] ?? null,
          })),
        }
      },
      { id: scenario.id, frame: scenario.frames - 1 },
    )
    if (facts === null) {
      failures.push(`${scenario.id}: the harness gave no view`)
      continue
    }
    if (facts.found.join(',') !== facts.expected.join(','))
      failures.push(
        `${scenario.id}: [data-seat] in DOM order is [${facts.found}], the view's seats are [${facts.expected}]`,
      )
    for (const seat of facts.expected) {
      const element = page.locator(`.arena-stage [data-seat="${seat}"]`).first()
      if ((await element.count()) === 0) continue
      await expect(element)
        .toHaveAccessibleName(/\S/, { timeout: 500 })
        .catch(() => failures.push(`${scenario.id}: seat ${seat} has no accessible name`))
    }
    if (!facts.revealed) continue
    for (const vote of facts.votes) {
      const cards = facts.cards.filter((candidate) => candidate.seat === vote.seat)
      if (cards.length === 0) {
        failures.push(
          `${scenario.id}: no [data-card-of="${vote.seat}"] for seat ${vote.seat}'s revealed card`,
        )
        continue
      }
      if (!cards.some((candidate) => candidate.label === vote.label))
        failures.push(
          `${scenario.id}: seat ${vote.seat}'s card says data-card="${cards[0]?.label}", the vote is ${vote.label}`,
        )
      await expect(page.locator(`.arena-stage [data-card-of="${vote.seat}"]`).first())
        .toHaveAccessibleName(/\S/, { timeout: 500 })
        .catch(() =>
          failures.push(`${scenario.id}: seat ${vote.seat}'s card has no accessible name`),
        )
    }
  }
  floor('reading-order', failures.length === 0, failures)
  expect(failures).toEqual([])
})

/** Tabs through the entry from the top and presses Enter, then Space, on every stop; returns the intent types seen. */
async function walk(page: Page): Promise<{ intents: string[]; stops: number }> {
  await page.evaluate(() => {
    ;(document.activeElement as HTMLElement | null)?.blur()
    window.arenaHarness?.intents.splice(0)
  })
  let entered = false
  let stops = 0
  for (let press = 0; press < 250; press += 1) {
    await page.keyboard.press('Tab')
    const stop = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null
      if (element === null || element.closest('.arena-stage') === null) return null
      if (element.dataset['arenaWalk'] !== undefined)
        return { id: element.dataset['arenaWalk'], again: true }
      element.dataset['arenaWalk'] = String(document.querySelectorAll('[data-arena-walk]').length)
      return { id: element.dataset['arenaWalk'], again: false }
    })
    if (stop === null) {
      if (entered) break
      continue
    }
    entered = true
    if (stop.again) break
    stops += 1
    const count = () => page.evaluate(() => window.arenaHarness?.intents.length ?? 0)
    const before = await count()
    await page.keyboard.press('Enter')
    await nextPaint(page)
    if ((await count()) === before) {
      await page.keyboard.press(' ')
      await nextPaint(page)
    }
  }
  const intents = await page.evaluate(() => [
    ...new Set((window.arenaHarness?.intents ?? []).map((entry) => entry.intent.type)),
  ])
  return { intents, stops }
}

test('floor: every intent is reachable by keyboard', async ({ page }) => {
  const states = [
    { scenario: '9-voting', wants: ['vote', 'clear', 'reveal', 'react'] },
    { scenario: '9-countdown', wants: ['cancel'] },
    { scenario: '9-split-reveal', wants: ['settle', 'revote', 'next'] },
  ]
  const results: { scenario: string; stops: number; intents: string[]; missing: string[] }[] = []
  for (const state of states) {
    await open(page, { scenario: state.scenario, container: 'laptop' })
    const { intents, stops } = await walk(page)
    results.push({
      scenario: state.scenario,
      stops,
      intents,
      missing: state.wants.filter((want) => !intents.includes(want)),
    })
  }
  const missing = results.flatMap((result) =>
    result.missing.map((type) => `${result.scenario}: ${type}`),
  )
  floor('keyboard', missing.length === 0, results)
  expect(missing, 'intents no Tab, Enter or Space reaches').toEqual([])
})

test('floor: with reduced motion the reveal reaches its end state without movement', async ({
  browser,
}) => {
  const results: { scenario: string; still: boolean }[] = []
  for (const scenario of ['9-split-reveal', '30-split-reveal']) {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    await open(page, { scenario, container: 'laptop', motion: 'reduced', frame: 0 })
    const reveal =
      (await scenarios(page)).find((candidate) => candidate.id === scenario)?.reveal ?? 0
    await show(page, { scenario, container: 'laptop', motion: 'reduced', frame: reveal - 1 })
    await page.evaluate((hash) => {
      window.location.hash = hash
    }, `#entry=${ENTRY}&scenario=${scenario}&container=laptop&theme=light&motion=reduced&lang=en&frame=${reveal}&bare=1`)
    await nextPaint(page)
    const first = await page
      .locator('.arena-stage')
      .screenshot({ animations: 'allow', caret: 'hide' })
    // The one wait on the wall clock: the 1.6 s a reveal may take, measured against what the first paint showed.
    await page.waitForTimeout(1600)
    const later = await page
      .locator('.arena-stage')
      .screenshot({ animations: 'allow', caret: 'hide' })
    results.push({ scenario, still: first.equals(later) })
    await context.close()
  }
  const moving = results.filter((result) => !result.still).map((result) => result.scenario)
  floor('reduced-motion', moving.length === 0, results)
  expect(moving, 'reveals that still change after their first paint under reduced motion').toEqual(
    [],
  )
})

type Timing = {
  scenario: string
  container: ContainerId
  median: number
  worst: number
  frames: number
  longTasks: number
  longTaskMs: number
}

/** Plays the reveal with the CPU slowed four times and records every frame's duration for 2 s. */
async function timeReveal(page: Page, scenario: string, container: ContainerId): Promise<Timing> {
  await open(page, { scenario, container, frame: 0 })
  const reveal = (await scenarios(page)).find((candidate) => candidate.id === scenario)?.reveal ?? 0
  await show(page, { scenario, container, frame: reveal - 1 })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const hash = `#entry=${ENTRY}&scenario=${scenario}&container=${container}&theme=light&motion=full&lang=en&frame=${reveal}&bare=1`
  const measured = await page.evaluate(
    (target) =>
      new Promise<{ deltas: number[]; long: number[] }>((done) => {
        const long: number[] = []
        const observer = new PerformanceObserver((list) =>
          list.getEntries().forEach((entry) => long.push(entry.duration)),
        )
        observer.observe({ type: 'longtask', buffered: false })
        const deltas: number[] = []
        let start = 0
        let last = 0
        const tick = (time: number) => {
          if (start === 0) {
            start = time
            last = time
            window.location.hash = target
          } else {
            deltas.push(time - last)
            last = time
          }
          if (time - start < 2000) requestAnimationFrame(tick)
          else {
            observer.disconnect()
            done({ deltas, long })
          }
        }
        requestAnimationFrame(tick)
      }),
    hash,
  )
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  await cdp.detach()
  const sorted = measured.deltas.toSorted((a, b) => a - b)
  const median = sorted.length === 0 ? 0 : sorted[Math.floor((sorted.length - 1) / 2)]!
  return {
    scenario,
    container,
    median: Math.round(median * 10) / 10,
    worst: Math.round((sorted.at(-1) ?? 0) * 10) / 10,
    frames: sorted.length,
    longTasks: measured.long.length,
    longTaskMs: Math.round(measured.long.reduce((sum, duration) => sum + duration, 0)),
  }
}

test('floor: the throttled reveal at 30 seats keeps a median frame of at most 20 ms', async ({
  page,
}) => {
  const timings = [
    await timeReveal(page, '9-split-reveal', 'laptop'),
    await timeReveal(page, '30-split-reveal', 'laptop'),
    await timeReveal(page, '30-split-reveal', 'phone'),
  ]
  writePart('frames', timings)
  const slow = timings.filter((timing) => timing.scenario.startsWith('30-') && timing.median > 20)
  floor('frame-time', slow.length === 0, timings)
  expect(slow, 'reveals at 30 seats over a 20 ms median frame').toEqual([])
})

test('recordings of the split reveal at 9 and 30 seats', async ({ browser }) => {
  const videos: string[] = []
  for (const scenario of ['9-split-reveal', '30-split-reveal']) {
    const context = await browser.newContext({
      viewport: CONTAINERS.laptop,
      recordVideo: { dir: join(OUT, '.video'), size: CONTAINERS.laptop },
    })
    const page = await context.newPage()
    await open(page, { scenario, container: 'laptop', frame: 0 })
    const reveal =
      (await scenarios(page)).find((candidate) => candidate.id === scenario)?.reveal ?? 0
    await show(page, { scenario, container: 'laptop', frame: reveal - 1 })
    await show(page, { scenario, container: 'laptop', frame: reveal })
    // Recorded on the wall clock on purpose: the reveal as a person sees it, with its 1.6 s and a margin.
    await page.waitForTimeout(2000)
    const video = page.video()
    await context.close()
    const file = `reveal-${scenario}.webm`
    if (video !== null) {
      renameSync(await video.path(), join(OUT, file))
      videos.push(file)
    }
  }
  writePart('videos', videos)
  expect(videos).toHaveLength(2)
})

test('axe findings', async ({ page }) => {
  const findings: {
    state: string
    violations: {
      id: string
      impact: string | null
      help: string
      nodes: number
      targets: string[]
    }[]
  }[] = []
  await open(page, { scenario: '2-voting', container: 'laptop' })
  const states = [
    ...(await scenarios(page))
      .filter((scenario) => scenario.seats === 9)
      .flatMap((scenario) =>
        THEMES.map((theme) => ({ scenario: scenario.id, container: 'laptop' as const, theme })),
      ),
    { scenario: '30-split-reveal', container: 'phone' as const, theme: 'light' as const },
  ]
  for (const state of states) {
    await open(page, state)
    await settle(page)
    const result = await new AxeBuilder({ page }).include('.arena-stage').analyze()
    findings.push({
      state: `${state.scenario} ${state.container} ${state.theme}`,
      violations: result.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact ?? null,
        help: violation.help,
        nodes: violation.nodes.length,
        targets: violation.nodes.slice(0, 5).map((node) => node.target.join(' ')),
      })),
    })
  }
  writePart('axe', findings)
})
