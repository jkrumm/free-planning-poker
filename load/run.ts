/**
 * The load test (`make load`, docs/v9/evidence/load.md): builds the API image, starts deploy/compose.yml with load/compose.yml in
 * a Compose project of its own, runs the k6 scenario in a container on that project's network, samples the containers'
 * CPU and memory, and in the handoff run stops the old API container halfway, as a deploy does. Prints the numbers as
 * markdown and exits non-zero when a threshold fails. It starts containers, so it runs in a slot (`factory slot run`).
 *
 *   bun load/run.ts [--scale full|nightly] [--rooms n] [--handoff] [--no-build]
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PROFILES, THRESHOLDS, type ProfileName } from './k6/profile.ts'
import {
  fixed,
  parseStatsLine,
  peakUpgrades,
  upgradesBySecond,
  usageOf,
  type ServiceUse,
  type StatsSample,
} from './report.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const args = Bun.argv.slice(2)
const flag = (name: string) => args.includes(`--${name}`)
const scaleAt = args.indexOf('--scale')
const scale = (scaleAt === -1 ? 'full' : args[scaleAt + 1]) as ProfileName
if (!(scale in PROFILES)) throw new Error(`--scale is one of ${Object.keys(PROFILES).join(', ')}`)
const handoff = flag('handoff')
const roomsAt = args.indexOf('--rooms')
// A smaller run for debugging the harness: the shape stays, the number of rooms changes.
const profile = {
  ...PROFILES[scale],
  ...(roomsAt === -1 ? {} : { rooms: Number(args[roomsAt + 1]) }),
}

const ORIGIN = 'http://load.test'
const project = `fpp-load-${Math.random().toString(36).slice(2, 8)}`
// One image per commit, shared by runs: the layers are cached, and another lead's `fpp-api:local` is never overwritten.
const image = `fpp-api:load-${Bun.env['OTEL_SERVICE_VERSION'] ?? 'local'}`

/** A port the OS hands out; the base compose file publishes the API on one, and nothing here connects to it. */
async function freePort(): Promise<number> {
  const server = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data() {} } })
  const { port } = server
  server.stop(true)
  return port
}

/** The self-hosting file has no default for its two secrets; every run gets its own, as a self-hoster's .env does. */
const secret = (bytes: number) =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString('hex')

const env: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(Bun.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  ),
  FPP_IMAGE: image,
  FPP_PORT: String(await freePort()),
  ALLOWED_ORIGINS: ORIGIN,
  POSTGRES_PASSWORD: secret(12),
  VISITOR_KEY: secret(24),
  COMPOSE_PROJECT_NAME: project,
}

type Run = { readonly code: number; readonly out: string }

async function run(command: readonly string[]): Promise<Run> {
  const child = Bun.spawn([...command], { cwd: root, env, stdout: 'pipe', stderr: 'pipe' })
  const [out, err] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  return { code: await child.exited, out: out + err }
}

const composeArgs = [
  'docker',
  'compose',
  '-f',
  'deploy/compose.yml',
  '-f',
  'deploy/compose.build.yml',
  '-f',
  'load/compose.yml',
  '--profile',
  'k6',
  ...(handoff ? ['--profile', 'handoff'] : []),
]
const compose = (...rest: string[]) => run([...composeArgs, ...rest])

async function must(label: string, work: Promise<Run>): Promise<string> {
  const result = await work
  if (result.code !== 0) throw new Error(`${label} failed (${result.code}):\n${result.out}`)
  return result.out
}

const log = (line: string) => console.log(`==> ${line}`)

/** Reads a child's output a line at a time. */
async function lines(stream: ReadableStream<Uint8Array>, each: (line: string) => void) {
  const decoder = new TextDecoder()
  let rest = ''
  for await (const chunk of stream) {
    rest += decoder.decode(chunk, { stream: true })
    let end = rest.indexOf('\n')
    while (end !== -1) {
      each(rest.slice(0, end))
      rest = rest.slice(end + 1)
      end = rest.indexOf('\n')
    }
  }
  if (rest !== '') each(rest)
}

const samples: StatsSample[] = []
/** The CPU quota's own account of how often it held the load generator back, last read before it exited. */
const throttle = { periods: 0, throttled: 0, throttledMs: 0 }
const state = { sampling: true }
async function sampler() {
  while (state.sampling) {
    const listed = (
      await run([
        'docker',
        'ps',
        '--format',
        '{{.ID}} {{.Names}}',
        '--filter',
        `label=com.docker.compose.project=${project}`,
      ])
    ).out
      .split('\n')
      .map((line) => line.trim().split(' '))
      .filter(([id]) => id !== undefined && /^[0-9a-f]+$/.test(id))
    if (listed.length === 0) {
      await Bun.sleep(1000)
      continue
    }
    const stats = await run([
      'docker',
      'stats',
      '--no-stream',
      '--format',
      '{{json .}}',
      ...listed.map(([id]) => id!),
    ])
    const at = Date.now()
    for (const line of stats.out.split('\n')) {
      const sample = parseStatsLine(line, project, at)
      if (sample !== undefined) samples.push(sample)
    }
    const k6 = listed.find(([, name]) => /-k6-run-/.test(name ?? ''))
    if (k6?.[0] !== undefined) {
      const cpu = (await run(['docker', 'exec', k6[0], 'cat', '/sys/fs/cgroup/cpu.stat'])).out
      const read = (key: string) => Number(new RegExp(`^${key} (\\d+)`, 'm').exec(cpu)?.[1] ?? 0)
      if (read('nr_periods') > 0)
        Object.assign(throttle, {
          periods: read('nr_periods'),
          throttled: read('nr_throttled'),
          throttledMs: Math.round(read('throttled_usec') / 1000),
        })
    }
  }
}

type Summary = {
  metrics: Record<string, Record<string, number>>
  thresholds: Record<string, boolean>
}

const upgradeLines: { t0: number; bySecond: Record<string, number> }[] = []
let summary: Summary | undefined
let t0 = 0
const handoffResult: { stoppedAfterMs?: number; exitCode?: number; failure?: string } = {}

async function replaceApi() {
  const id = (await must('compose ps', compose('ps', '-aq', 'api'))).trim()
  log('handoff: stopping the old API container (SIGTERM)')
  const started = Date.now()
  await must('compose stop api', compose('stop', 'api'))
  handoffResult.stoppedAfterMs = Date.now() - started
  const inspected = await run(['docker', 'inspect', '-f', '{{.State.ExitCode}}', id])
  handoffResult.exitCode = Number(inspected.out.trim())
  log(
    `handoff: the old container exited ${handoffResult.exitCode} after ${handoffResult.stoppedAfterMs} ms`,
  )
}

function onLine(line: string) {
  if (line.startsWith('LOAD_SUMMARY '))
    summary = JSON.parse(line.slice('LOAD_SUMMARY '.length)) as Summary
  else if (line.startsWith('LOAD_UPGRADES '))
    upgradeLines.push(JSON.parse(line.slice('LOAD_UPGRADES '.length)))
  else if (line.startsWith('LOAD_MARK start ')) t0 = Number(line.slice('LOAD_MARK start '.length))
  else if (line === 'LOAD_MARK handoff')
    replaceApi().catch((error: unknown) => {
      handoffResult.failure = error instanceof Error ? error.message : String(error)
    })
  else if (
    line.startsWith('LOAD_MISSING') ||
    line.startsWith('LOAD_ERROR') ||
    /\b(error|warn)\b/i.test(line)
  )
    console.log(line)
}

async function owners(): Promise<string> {
  const query =
    'select owner, count(*) as rooms, max(epoch) as max_epoch from fpp.room_snapshot group by owner order by rooms desc'
  const result = await compose(
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'fpp',
    '-d',
    'fpp',
    '-At',
    '-F',
    ' | ',
    '-c',
    query,
  )
  return result.code === 0 ? result.out.trim() : `query failed: ${result.out.trim()}`
}

/** Containers of the project that are not running, with the reason: a limit that killed one is a result, not a flake. */
async function deaths(): Promise<string[]> {
  const ids = (
    await run(['docker', 'ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`])
  ).out
    .split('\n')
    .filter((id) => /^[0-9a-f]+$/.test(id))
  const inspected = await run([
    'docker',
    'inspect',
    '-f',
    '{{.Name}} {{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}}',
    ...ids,
  ])
  return inspected.out
    .split('\n')
    .map((line) => line.trim().replace(/^\//, ''))
    .filter(
      (line) =>
        / oom=true/.test(line) ||
        (/ exited /.test(line) && !/-k6-run-/.test(line) && !/ exit=0 /.test(line)),
    )
}

const value = (name: string, key: string): number | undefined => summary?.metrics[name]?.[key]

function report(
  use: Record<string, ServiceUse>,
  ownersText: string,
  died: readonly string[],
  flaps: number,
): string {
  const up = upgradesBySecond(upgradeLines)
  const window = { from: profile.handoffAtS, to: profile.handoffAtS + 40 }
  const storm = peakUpgrades(up, window)
  const overall = peakUpgrades(up)
  const sockets =
    (value('sockets_at_round1', 'count') ?? 0) * (value('sockets_at_round1', 'avg') ?? 0)
  const row = (label: string, name: string) =>
    `| ${label} | ${value(name, 'count') ?? 0} | ${fixed(value(name, 'med'))} | ${fixed(value(name, 'p(95)'))} | ${fixed(value(name, 'p(99)'))} | ${fixed(value(name, 'max'))} |`
  const out = [
    `profile ${scale}: ${profile.rooms} rooms of ${profile.seats} seats, ${handoff ? 'the old API container replaced' : 'no handoff'}`,
    '',
    '| Threshold | Result |',
    '|-|-|',
    ...Object.entries(summary?.thresholds ?? {}).map(
      ([name, ok]) => `| \`${name}\` | ${ok ? 'met' : 'NOT MET'} |`,
    ),
    '',
    '| Fan-out latency (ms) | Samples | p50 | p95 | p99 | Max |',
    '|-|-|-|-|-|-|',
    row('outside the handoff window', 'fanout_ms{phase:steady}'),
    ...(handoff
      ? [row(`handoff window (${THRESHOLDS.handoffWindowS} s)`, 'fanout_ms{phase:handoff}')]
      : []),
    '',
    `peak sockets: ${Math.round(sockets)} (open when the first round started)`,
    `upgrades per second: peak ${overall.perSecond} at ${overall.second} s${handoff ? `, in the handoff window ${storm.perSecond} at ${storm.second} s` : ''}`,
    `votes: ${value('votes_checked', 'count') ?? 0} acknowledged votes compared with their reveal, ${value('votes_missing', 'count') ?? 0} missing`,
    `errors: ${fixed((value('errors', 'rate') ?? Number.NaN) * 100, 3)} % of ${(value('errors', 'passes') ?? 0) + (value('errors', 'fails') ?? 0)} operations`,
    `resumed sockets: ${value('reconnects', 'count') ?? 0}, resume time p50 ${fixed(value('resume_ms', 'med'))} ms, p99 ${fixed(value('resume_ms', 'p(99)'))} ms, max ${fixed(value('resume_ms', 'max'))} ms`,
    `seq gaps ${value('seq_gaps', 'count') ?? 0}, failed upgrades ${value('upgrade_failures', 'count') ?? 0}, commands acked ${value('commands_acked', 'count') ?? 0}`,
    ...(handoff
      ? [
          `old container: exit ${handoffResult.exitCode}, stopped after ${handoffResult.stoppedAfterMs} ms`,
        ]
      : []),
    '',
    '| Container | CPU peak % of one core | CPU mean % | Memory peak MiB | Samples |',
    '|-|-|-|-|-|',
    ...Object.entries(use).map(
      ([service, u]) =>
        `| ${service} | ${fixed(u.peakCpuPercent, 0)} | ${fixed(u.meanCpuPercent, 0)} | ${fixed(u.peakMemMiB, 0)} | ${u.samples} |`,
    ),
    '',
    `proxy health checks took a server out ${flaps} times`,
    `load generator: throttled in ${throttle.throttled} of ${throttle.periods} CPU periods, ${throttle.throttledMs} ms in all`,
    died.length === 0
      ? 'no container was killed or exited early'
      : `CONTAINERS THAT DIED:\n${died.join('\n')}`,
    '',
    'room_snapshot owners after the run (owner, rooms, highest epoch):',
    ownersText,
  ]
  return out.join('\n')
}

let code = 1
const stop = async () => {
  state.sampling = false
  await compose('down', '--volumes', '--remove-orphans')
}
process.on('SIGINT', () => void stop().finally(() => process.exit(130)))
process.on('SIGTERM', () => void stop().finally(() => process.exit(143)))

try {
  if (!flag('no-build')) {
    log(`building ${image}`)
    await must('compose build api', compose('build', 'api'))
  }
  // The proxy and k6 images hold a few files and are named for the project: always built, in a second.
  await must('compose build proxy and k6', compose('build', 'proxy', 'k6'))
  log(`starting the stack ${project}`)
  await must(
    'compose up',
    compose(
      'up',
      '-d',
      '--wait',
      '--no-build',
      'postgres',
      'api',
      'proxy',
      ...(handoff ? ['api-next'] : []),
    ),
  )
  const sampled = sampler()
  log(`k6: ${profile.rooms} rooms, ${profile.endAtS} s`)
  const k6 = Bun.spawn(
    [
      ...composeArgs,
      'run',
      '--rm',
      '-T',
      '--no-deps',
      '-e',
      `LOAD_PROFILE=${JSON.stringify(profile)}`,
      '-e',
      `LOAD_ORIGIN=${ORIGIN}`,
      '-e',
      `LOAD_HANDOFF=${handoff ? '1' : '0'}`,
      'k6',
      'run',
      '--quiet',
      '--log-format',
      'raw',
      '--no-color',
      '/scripts/scenario.ts',
    ],
    { cwd: root, env, stdout: 'pipe', stderr: 'pipe' },
  )
  await Promise.all([lines(k6.stdout, onLine), lines(k6.stderr, onLine)])
  const k6Code = await k6.exited
  state.sampling = false
  await sampled
  const ownersText = handoff ? await owners() : 'not read in a run without a handoff'
  if (summary === undefined) throw new Error(`k6 ended with ${k6Code} and no summary`)
  const flaps = (await compose('logs', '--no-color', 'proxy')).out
    .split('\n')
    .filter((line) => /Server \S+ is DOWN/.test(line)).length
  const died = await deaths()
  const text = report(usageOf(samples), ownersText, died, flaps)
  console.log(text)
  const summaryFile = Bun.env['GITHUB_STEP_SUMMARY']
  if (summaryFile !== undefined)
    appendFileSync(summaryFile, `### load: ${scale}${handoff ? ' + handoff' : ''}\n\n${text}\n\n`)
  mkdirSync(`${root}load/results`, { recursive: true })
  await Bun.write(
    `${root}load/results/${scale}${handoff ? '-handoff' : ''}.json`,
    JSON.stringify({ scale, handoff, t0, summary, handoffResult, use: usageOf(samples) }, null, 2),
  )
  const drainFailed =
    (handoff && (handoffResult.exitCode !== 0 || handoffResult.failure !== undefined)) ||
    died.length > 0
  if (drainFailed)
    console.log('==> FAILED: a container died, or the old one did not exit 0 on SIGTERM')
  code = k6Code !== 0 ? k6Code : drainFailed ? 1 : 0
  if (code !== 0)
    console.log((await compose('logs', '--no-color', '--tail', '30', 'proxy', 'api')).out)
  console.log(code === 0 ? '==> load passed' : `==> FAILED: load (exit ${code}, k6 ${k6Code})`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  const logs = await compose('logs', '--no-color', '--tail', '40', 'api', 'proxy')
  console.error(logs.out)
  console.error(
    (await run(['docker', 'run', '--rm', '--entrypoint', 'ls', image, '-laR', '/app/drizzle'])).out,
  )
} finally {
  await stop()
}
process.exit(code)
