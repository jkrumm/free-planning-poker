/**
 * The gallery: choose an entry, a scenario and a container, play, pause, step and scrub, and compare two entries in
 * step, both driven by the one frame index. The selection lives in the URL fragment (selection.ts). In the bare mode
 * the stages are shown alone at full size, which is what the scorecard drives.
 */
import { useEffect, useRef, useState } from 'react'
import type { Intent, IntentType } from '@fpp/table/contract'
import { CONTAINERS, PHASES, SCENARIOS, SEAT_COUNTS, scenarioById } from '@fpp/table/scenarios'
import { ENTRIES } from './entries.ts'
import { effectsAt, framesOf } from './frames.ts'
import { GALLERY_MESSAGES, LANGUAGES, TABLE_MESSAGES } from './messages.ts'
import { DEFAULT_SCENARIO, formatSelection, parseSelection, type Selection } from './selection.ts'
import { Stage } from './stage.tsx'
import { recordIntent } from './harness.ts'

const readHash = () => parseSelection(window.location.hash)

/** The width the stages get, read from the element as it resizes. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (element === null) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

export function Gallery() {
  const [selection, setSelection] = useState<Selection>(readHash)
  const [playing, setPlaying] = useState(false)
  const [lastIntent, setLastIntent] = useState<IntentType | null>(null)
  const { ref, width } = useWidth()

  // The fragment is the selection's source of truth for links and for the scorecard, which sets it from outside.
  useEffect(() => {
    const onHash = () => setSelection(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    const hash = formatSelection(selection)
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash)
  }, [selection])

  const scenario =
    scenarioById(selection.scenario) ?? scenarioById(DEFAULT_SCENARIO) ?? SCENARIOS[0]!
  const frames = framesOf(scenario)
  const last = frames.length - 1
  const index = Math.min(selection.frame ?? last, last)
  const frame = frames[index]!
  const effects = effectsAt(frames, index)
  const container =
    CONTAINERS.find((candidate) => candidate.id === selection.container) ?? CONTAINERS[1]
  const words = GALLERY_MESSAGES[selection.lang]
  const tableWords = TABLE_MESSAGES[selection.lang]

  const update = (change: Partial<Selection>) =>
    setSelection((current) => ({ ...current, ...change }))
  const goTo = (next: number) => update({ frame: Math.max(0, Math.min(last, next)) })

  // Playback: wait the scenario's own time between two frames, then step; stop at the end.
  const running = playing && index < last
  useEffect(() => {
    if (!running) return
    const wait = (frames[index + 1]?.elapsed ?? 0) - (frames[index]?.elapsed ?? 0)
    const timer = window.setTimeout(
      () => setSelection((current) => ({ ...current, frame: index + 1 })),
      Math.max(16, wait),
    )
    return () => window.clearTimeout(timer)
  }, [running, index, frames])

  const play = () => {
    if (index >= last) update({ frame: 0 })
    setPlaying(true)
  }

  const shown = ENTRIES.filter(
    (loaded) =>
      loaded.name === (selection.entry ?? ENTRIES[0]?.name) || loaded.name === selection.vs,
  )
  const primary = ENTRIES.find((loaded) => loaded.name === selection.entry) ?? ENTRIES[0]
  const second =
    selection.vs === null ? undefined : ENTRIES.find((loaded) => loaded.name === selection.vs)
  const stages = [primary, second].filter((loaded) => loaded !== undefined)
  const sideBySide = stages.length > 1 && width >= 720
  const slot = sideBySide ? (width - 16) / 2 : width
  const scale = selection.bare ? 1 : Math.min(1, slot / container.width)

  const onIntent = (name: string) => (intent: Intent) => {
    recordIntent(name, intent)
    setLastIntent(intent.type)
  }

  const stageList = (
    <div
      ref={ref}
      className={sideBySide || selection.bare ? 'arena-stages arena-stages-row' : 'arena-stages'}
    >
      {stages.map((loaded) => (
        <Stage
          key={loaded.name + (loaded === second ? ':vs' : '')}
          loaded={loaded}
          scenario={scenario.id}
          frame={frame}
          effects={effects}
          container={container}
          theme={selection.theme}
          motion={selection.motion}
          messages={tableWords}
          broken={words.broken(loaded.name)}
          scale={scale}
          onIntent={onIntent(loaded.name)}
        />
      ))}
    </div>
  )

  if (selection.bare) return <main className="arena-bare">{stageList}</main>
  if (ENTRIES.length === 0) return <p className="arena-problem">{words.noEntries}</p>

  return (
    <main className="arena-chrome" data-theme={selection.theme}>
      <header className="arena-head">
        <h1>{words.title}</h1>
        <form className="arena-controls" onSubmit={(event) => event.preventDefault()}>
          <label>
            {words.entry}
            <select
              value={primary?.name ?? ''}
              onChange={(event) => update({ entry: event.target.value })}
            >
              {ENTRIES.map((loaded) => (
                <option key={loaded.name} value={loaded.name}>
                  {loaded.entry?.manifest.name ?? loaded.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {words.compareWith}
            <select
              value={selection.vs ?? ''}
              onChange={(event) =>
                update({ vs: event.target.value === '' ? null : event.target.value })
              }
            >
              <option value="">{words.none}</option>
              {ENTRIES.map((loaded) => (
                <option key={loaded.name} value={loaded.name}>
                  {loaded.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {words.seats}
            <select
              value={scenario.seats}
              onChange={(event) =>
                update({ scenario: `${event.target.value}-${scenario.phase}`, frame: null })
              }
            >
              {SEAT_COUNTS.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
          <label>
            {words.phase}
            <select
              value={scenario.phase}
              onChange={(event) =>
                update({ scenario: `${scenario.seats}-${event.target.value}`, frame: null })
              }
            >
              {PHASES.map((phase) => (
                <option key={phase} value={phase}>
                  {words.phaseName(phase)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {words.container}
            <select
              value={container.id}
              onChange={(event) =>
                update({ container: event.target.value as Selection['container'] })
              }
            >
              {CONTAINERS.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {words.containerName(candidate.id)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {words.theme}
            <select
              value={selection.theme}
              onChange={(event) =>
                update({ theme: event.target.value === 'dark' ? 'dark' : 'light' })
              }
            >
              <option value="light">{words.light}</option>
              <option value="dark">{words.dark}</option>
            </select>
          </label>
          <label>
            {words.motion}
            <select
              value={selection.motion}
              onChange={(event) =>
                update({ motion: event.target.value === 'reduced' ? 'reduced' : 'full' })
              }
            >
              <option value="full">{words.motionFull}</option>
              <option value="reduced">{words.motionReduced}</option>
            </select>
          </label>
          <label>
            {words.language}
            <select
              value={selection.lang}
              onChange={(event) => update({ lang: event.target.value === 'de' ? 'de' : 'en' })}
            >
              {LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {words.languageName(language)}
                </option>
              ))}
            </select>
          </label>
        </form>
        <div className="arena-transport">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            aria-label={words.previous}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => (running ? setPlaying(false) : play())}
            aria-label={running ? words.pause : words.play}
          >
            {running ? '❚❚' : '▶'}
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            disabled={index === last}
            aria-label={words.nextFrame}
          >
            ›
          </button>
          <input
            type="range"
            min={0}
            max={last}
            value={index}
            aria-label={words.frame({ index, count: frames.length })}
            onChange={(event) => {
              setPlaying(false)
              goTo(Number(event.target.value))
            }}
          />
          <output>{words.frame({ index, count: frames.length })}</output>
        </div>
        <ul className="arena-about">
          {shown.map((loaded) => (
            <li key={loaded.name}>
              <strong>{loaded.name}</strong>{' '}
              {loaded.entry === null ? (
                <code>{loaded.problem}</code>
              ) : (
                words.direction({
                  direction: loaded.entry.manifest.direction,
                  author: loaded.entry.manifest.author,
                })
              )}{' '}
              <a href={`scores/${loaded.name}/index.html`}>{words.scorecard}</a>
            </li>
          ))}
          <li aria-live="polite">{words.lastIntent(lastIntent)}</li>
        </ul>
      </header>
      {stageList}
    </main>
  )
}
