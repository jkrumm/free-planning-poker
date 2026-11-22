/**
 * What a load run reports besides k6's own summary: the containers' CPU and memory from `docker stats`, the peak of
 * upgrades per second, and the markdown of docs/v9/evidence/load.md. Pure: load/run.ts passes in what it read.
 */

export type StatsSample = {
  readonly at: number
  readonly service: string
  /** Percent of one CPU: 100 is one core busy. */
  readonly cpuPercent: number
  readonly memMiB: number
}

export type ServiceUse = {
  readonly samples: number
  readonly peakCpuPercent: number
  readonly meanCpuPercent: number
  readonly peakMemMiB: number
}

const UNITS: Record<string, number> = {
  B: 1 / 1024 ** 2,
  kB: 1 / 1024,
  KiB: 1 / 1024,
  MB: 1e6 / 1024 ** 2,
  MiB: 1,
  GB: 1e9 / 1024 ** 2,
  GiB: 1024,
}

/** "123.4MiB" or "812kB" as mebibytes; NaN when the text is no size. */
export function mebibytes(text: string): number {
  const match = /^([\d.]+)\s*([A-Za-z]+)$/.exec(text.trim())
  const unit = match?.[2] === undefined ? undefined : UNITS[match[2]]
  return match?.[1] === undefined || unit === undefined ? Number.NaN : Number(match[1]) * unit
}

/**
 * The service a container of the project belongs to: `<project>-api-1` is `api`, a `compose run` container
 * `<project>-k6-run-3f2a` is `k6`.
 */
export function serviceOf(container: string, project: string): string {
  return container
    .slice(project.length + 1)
    .replace(/-run-[0-9a-f]+$/, '')
    .replace(/-\d+$/, '')
}

/** One line of `docker stats --no-stream --format '{{json .}}'`; undefined for a container with no reading yet. */
export function parseStatsLine(line: string, project: string, at: number): StatsSample | undefined {
  let row: { Name?: string; CPUPerc?: string; MemUsage?: string }
  try {
    row = JSON.parse(line) as typeof row
  } catch {
    return undefined
  }
  if (row.Name === undefined || row.CPUPerc === undefined || row.MemUsage === undefined)
    return undefined
  const cpuPercent = Number.parseFloat(row.CPUPerc)
  const memMiB = mebibytes(row.MemUsage.split('/')[0] ?? '')
  if (Number.isNaN(cpuPercent) || Number.isNaN(memMiB)) return undefined
  return { at, service: serviceOf(row.Name, project), cpuPercent, memMiB }
}

export function usageOf(samples: readonly StatsSample[]): Record<string, ServiceUse> {
  const by = new Map<string, StatsSample[]>()
  for (const sample of samples) by.set(sample.service, [...(by.get(sample.service) ?? []), sample])
  const use: Record<string, ServiceUse> = {}
  for (const [service, list] of by)
    use[service] = {
      samples: list.length,
      peakCpuPercent: Math.max(...list.map((sample) => sample.cpuPercent)),
      meanCpuPercent: list.reduce((sum, sample) => sum + sample.cpuPercent, 0) / list.length,
      peakMemMiB: Math.max(...list.map((sample) => sample.memMiB)),
    }
  return use
}

/** The upgrades of every virtual user summed by the second of the run they started in. */
export function upgradesBySecond(
  lines: readonly { readonly bySecond: Readonly<Record<string, number>> }[],
): Map<number, number> {
  const total = new Map<number, number>()
  for (const line of lines)
    for (const [second, count] of Object.entries(line.bySecond))
      total.set(Number(second), (total.get(Number(second)) ?? 0) + count)
  return total
}

/** The busiest second inside [from, to), or the whole run when no window is given. */
export function peakUpgrades(
  bySecond: ReadonlyMap<number, number>,
  window?: { readonly from: number; readonly to: number },
): { readonly perSecond: number; readonly second: number } {
  let best = { perSecond: 0, second: -1 }
  for (const [second, count] of bySecond) {
    if (window !== undefined && (second < window.from || second >= window.to)) continue
    if (count > best.perSecond) best = { perSecond: count, second }
  }
  return best
}

export const fixed = (value: number | undefined, digits = 1): string =>
  value === undefined || Number.isNaN(value) ? 'n/a' : value.toFixed(digits)
