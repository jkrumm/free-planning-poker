/**
 * What the scorecard reads from the page (e2e/arena): the entries, the scenarios with their frame counts and reveal
 * frames, and every intent an entry reported. In the arena an intent changes nothing: the frames are scripted, so
 * the scorecard can press every control without changing what it measures.
 */
import type { View } from '@fpp/room-core/types'
import type { Intent } from '@fpp/table/contract'
import { SCENARIOS, scenarioById } from '@fpp/table/scenarios'
import { ENTRIES } from './entries.ts'
import { framesOf } from './frames.ts'

export type HarnessIntent = { readonly entry: string; readonly intent: Intent }

export type Harness = {
  readonly entries: readonly { readonly name: string; readonly problem: string | null }[]
  readonly scenarios: readonly {
    readonly id: string
    readonly seats: number
    readonly phase: string
    readonly frames: number
    readonly reveal: number | null
  }[]
  readonly intents: HarnessIntent[]
  /** The view an entry is given at a frame, for checks that compare the page with it. */
  readonly view: (scenario: string, frame: number) => View | null
}

declare global {
  interface Window {
    arenaHarness?: Harness
  }
}

export function installHarness(): void {
  window.arenaHarness = {
    entries: ENTRIES.map(({ name, problem }) => ({ name, problem })),
    scenarios: SCENARIOS.map((scenario) => ({
      id: scenario.id,
      seats: scenario.seats,
      phase: scenario.phase,
      frames: framesOf(scenario).length,
      reveal: scenario.reveal,
    })),
    intents: [],
    view: (id, frame) => {
      const scenario = scenarioById(id)
      return scenario === undefined ? null : (framesOf(scenario)[frame]?.view ?? null)
    },
  }
}

export function recordIntent(entry: string, intent: Intent): void {
  window.arenaHarness?.intents.push({ entry, intent })
}
