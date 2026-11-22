import type { VsData } from './entry-schema.ts'

const isoDay = (date: Date) => date.toISOString().slice(0, 10)

/** A source address as link text: host and path, without the scheme or a trailing slash. */
export function sourceLabel(source: string): string {
  const url = new URL(source)
  return `${url.host}${url.pathname}`.replace(/\/$/, '')
}

/** The facts of a comparison as Markdown, for the page's twin: the same rows as the table, each with its day and source. */
export function vsTwinFacts(data: VsData): string {
  const lines = [
    `Checked on ${isoDay(data.checked)}. Every fact about ${data.tool.name} was read on the day given, from the page given.`,
    '',
  ]
  for (const fact of data.facts) {
    const ahead = { them: data.tool.name, us: 'Free Planning Poker', even: 'Even' }[fact.ahead]
    lines.push(
      `- **${fact.topic}** (ahead: ${ahead}). ${data.tool.name}: ${fact.claim} Read on ${isoDay(fact.read)}: ${fact.source}`,
      `  Free Planning Poker: ${fact.ours}`,
    )
  }
  return lines.join('\n')
}
