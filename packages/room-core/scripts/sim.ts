/**
 * The simulator's command line (`bun run sim`). It lives outside `src` because it reads its arguments and the
 * clock, which no pure file may do.
 *
 *   bun run sim --seed 42                 one seed, its trace printed
 *   bun run sim --seeds 10000 [--from 1]  a tier: every seed from --from on; exits 1 on the first failure
 *   --fault vote-any-round                plant the fault the simulator must catch
 */
import { replayCommand, simulate } from '../src/sim/sim.entry.ts'

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? undefined : args[index + 1]
}
const number = (name: string, fallback: number): number => {
  const value = flag(name)
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) throw new Error(`--${name} needs an integer, got ${value}`)
  return parsed
}

const fault = flag('fault')
if (fault !== undefined && fault !== 'vote-any-round') throw new Error(`unknown fault ${fault}`)
const faults = fault === undefined ? undefined : { voteAnyRound: true }
const options = (seed: number) => (faults === undefined ? { seed } : { seed, faults })

const one = flag('seed')
if (one !== undefined) {
  const result = await simulate({ ...options(number('seed', 0)), trace: true })
  for (const line of result.trace) console.log(line)
  console.log(
    `seed ${result.seed}: ${result.ok ? 'ok' : 'FAILED'} (${result.profile}, ${result.bots.join(' ')}, trace ${result.hash})`,
  )
  for (const violation of result.violations) console.log(`  ${violation}`)
  process.exit(result.ok ? 0 : 1)
}

const seeds = number('seeds', 200)
const from = number('from', 1)
const started = performance.now()
for (let seed = from; seed < from + seeds; seed += 1) {
  const result = await simulate(options(seed))
  if (!result.ok) {
    console.log(`seed ${seed} FAILED (${result.profile}, ${result.bots.join(' ')})`)
    for (const violation of result.violations) console.log(`  ${violation}`)
    console.log(`replay: ${replayCommand(seed, faults)}`)
    process.exit(1)
  }
  if ((seed - from + 1) % 1000 === 0) console.log(`${seed - from + 1} seeds ok`)
}
console.log(
  `${seeds} seeds ok from ${from} in ${((performance.now() - started) / 1000).toFixed(1)} s`,
)
