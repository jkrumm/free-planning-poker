/**
 * Helpers for the room-core tests: a room on a seeded clock, seats, and one command at a time through `step`.
 */
import { expect } from 'bun:test'
import type { Command, ServerCommand } from '../src/protocol/types.ts'
import { initialState, step, type StepResult } from '../src/room.ts'
import { seededClock, type SeededClock } from '../src/sim/clock.ts'
import type { RoomState } from '../src/state.ts'
import { parseSlug, type SeatIndex } from '../src/values.ts'

const SLUG = parseSlug('team-alpha')!

export type Room = { state: RoomState; clock: SeededClock; ids: number }

export function newRoom(seed = 1, change?: (state: RoomState) => RoomState): Room {
  const clock = seededClock(seed)
  const state = initialState({ slug: SLUG, name: 'Team Alpha' }, clock.ctx())
  return { state: change ? change(state) : state, clock, ids: 0 }
}

/** Runs one seat command and keeps the new state; returns the step's result. */
export function send(room: Room, by: SeatIndex, command: Command, id?: string): StepResult {
  room.ids += 1
  const result = step(room.state, { by, id: id ?? `c${room.ids}`, command }, room.clock.ctx())
  room.state = result.state
  return result
}

export function server(room: Room, command: ServerCommand): StepResult {
  const result = step(room.state, { by: 'server', command }, room.clock.ctx())
  room.state = result.state
  return result
}

export function join(room: Room, name: string, role: 'player' | 'spectator' = 'player'): SeatIndex {
  const result = server(room, { type: 'seat.join', payload: { name, avatar: name, role } })
  if (!result.ok) throw new Error(`join refused: ${result.reason}`)
  const joined = result.events[0]
  if (joined?.type !== 'seat.joined') throw new Error('join without seat.joined')
  return joined.payload.seat.index
}

export const current = (room: Room) =>
  room.state.activity.rounds.find((round) => round.id === room.state.activity.current)!

export function expectRejected(result: StepResult, reason: string) {
  expect(result.ok ? 'ok' : result.reason).toBe(reason)
}

export function types(result: StepResult): string[] {
  return result.ok ? result.events.map((event) => event.type) : [`rejected:${result.reason}`]
}
