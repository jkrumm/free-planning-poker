/**
 * One entry on one frame: a box of exactly the container's size with the tokens, the theme and the motion setting
 * on it, the entry inside, and a boundary that shows a message instead of a blank gallery when the entry throws.
 */
import { Component, type ReactNode } from 'react'
import type { ScriptFrame } from '@fpp/room-core/sim'
import type { Intent, TableEffect, TableMessages, Theme } from '@fpp/table/contract'
import type { Container } from '@fpp/table/scenarios'
import type { LoadedEntry } from './entry-check.ts'
import type { Motion } from './selection.ts'

type BoundaryProps = { readonly fallback: ReactNode; readonly children: ReactNode }

/** React offers error boundaries as class components only. */
class Boundary extends Component<BoundaryProps, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export type StageProps = {
  readonly loaded: LoadedEntry
  readonly scenario: string
  readonly frame: ScriptFrame
  readonly effects: readonly TableEffect[]
  readonly container: Container
  readonly theme: Theme
  readonly motion: Motion
  readonly messages: TableMessages
  readonly broken: string
  /** The gallery shrinks a large container to fit; 1 in the bare mode. */
  readonly scale: number
  readonly onIntent: (intent: Intent) => void
}

export function Stage(props: StageProps) {
  const { loaded, container, scale } = props
  const { entry } = loaded
  const width = container.width
  const height = container.height
  return (
    <div
      className="arena-frame"
      style={{ inlineSize: width * scale, blockSize: height * scale }}
      data-testid={`stage-${loaded.name}`}
    >
      <div
        className="arena-stage"
        data-entry={loaded.name}
        data-theme={props.theme}
        data-motion={props.motion}
        style={{
          inlineSize: width,
          blockSize: height,
          transform: scale === 1 ? undefined : `scale(${scale})`,
        }}
      >
        {entry === null ? (
          <p className="arena-problem">{props.broken}</p>
        ) : (
          <Boundary
            key={`${loaded.name}:${props.scenario}`}
            fallback={<p className="arena-problem">{props.broken}</p>}
          >
            <entry.Table
              view={props.frame.view}
              now={props.frame.now}
              size={{ width, height }}
              preferences={{
                calm: false,
                reducedMotion: props.motion === 'reduced',
                sound: false,
                theme: props.theme,
              }}
              messages={props.messages}
              onIntent={props.onIntent}
              effects={props.effects}
            />
          </Boundary>
        )}
      </div>
    </div>
  )
}
