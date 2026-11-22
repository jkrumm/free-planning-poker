/**
 * Turns the parts the scorecard's tests wrote into arena/scores/<entry>/score.json and index.html, the page the
 * gallery links. Runs after every test, failed ones included, so a failing floor is on the page with its detail.
 */
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ENTRY, OUT } from './support.ts'

const RULES: readonly (readonly [string, string])[] = [
  ['plays', 'Renders every scenario in every container and theme without an error'],
  ['reading-order', 'Seats and cards are elements in reading order with accessible names'],
  ['keyboard', 'Every intent is reachable by keyboard'],
  ['reduced-motion', 'With reduced motion the reveal reaches its end state without movement'],
  ['size', "The entry's own code is at most 60 kB gzip"],
  ['frame-time', 'The median frame of the throttled reveal at 30 seats is at most 20 ms'],
  ['colours', 'No colour literal outside tokens'],
  ['contained', 'Imports only the contract and stays inside its directory'],
]

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`

type Floor = { rule: string; pass: boolean; detail: unknown }
type Shots = {
  container: string
  theme: string
  shots: string[]
  problems: unknown[]
  errors: string[]
}

const read = <T>(name: string): T | undefined => {
  const path = join(OUT, 'parts', `${name}.json`)
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : undefined
}

const escape = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

export default function report(): void {
  if (ENTRY === '' || !existsSync(join(OUT, 'parts'))) return
  const parts = readdirSync(join(OUT, 'parts')).map((file) => file.replace(/\.json$/, ''))
  const floors = new Map<string, Floor>()
  // A rule recorded by several tests (one per container and theme) passes only when every one passed.
  for (const part of parts.filter((name) => name.startsWith('floor-'))) {
    const result = read<Floor>(part)!
    floors.set(result.rule, result)
  }
  const shots = parts.filter((name) => name.startsWith('shots-')).map((name) => read<Shots>(name)!)
  const plays =
    shots.length === 6 &&
    shots.every((part) => part.problems.length === 0 && part.errors.length === 0)
  floors.set('plays', {
    rule: 'plays',
    pass: plays,
    detail: shots.map(({ container, theme, problems, errors }) => ({
      container,
      theme,
      problems,
      errors,
    })),
  })
  const floor = RULES.map(([rule, text]) => ({
    rule,
    text,
    pass: floors.get(rule)?.pass ?? false,
    measured: floors.has(rule),
    detail: floors.get(rule)?.detail ?? 'not measured: its test did not run to the end',
  }))
  const score = {
    entry: ENTRY,
    at: new Date().toISOString(),
    floorPassed: floor.every((rule) => rule.pass),
    floor,
    size: read('size') ?? null,
    frames: read('frames') ?? null,
    determinism: read('determinism') ?? null,
    compare: read('compare') ?? null,
    axe: read('axe') ?? null,
    videos: read<string[]>('videos') ?? [],
    shots: shots.map(({ container, theme, shots: files }) => ({ container, theme, files })),
  }
  writeFileSync(join(OUT, 'score.json'), `${JSON.stringify(score, null, 2)}\n`)
  rmSync(join(OUT, '.video'), { recursive: true, force: true })

  const axe = (score.axe ?? []) as {
    state: string
    violations: {
      id: string
      impact: string | null
      help: string
      nodes: number
      targets?: string[]
    }[]
  }[]
  const impacts = new Map<string, number>()
  for (const state of axe)
    for (const violation of state.violations)
      impacts.set(
        violation.impact ?? 'unknown',
        (impacts.get(violation.impact ?? 'unknown') ?? 0) + violation.nodes,
      )
  const frames = (score.frames ?? []) as {
    scenario: string
    container: string
    median: number
    worst: number
    frames: number
    longTasks: number
    longTaskMs: number
  }[]
  const size = score.size as { ownGzip: number; addsGzip: number } | null

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Scorecard: ${escape(ENTRY)}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 16px; line-height: 1.4; }
  table { border-collapse: collapse; margin-block: 8px 16px; }
  th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: start; vertical-align: top; }
  .pass { color: #1d7a46; } .fail { color: #b3261e; font-weight: 600; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
  .grid figure { margin: 0; } .grid img { inline-size: 100%; border: 1px solid #ccc; }
  figcaption { font-size: 12px; } pre { white-space: pre-wrap; font-size: 12px; margin: 0; }
  video { max-inline-size: 100%; }
</style>
</head>
<body>
<h1>Scorecard: ${escape(ENTRY)}</h1>
<p>${escape(score.at)}. Floor: <strong class="${score.floorPassed ? 'pass' : 'fail'}">${score.floorPassed ? 'passed' : 'failed'}</strong>. <a href="../../#entry=${encodeURIComponent(ENTRY)}">Open in the gallery</a></p>
<h2>Floor</h2>
<table><tr><th>Rule</th><th>Result</th><th>Detail</th></tr>
${floor.map((rule) => `<tr><td>${escape(rule.text)}</td><td class="${rule.pass ? 'pass' : 'fail'}">${rule.pass ? 'pass' : 'fail'}</td><td><details><summary>detail</summary><pre>${escape(JSON.stringify(rule.detail, null, 2))}</pre></details></td></tr>`).join('\n')}
</table>
<h2>Size</h2>
<p>${size === null ? 'not measured' : `Own code ${kb(size.ownGzip)} gzip; adds ${kb(size.addsGzip)} gzip to the room's bundle (everything but React).`}</p>
<h2>Reveal frame times, CPU slowed 4×</h2>
<table><tr><th>Scenario</th><th>Container</th><th>Median</th><th>Worst</th><th>Frames in 2 s</th><th>Long tasks</th></tr>
${frames.map((timing) => `<tr><td>${timing.scenario}</td><td>${timing.container}</td><td>${timing.median} ms</td><td>${timing.worst} ms</td><td>${timing.frames}</td><td>${timing.longTasks} (${timing.longTaskMs} ms)</td></tr>`).join('\n')}
</table>
<h2>Determinism</h2>
<p>${score.determinism === null ? 'not measured' : (score.determinism as { same: boolean }).same ? 'Two runs of 9-split-reveal gave identical screenshots.' : '<span class="fail">Two runs of 9-split-reveal differed.</span>'}</p>
<h2>Compare mode</h2>
<p>${score.compare === null ? 'not measured' : (score.compare as { frames: { same: boolean }[] }).frames.every((frame) => frame.same) ? 'Two copies stayed in step through the split reveal at 30 seats.' : '<span class="fail">Two copies drifted apart.</span>'}</p>
<h2>axe</h2>
<p>${axe.length === 0 ? 'not measured' : [...impacts].map(([impact, count]) => `${count} ${escape(impact)}`).join(', ') || 'No findings.'}</p>
<table><tr><th>State</th><th>Findings</th></tr>
${axe.map((state) => `<tr><td>${escape(state.state)}</td><td>${state.violations.map((violation) => `${escape(violation.impact ?? '')} ${escape(violation.id)} (${violation.nodes}): ${escape(violation.help)} <code>${escape((violation.targets ?? []).join(', '))}</code>`).join('<br>') || 'none'}</td></tr>`).join('\n')}
</table>
<h2>The split reveal</h2>
${score.videos.map((file) => `<figure><video src="${escape(file)}" controls muted playsinline></video><figcaption>${escape(file)}</figcaption></figure>`).join('\n')}
<h2>End states</h2>
${score.shots.map((group) => `<h3>${escape(group.container)}, ${escape(group.theme)}</h3><div class="grid">${group.files.map((file) => `<figure><a href="${escape(file)}"><img loading="lazy" src="${escape(file)}" alt=""></a><figcaption>${escape(file.split('/').at(-1) ?? file)}</figcaption></figure>`).join('')}</div>`).join('\n')}
</body>
</html>
`
  writeFileSync(join(OUT, 'index.html'), html)
  console.log(
    `scorecard: arena/scores/${ENTRY}/index.html (floor ${score.floorPassed ? 'passed' : 'failed'})`,
  )
}
