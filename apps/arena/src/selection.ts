/**
 * The gallery's whole selection in the URL fragment, so a link opens exactly what its sender saw:
 * `#entry=reference&vs=other&scenario=9-split-reveal&container=laptop&theme=dark&motion=reduced&lang=de&frame=12`.
 * `frame` absent means the scenario's last frame; `bare=1` shows the stages alone at full size, for the scorecard.
 */
import { CONTAINERS, type Container } from '@fpp/table/scenarios'
import type { Theme } from '@fpp/table/contract'
import { LANGUAGES, type Language } from './messages.ts'

export type Motion = 'full' | 'reduced'

export type Selection = {
  readonly entry: string | null
  readonly vs: string | null
  readonly scenario: string
  readonly container: Container['id']
  readonly theme: Theme
  readonly motion: Motion
  readonly lang: Language
  readonly frame: number | null
  readonly bare: boolean
}

export const DEFAULT_SCENARIO = '9-split-reveal'

const oneOf = <T extends string>(value: string | null, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback

export function parseSelection(hash: string): Selection {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const frame = Number.parseInt(params.get('frame') ?? '', 10)
  return {
    entry: params.get('entry') || null,
    vs: params.get('vs') || null,
    scenario: params.get('scenario') || DEFAULT_SCENARIO,
    container: oneOf(
      params.get('container'),
      CONTAINERS.map((container) => container.id),
      'laptop',
    ),
    theme: oneOf(params.get('theme'), ['light', 'dark'], 'light'),
    motion: oneOf(params.get('motion'), ['full', 'reduced'], 'full'),
    lang: oneOf(params.get('lang'), LANGUAGES, 'en'),
    frame: Number.isSafeInteger(frame) && frame >= 0 ? frame : null,
    bare: params.get('bare') === '1',
  }
}

export function formatSelection(selection: Selection): string {
  const params = new URLSearchParams()
  if (selection.entry !== null) params.set('entry', selection.entry)
  if (selection.vs !== null) params.set('vs', selection.vs)
  params.set('scenario', selection.scenario)
  params.set('container', selection.container)
  params.set('theme', selection.theme)
  params.set('motion', selection.motion)
  params.set('lang', selection.lang)
  if (selection.frame !== null) params.set('frame', String(selection.frame))
  if (selection.bare) params.set('bare', '1')
  return `#${params.toString()}`
}
