/**
 * Plays a scripted session for the table arena (docs/v9/UX.md, The table arena): a list of steps, each a few actions
 * at one moment, run through `step` on a seeded clock and seen by one seat through `project`. A script is plain
 * data, so every table entry gets the same frames from it, and the same seed gives the same ids and times. A script
 * that the room refuses is a bug in the script: it throws.
 */
import { DEFAULT_SETTINGS, initialState, step } from '../room.ts'
import { project } from '../project.ts'
import type { Command, Role, ServerCommand, View } from '../protocol/types.ts'
import type { RoomState } from '../state.ts'
import { parseSeatIndex, parseSlug, type SeatIndex } from '../values.ts'
import { seededClock } from './clock.ts'

/** One thing that happens in a script. `seat` is a seat's index, the order of its `join` from 0. */
export type ScriptAction =
  | { readonly do: 'join'; readonly name: string; readonly role?: Role }
  | { readonly do: 'title'; readonly seat: number; readonly title: string }
  | { readonly do: 'topics'; readonly seat: number; readonly titles: readonly string[] }
  | {
      readonly do: 'settings'
      readonly seat: number
      readonly autoReveal?: boolean
      readonly revealCountdown?: number
    }
  | { readonly do: 'vote'; readonly seat: number; readonly card: string }
  | { readonly do: 'clear'; readonly seat: number }
  | { readonly do: 'reveal'; readonly seat: number }
  | { readonly do: 'cancel'; readonly seat: number }
  | { readonly do: 'revote'; readonly seat: number }
  | { readonly do: 'settle'; readonly seat: number; readonly card: string }
  | { readonly do: 'next'; readonly seat: number }
  | { readonly do: 'away'; readonly seat: number; readonly away: boolean }
  | {
      readonly do: 'connection'
      readonly seat: number
      readonly presence: 'active' | 'reconnecting' | 'gone'
    }
  /** The countdown ran out: the server reveals. */
  | { readonly do: 'elapse' }
  /** A reaction thrown by one seat at another (`null`: at the table). Ephemeral: never part of the view. */
  | {
      readonly do: 'react'
      readonly seat: number
      readonly to: number | null
      readonly emoji: string
    }

export type ScriptStep = {
  /** Milliseconds after the previous step; the first step's is counted from the room's creation. */
  readonly after: number
  readonly actions: readonly ScriptAction[]
}

export type Script = {
  /** Fixes every id and so every frame. */
  readonly seed: number
  readonly room: string
  readonly steps: readonly ScriptStep[]
}

/** A reaction as a frame carries it: who threw it, at whom, and what. */
export type ScriptFx = {
  readonly from: SeatIndex
  readonly to: SeatIndex | null
  readonly emoji: string
}

export type ScriptFrame = {
  readonly index: number
  /** The room's clock at this frame, in milliseconds since the epoch. */
  readonly now: number
  /** Milliseconds since the first frame. */
  readonly elapsed: number
  readonly view: View
  readonly fx: readonly ScriptFx[]
}

const seatIndex = (seat: number): SeatIndex => {
  const index = parseSeatIndex(seat)
  if (index === undefined) throw new Error(`not a seat index: ${seat}`)
  return index
}

type Input =
  | { readonly by: SeatIndex; readonly command: Command }
  | { readonly server: ServerCommand }

function inputOf(state: RoomState, action: Exclude<ScriptAction, { do: 'react' }>): Input {
  const round = state.activity.current
  const active = state.topics.find((topic) => topic.state === 'active')
  switch (action.do) {
    case 'join':
      return {
        server: {
          type: 'seat.join',
          payload: { name: action.name, avatar: action.name, role: action.role ?? 'player' },
        },
      }
    case 'title':
      if (active === undefined) throw new Error('no active topic to title')
      return {
        by: seatIndex(action.seat),
        command: {
          type: 'topic.update',
          payload: { topic: active.id, title: action.title, url: null, ref: null },
        },
      }
    case 'topics':
      return {
        by: seatIndex(action.seat),
        command: {
          type: 'topic.add',
          payload: { topics: action.titles.map((title) => ({ title, url: null, ref: null })) },
        },
      }
    case 'settings':
      return {
        by: seatIndex(action.seat),
        command: {
          type: 'room.setSettings',
          payload: {
            ...(action.autoReveal === undefined ? {} : { autoReveal: action.autoReveal }),
            ...(action.revealCountdown === undefined
              ? {}
              : { revealCountdown: action.revealCountdown }),
          },
        },
      }
    case 'vote':
      return {
        by: seatIndex(action.seat),
        command: { type: 'poker.vote', payload: { round, card: action.card } },
      }
    case 'clear':
      return {
        by: seatIndex(action.seat),
        command: { type: 'poker.clearVote', payload: { round } },
      }
    case 'reveal':
      return { by: seatIndex(action.seat), command: { type: 'poker.reveal', payload: { round } } }
    case 'cancel':
      return {
        by: seatIndex(action.seat),
        command: { type: 'poker.cancelReveal', payload: { round } },
      }
    case 'revote':
      return { by: seatIndex(action.seat), command: { type: 'poker.revote', payload: { round } } }
    case 'settle':
      return {
        by: seatIndex(action.seat),
        command: { type: 'poker.settle', payload: { round, card: action.card } },
      }
    case 'next':
      return { by: seatIndex(action.seat), command: { type: 'topic.next', payload: { round } } }
    case 'away':
      return {
        by: seatIndex(action.seat),
        command: {
          type: 'seat.setPresence',
          payload: { presence: action.away ? 'away' : 'active' },
        },
      }
    case 'connection':
      return {
        server: {
          type: 'seat.setConnection',
          payload: { seat: seatIndex(action.seat), presence: action.presence },
        },
      }
    case 'elapse':
      return { server: { type: 'poker.countdownElapsed', payload: { round } } }
  }
}

/**
 * Every frame of a script as `self` sees it: one frame per step, after all of its actions. The room starts with
 * the default settings and no seats; the script's first step usually seats everyone.
 */
export function playScript(script: Script, self: number = 0): ScriptFrame[] {
  const clock = seededClock(script.seed)
  const slug = parseSlug('arena')
  if (slug === undefined) throw new Error('the arena slug does not parse')
  let state = initialState({ slug, name: script.room, settings: DEFAULT_SETTINGS }, clock.ctx())
  const start = clock.now()
  const viewer = seatIndex(self)
  const frames: ScriptFrame[] = []
  let ids = 0
  for (const [index, scriptStep] of script.steps.entries()) {
    clock.advance(scriptStep.after)
    const fx: ScriptFx[] = []
    for (const action of scriptStep.actions) {
      if (action.do === 'react') {
        fx.push({
          from: seatIndex(action.seat),
          to: action.to === null ? null : seatIndex(action.to),
          emoji: action.emoji,
        })
        continue
      }
      const input = inputOf(state, action)
      ids += 1
      const result = step(
        state,
        'server' in input
          ? { by: 'server', command: input.server }
          : { by: input.by, id: `script-${ids}`, command: input.command },
        clock.ctx(),
      )
      if (!result.ok) throw new Error(`step ${index}: ${action.do} was refused (${result.reason})`)
      state = result.state
    }
    frames.push({
      index,
      now: clock.now(),
      elapsed: clock.now() - start,
      view: project(state, viewer),
      fx,
    })
  }
  return frames
}
