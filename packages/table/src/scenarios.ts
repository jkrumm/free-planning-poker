/**
 * The arena's scenarios as data (docs/v9/UX.md, The table arena): one script per seat count and phase, each with its
 * own seed. `@fpp/room-core/sim`'s `playScript` turns a script into frames, so every entry sees exactly the same
 * frames. The host adds the other dimensions (container, theme, reduced motion); they change nothing in the script.
 * Built without chance: who votes what follows from the seat's index, so a script reads the same on every run.
 */
import type { Script, ScriptAction, ScriptStep } from '@fpp/room-core/sim'

export const SEAT_COUNTS = [2, 5, 9, 16, 30] as const
export type SeatCount = (typeof SEAT_COUNTS)[number]

export const PHASES = [
  'voting',
  'countdown',
  'unanimous-reveal',
  'split-reveal',
  'second-vote',
  'settled',
] as const
export type Phase = (typeof PHASES)[number]

/** The containers every entry is shown in: a phone, a laptop, a wall screen. */
export const CONTAINERS = [
  { id: 'phone', width: 360, height: 640 },
  { id: 'laptop', width: 1280, height: 800 },
  { id: 'wall', width: 1920, height: 1080 },
] as const
export type Container = (typeof CONTAINERS)[number]

/** Who is not simply sitting at the table, by seat count (seat 0 is always the viewer, an active player). */
export type PeopleMix = {
  readonly away: readonly number[]
  readonly reconnecting: readonly number[]
  readonly spectators: readonly number[]
}

const MIXES: Readonly<Record<SeatCount, PeopleMix>> = {
  2: { away: [], reconnecting: [], spectators: [] },
  5: { away: [3], reconnecting: [], spectators: [] },
  9: { away: [], reconnecting: [5], spectators: [8] },
  16: { away: [4], reconnecting: [9], spectators: [14, 15] },
  30: { away: [6, 17], reconnecting: [11], spectators: [27, 28, 29] },
}

export type Scenario = {
  /** `<seats>-<phase>`, e.g. `9-split-reveal`. */
  readonly id: string
  readonly seats: SeatCount
  readonly phase: Phase
  readonly people: PeopleMix
  readonly script: Script
  /** The step whose frame is the reveal, for phases that reveal: where the scorecard measures. */
  readonly reveal: number | null
}

/** Names of every length and from several scripts, so a seat's label is tested for more than "Bob". */
const NAMES = [
  'Mara',
  'Jonas',
  'Aiko',
  'Friederike-Charlotte',
  'Luis',
  'Ngozi',
  'Pål',
  'Zoë',
  'Mateusz',
  '王小明',
  'Siobhán',
  'Oluwaseun',
  'Émile',
  'Ana',
  'Kristóf',
  'Priyanka',
  'Tomasz',
  'Leilani',
  'Rüdiger',
  'Chidi',
  'Ingrid',
  'Yusuf',
  'Camille',
  'Dmitri',
  'Hannah',
  'Kwame',
  'Sofía',
  'Bartholomew',
  'Nils',
  'Amara',
]

/** Votes of a split round: neighbours and outliers, a lone abstain. */
const SPLIT = ['5', '8', '5', '3', '8', '13', '5', '?', '2', '5', '8', '3', '5', '8', '21']
/** Votes of the second round: closer together. */
const CLOSER = ['5', '8', '5', '5', '8', '5']

const ROOM = 'Team Alpha'
const TOPIC = 'Checkout: pay with a saved card'
const QUEUE = ['Export the sprint report as CSV', 'Dark mode for the settings page']

const isPlayer = (mix: PeopleMix, seat: number) => !mix.spectators.includes(seat)
const isActive = (mix: PeopleMix, seat: number) =>
  isPlayer(mix, seat) && !mix.away.includes(seat) && !mix.reconnecting.includes(seat)

/** The seats that vote: every active player, seat 0 first. */
const votersOf = (seats: number, mix: PeopleMix) =>
  Array.from({ length: seats }, (_, seat) => seat).filter((seat) => isActive(mix, seat))

function setup(seats: number, mix: PeopleMix, autoReveal: boolean): ScriptStep {
  const actions: ScriptAction[] = []
  for (let seat = 0; seat < seats; seat += 1)
    actions.push({
      do: 'join',
      name: NAMES[seat % NAMES.length]!,
      role: isPlayer(mix, seat) ? 'player' : 'spectator',
    })
  actions.push({ do: 'title', seat: 0, title: TOPIC }, { do: 'topics', seat: 0, titles: QUEUE })
  if (autoReveal) actions.push({ do: 'settings', seat: 0, autoReveal: true, revealCountdown: 3 })
  for (const seat of mix.away) actions.push({ do: 'away', seat, away: true })
  for (const seat of mix.reconnecting)
    actions.push({ do: 'connection', seat, presence: 'reconnecting' })
  return { after: 0, actions }
}

/** Votes in about eight steps, whatever the room's size, so a large room does not take longer to watch. */
function trickle(votes: readonly (readonly [number, string])[], gap: number): ScriptStep[] {
  const per = Math.max(1, Math.ceil(votes.length / 8))
  const steps: ScriptStep[] = []
  for (let start = 0; start < votes.length; start += per)
    steps.push({
      after: gap,
      actions: votes
        .slice(start, start + per)
        .map(([seat, card]) => ({ do: 'vote' as const, seat, card })),
    })
  return steps
}

const reactions = (seats: number): ScriptStep => ({
  after: 300,
  actions: [
    { do: 'react', seat: 1, to: 0, emoji: '👍' },
    ...(seats > 2 ? [{ do: 'react' as const, seat: 2, to: null, emoji: '🎉' }] : []),
  ],
})

function build(seats: SeatCount, phase: Phase, seed: number): Scenario {
  const mix = MIXES[seats]
  const voters = votersOf(seats, mix)
  const split = voters.map((seat, order) => [seat, SPLIT[order % SPLIT.length]!] as const)
  const steps: ScriptStep[] = [setup(seats, mix, phase === 'countdown')]
  let reveal: number | null = null
  const revealNow = () => {
    steps.push({ after: 700, actions: [{ do: 'reveal', seat: 0 }] })
    reveal = steps.length - 1
  }

  switch (phase) {
    case 'voting': {
      // Seat 0 and about half of the others have voted; the round stays open.
      const some = split.filter((_, order) => order === 0 || order % 2 === 1)
      steps.push(...trickle(some, 500), reactions(seats))
      break
    }
    case 'countdown':
      // The last vote starts the countdown to the automatic reveal; the script stops with 2 s left.
      steps.push(...trickle(split, 500), { after: 1000, actions: [] })
      break
    case 'unanimous-reveal':
      steps.push(
        ...trickle(
          voters.map((seat) => [seat, '8'] as const),
          450,
        ),
      )
      revealNow()
      break
    case 'split-reveal':
      steps.push(...trickle(split, 450))
      revealNow()
      steps.push(reactions(seats))
      break
    case 'second-vote': {
      steps.push(...trickle(split, 450))
      revealNow()
      steps.push({ after: 2500, actions: [{ do: 'revote', seat: 0 }] })
      const again = voters
        .filter((_, order) => order % 3 !== 2)
        .map((seat, order) => [seat, CLOSER[order % CLOSER.length]!] as const)
      steps.push(...trickle(again, 500))
      break
    }
    case 'settled':
      steps.push(...trickle(split, 450))
      revealNow()
      steps.push({ after: 2500, actions: [{ do: 'settle', seat: 0, card: '8' }] })
      break
  }
  return {
    id: `${seats}-${phase}`,
    seats,
    phase,
    people: mix,
    script: { seed, room: ROOM, steps },
    reveal,
  }
}

/** Every scenario: each seat count with each phase, seat counts ascending. */
export const SCENARIOS: readonly Scenario[] = SEAT_COUNTS.flatMap((seats) =>
  PHASES.map((phase, order) => build(seats, phase, seats * 100 + order)),
)

export const scenarioById = (id: string): Scenario | undefined =>
  SCENARIOS.find((scenario) => scenario.id === id)
