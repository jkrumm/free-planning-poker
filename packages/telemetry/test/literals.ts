/**
 * The scan behind the rule "no telemetry name is a literal outside packages/telemetry": the string literals of a source
 * file that spell a registered name, and its imports of OpenTelemetry. Shared by the guard test and its own proof.
 */
import { ATTR, EVENT, METRIC, SERVICE, SPAN } from '../src/names.ts'
import { UMAMI } from '../src/umami.ts'

export const REGISTERED: ReadonlySet<string> = new Set([
  ...Object.values(ATTR),
  ...Object.values(EVENT),
  ...Object.values(SPAN),
  ...Object.values(SERVICE),
  ...Object.values(METRIC).map((metric) => metric.name),
])

/** Blanks comments, keeping line breaks. */
const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')

/** An Umami event name is a common word of other vocabularies (a nack reason, a runtime event): it is refused only as the event of a `track(` call. */
export function trackLiteralsOf(source: string): Finding[] {
  const found: Finding[] = []
  const code = stripComments(source)
  for (const match of code.matchAll(/\btrack\s*\(\s*['"`]([a-z_]+)['"`]/g))
    if (match[1] !== undefined && match[1] in UMAMI)
      found.push({ line: code.slice(0, match.index).split('\n').length, text: match[1] })
  return found
}

export type Finding = { readonly line: number; readonly text: string }

/** A literal that is a registered name, or any `fpp.` dotted name: the registry is the one place they are written. */
export function literalsOf(source: string): Finding[] {
  const found: Finding[] = []
  const code = stripComments(source)
  for (const match of code.matchAll(
    /'((?:\\.|[^'\\\n])*)'|"((?:\\.|[^"\\\n])*)"|`((?:\\.|[^`\\$])*)`/g,
  )) {
    const text = (match[1] ?? match[2] ?? match[3] ?? '').trim()
    if (!REGISTERED.has(text) && !/^fpp\.[a-z]/.test(text)) continue
    found.push({ line: code.slice(0, match.index).split('\n').length, text })
  }
  return found
}

/** An import of an OpenTelemetry package. */
export function otelImportsOf(source: string): Finding[] {
  const found: Finding[] = []
  const code = stripComments(source)
  for (const match of code.matchAll(
    /(?:from|import\s*\(|require\s*\()\s*['"](@opentelemetry\/[^'"]+)['"]/g,
  ))
    found.push({ line: code.slice(0, match.index).split('\n').length, text: match[1] ?? '' })
  return found
}
