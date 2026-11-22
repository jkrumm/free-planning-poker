import { describe, expect, test } from 'bun:test'
import { playScript, type Script } from '../src/sim/scenario.ts'
import { parseSeatIndex } from '../src/values.ts'

const seatAt = (index: number) => parseSeatIndex(index)!

const script: Script = {
  seed: 7,
  room: 'Arena',
  steps: [
    {
      after: 0,
      actions: [
        { do: 'join', name: 'Ada' },
        { do: 'join', name: 'Ben' },
        { do: 'join', name: 'Cy', role: 'spectator' },
      ],
    },
    { after: 400, actions: [{ do: 'vote', seat: 0, card: '5' }] },
    {
      after: 400,
      actions: [
        { do: 'vote', seat: 1, card: '8' },
        { do: 'react', seat: 1, to: 0, emoji: '👍' },
      ],
    },
    { after: 700, actions: [{ do: 'reveal', seat: 0 }] },
  ],
}

describe('playScript', () => {
  test('one frame per step, seen by seat 0, on the script clock', () => {
    const frames = playScript(script)
    expect(frames.map((frame) => frame.elapsed)).toEqual([0, 400, 800, 1500])
    expect(frames[0]?.view.self).toBe(seatAt(0))
    expect(frames[0]?.view.seats.map((seat) => seat.role)).toEqual([
      'player',
      'player',
      'spectator',
    ])
    expect(frames[2]?.fx).toEqual([{ from: seatAt(1), to: seatAt(0), emoji: '👍' }])
  })

  test('hides another seat card until the reveal, and shows it after', () => {
    const frames = playScript(script)
    const votes = (index: number) => {
      const view = frames[index]!.view
      return view.activity.rounds.find((round) => round.id === view.activity.current)!.votes
    }
    expect(votes(2).map((vote) => vote.card?.label ?? null)).toEqual(['5', null])
    expect(votes(3).map((vote) => vote.card?.label ?? null)).toEqual(['5', '8'])
  })

  test('the same script and seed give the same frames', () => {
    expect(playScript(script)).toEqual(playScript(script))
  })

  test('a step the room refuses throws with its index', () => {
    const refused: Script = {
      ...script,
      steps: [...script.steps, { after: 0, actions: [{ do: 'vote', seat: 0, card: '5' }] }],
    }
    expect(() => playScript(refused)).toThrow('step 4: vote was refused (round_closed)')
  })
})
