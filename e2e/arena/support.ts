/**
 * What every scorecard test shares: the entry under test, where its scores go, how a state of the gallery is opened
 * and how a test waits for the page to come to rest.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { Page } from '@playwright/test'

export const ENTRY = process.env['ARENA_ENTRY'] ?? ''
export const OUT = resolve(import.meta.dirname, '../../arena/scores', ENTRY)

export const CONTAINERS = {
  phone: { width: 360, height: 640 },
  laptop: { width: 1280, height: 800 },
  wall: { width: 1920, height: 1080 },
} as const
export type ContainerId = keyof typeof CONTAINERS

export type State = {
  readonly scenario: string
  readonly container: ContainerId
  readonly theme?: 'light' | 'dark'
  readonly motion?: 'full' | 'reduced'
  /** Absent: the scenario's last frame, its end state. */
  readonly frame?: number
}

export type ScenarioInfo = {
  readonly id: string
  readonly seats: number
  readonly phase: string
  readonly frames: number
  readonly reveal: number | null
}

const hashOf = (state: State) => {
  const params = new URLSearchParams({
    entry: ENTRY,
    scenario: state.scenario,
    container: state.container,
    theme: state.theme ?? 'light',
    motion: state.motion ?? 'full',
    lang: 'en',
    bare: '1',
  })
  if (state.frame !== undefined) params.set('frame', String(state.frame))
  return `#${params.toString()}`
}

/** Two animation frames: React has rendered what the last change asked for and the browser has painted it. */
export const nextPaint = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  )

/**
 * Waits until no animation runs (at most 4 s: an entry whose animation never ends is shot as it stands), then for a
 * paint. Animations are the entry's own; nothing here waits on the wall clock otherwise.
 */
export async function settle(page: Page): Promise<void> {
  await nextPaint(page)
  await page
    .waitForFunction(
      () => document.getAnimations().every((animation) => animation.playState !== 'running'),
      null,
      {
        timeout: 4000,
      },
    )
    .catch(() => undefined)
  await nextPaint(page)
}

/** Opens the gallery in its bare mode on a state, at the container's size. */
export async function open(page: Page, state: State): Promise<void> {
  await page.setViewportSize(CONTAINERS[state.container])
  await page.goto(`${process.env['ARENA_URL']}${hashOf(state)}`)
  await page.waitForFunction(() => window.arenaHarness !== undefined)
  await page.locator('.arena-stage').waitFor()
  await settle(page)
}

/** Moves the open gallery to another state without a reload, so the entry stays mounted and can animate. */
export async function show(page: Page, state: State): Promise<void> {
  await page.evaluate((hash) => {
    window.location.hash = hash
  }, hashOf(state))
  await settle(page)
}

export async function scenarios(page: Page): Promise<readonly ScenarioInfo[]> {
  return page.evaluate(() => window.arenaHarness?.scenarios ?? [])
}

export async function entryProblem(page: Page): Promise<string | null> {
  const problem = page.locator('.arena-problem')
  return (await problem.count()) > 0 ? await problem.first().innerText() : null
}

export function writePart(name: string, data: unknown): void {
  const path = join(OUT, 'parts', `${name}.json`)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`)
}

export type FloorRule =
  | 'plays'
  | 'reading-order'
  | 'keyboard'
  | 'reduced-motion'
  | 'size'
  | 'frame-time'
  | 'colours'
  | 'contained'

/** Records one rule of the floor before the test asserts it, so the report holds it even when the test fails. */
export function floor(rule: FloorRule, pass: boolean, detail: unknown): void {
  writePart(`floor-${rule}`, { rule, pass, detail })
}

declare global {
  interface Window {
    arenaHarness?: {
      readonly entries: readonly { readonly name: string; readonly problem: string | null }[]
      readonly scenarios: readonly ScenarioInfo[]
      readonly intents: { readonly entry: string; readonly intent: { readonly type: string } }[]
      readonly view: (
        scenario: string,
        frame: number,
      ) => {
        readonly seats: readonly { readonly index: number }[]
        readonly activity: {
          readonly current: string
          readonly rounds: readonly {
            readonly id: string
            readonly state: string
            readonly votes: readonly {
              readonly seat: number
              readonly card: { readonly label: string } | null
            }[]
          }[]
        }
      } | null
    }
  }
}
