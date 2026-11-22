/**
 * A scenario's frames, played once by `@fpp/room-core/sim` and kept, and the effects in flight at a frame: every
 * reaction of the last two seconds of the scenario's clock, so every entry receives the same stream.
 */
import { playScript, type ScriptFrame } from '@fpp/room-core/sim'
import type { TableEffect } from '@fpp/table/contract'
import type { Scenario } from '@fpp/table/scenarios'

/** How long the host keeps an effect in the stream after it arrives. */
export const EFFECT_MS = 2000

const played = new Map<string, readonly ScriptFrame[]>()

export function framesOf(scenario: Scenario): readonly ScriptFrame[] {
  const known = played.get(scenario.id)
  if (known !== undefined) return known
  const frames = playScript(scenario.script)
  played.set(scenario.id, frames)
  return frames
}

export function effectsAt(frames: readonly ScriptFrame[], index: number): TableEffect[] {
  const current = frames[index]
  if (current === undefined) return []
  const effects: TableEffect[] = []
  for (const frame of frames.slice(0, index + 1)) {
    if (current.now - frame.now >= EFFECT_MS) continue
    frame.fx.forEach((fx, order) =>
      effects.push({
        id: `${frame.index}-${order}`,
        kind: 'reaction',
        from: fx.from,
        to: fx.to,
        emoji: fx.emoji,
        at: frame.now,
      }),
    )
  }
  return effects
}
