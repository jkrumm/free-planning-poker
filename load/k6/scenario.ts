/**
 * The k6 scenario (`make load`, docs/v9/evidence/load.md): rooms of seats play three rounds against the stack the
 * orchestrator started. Configuration arrives in the environment: LOAD_PROFILE (a profile as JSON), LOAD_BASE_URL (the
 * proxy in front of the API), LOAD_ORIGIN (an origin the API allows) and LOAD_HANDOFF=1 when the old container is replaced.
 * It prints LOAD_MARK, LOAD_UPGRADES and LOAD_SUMMARY lines for the orchestrator and exits non-zero when a threshold fails.
 */
import http from 'k6/http'
import { sleep } from 'k6'
import { setTimeout } from 'k6/timers'
import type { Options } from 'k6/options'
import { PROFILES, THRESHOLDS, type Profile } from './profile.ts'
import { playRoom } from './room.ts'

const profile = JSON.parse(__ENV['LOAD_PROFILE'] ?? JSON.stringify(PROFILES.nightly)) as Profile
const baseUrl = __ENV['LOAD_BASE_URL'] ?? 'http://proxy:8080'
const origin = __ENV['LOAD_ORIGIN'] ?? 'http://load.test'
const handoff = __ENV['LOAD_HANDOFF'] === '1'

const TREND_STATS = ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count']

export const options: Options = {
  scenarios: {
    rooms: {
      executor: 'per-vu-iterations',
      vus: Math.ceil(profile.rooms / profile.roomsPerVu),
      iterations: 1,
      exec: 'playRooms',
      maxDuration: `${profile.endAtS + 180}s`,
    },
  },
  thresholds: {
    'fanout_ms{phase:steady}': [`p(99)<${THRESHOLDS.fanoutP99Ms}`],
    // Declared so the summary carries it; the handoff's own latency is reported, not held to a threshold.
    'fanout_ms{phase:handoff}': [],
    // A missing vote cannot be made good later: the run ends there instead of playing out its remaining minutes.
    votes_missing: [{ threshold: 'count==0', abortOnFail: true }],
    errors: [`rate<${THRESHOLDS.errorRate}`],
  },
  summaryTrendStats: TREND_STATS,
  discardResponseBodies: false,
}

type Setup = { readonly t0: number }

/** Waits for the stack to answer, then fixes the moment every room measures its schedule from. */
export function setup(): Setup {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const health = http.get(`${baseUrl}/api/health`, { headers: { Origin: origin } })
    if (health.status === 200) return { t0: Date.now() }
    sleep(1)
  }
  throw new Error(`${baseUrl}/api/health did not answer 200 in 60 s`)
}

export async function playRooms(data: Setup): Promise<void> {
  if (__VU === 1) {
    console.log(`LOAD_MARK start ${data.t0}`)
    if (handoff)
      setTimeout(
        () => console.log('LOAD_MARK handoff'),
        data.t0 + profile.handoffAtS * 1000 - Date.now(),
      )
  }
  const first = (__VU - 1) * profile.roomsPerVu
  const rooms = []
  for (let index = first; index < Math.min(profile.rooms, first + profile.roomsPerVu); index += 1)
    rooms.push(playRoom({ profile, t0: data.t0, handoff, baseUrl, origin, index }))
  const outcomes = await Promise.all(rooms)

  // Upgrades by the second they started, one line per virtual user, summed by the orchestrator.
  const bySecond: Record<string, number> = {}
  for (const outcome of outcomes)
    for (const [second, count] of outcome.upgrades)
      bySecond[second] = (bySecond[second] ?? 0) + count
  console.log(`LOAD_UPGRADES ${JSON.stringify({ t0: data.t0, bySecond })}`)
}

type Values = Record<string, number>
type MetricData = {
  values: Values
  thresholds?: Record<string, { ok: boolean }>
}

/** One JSON line the orchestrator reads, and a short text for a person; k6's default table is replaced. */
export function handleSummary(data: { metrics: Record<string, MetricData | undefined> }) {
  const metrics: Record<string, Values> = {}
  const thresholds: Record<string, boolean> = {}
  for (const [name, metric] of Object.entries(data.metrics)) {
    if (metric === undefined) continue
    metrics[name] = metric.values
    for (const [expression, result] of Object.entries(metric.thresholds ?? {}))
      thresholds[`${name} ${expression}`] = result.ok
  }
  const lines = Object.entries(thresholds).map(
    ([name, ok]) => `  ${ok ? 'met    ' : 'NOT MET'} ${name}`,
  )
  const text = ['thresholds:', ...lines, ''].join('\n')
  return { stdout: `${text}LOAD_SUMMARY ${JSON.stringify({ metrics, thresholds })}\n` }
}
