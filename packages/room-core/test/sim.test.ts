/**
 * The simulator tiers (docs/plan.yaml, v9-room-runtime, changes 2 to 4): 200 seeds in `make check-fast`, 10,000 in
 * `.github/workflows/nightly.yml` through `bun run sim --seeds 10000`. A failing seed prints how to replay it.
 */
import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { replayCommand, simulate, type SimResult } from '../src/sim/sim.entry.ts'

const SEEDS = 200
const BUDGET_MS = 30_000

const report = (result: SimResult) =>
  `seed ${result.seed} (${result.profile}, ${result.bots.join(' ')}):\n  ${result.violations.join('\n  ')}\nreplay: ${replayCommand(result.seed)}`

/** One run of seed 42: the run's own trace hash and a SHA-256 of the whole trace. */
async function traceOf42() {
  const result = await simulate({ seed: 42, trace: true })
  expect(result.trace.length).toBeGreaterThan(500)
  return {
    ours: result.hash,
    sha: createHash('sha256').update(result.trace.join('\n')).digest('hex'),
  }
}

describe('the simulator', () => {
  test(
    `${SEEDS} seeds hold every invariant within ${BUDGET_MS / 1000} s`,
    async () => {
      const started = performance.now()
      for (let seed = 1; seed <= SEEDS; seed += 1) {
        const result = await simulate({ seed })
        if (!result.ok) throw new Error(report(result))
      }
      expect(performance.now() - started).toBeLessThan(BUDGET_MS)
    },
    BUDGET_MS * 2,
  )

  test('seed 2044: a deploy hands the room to a process that starts the fx limit afresh', async () => {
    const result = await simulate({ seed: 2044 })
    expect(result.stats.deploys).toBe(1)
    expect(result.violations).toEqual([])
  })

  test('one seed gives one trace: hashed twice, the hashes match', async () => {
    const first = await traceOf42()
    expect(await traceOf42()).toEqual(first)
    expect((await simulate({ seed: 43 })).hash).not.toBe(first.ours)
  })

  test('a seeded fault, the round id check on a vote switched off, is caught within 200 seeds', async () => {
    let caught: SimResult | undefined
    for (let seed = 1; seed <= SEEDS && caught === undefined; seed += 1) {
      const result = await simulate({ seed, faults: { voteAnyRound: true } })
      if (!result.ok) caught = result
    }
    expect(caught).toBeDefined()
    expect(caught!.violations[0]).toContain('counted for')
    console.log(
      `seeded fault caught: ${caught!.violations[0]} (${replayCommand(caught!.seed, { voteAnyRound: true })})`,
    )
  })

  test('1,000 resumes at generated points are each welcomed with project(state, seat) at that moment', async () => {
    let probes = 0
    let projected = 0
    for (let seed = 1; probes < 1000; seed += 1) {
      const result = await simulate({ seed, probes: 400 })
      if (!result.ok) throw new Error(report(result))
      probes += result.stats.probes
      projected += result.stats.projected
    }
    expect(probes).toBeGreaterThanOrEqual(1000)
    expect(projected).toBeGreaterThanOrEqual(probes)
  }, 30_000)
})
