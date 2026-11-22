import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** The four builds `make site` writes: the real site for both targets, the fixture content for both targets. */
export type Output = 'production' | 'beta' | 'fixture-production' | 'fixture-beta'

export const realOutputs: Output[] = ['production', 'beta']
export const allOutputs: Output[] = ['production', 'beta', 'fixture-production', 'fixture-beta']

export function outputRoot(output: Output): string {
  const root = join(import.meta.dir, '..', 'dist', output)
  if (!existsSync(root)) throw new Error(`no build at ${root}: run make site`)
  return root
}

/** Every file under a directory, as paths relative to it with forward slashes. */
export async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      join(entry.parentPath, entry.name)
        .slice(root.length + 1)
        .replaceAll('\\', '/'),
    )
}

export function readText(root: string, rel: string): Promise<string> {
  return readFile(join(root, rel), 'utf8')
}

const entities: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}
const decode = (text: string) =>
  text.replace(/&(amp|lt|gt|quot|#39);/g, (match) => entities[match] ?? match)

export function titleOf(html: string): string | undefined {
  const match = /<title>([^<]*)<\/title>/.exec(html)
  return match?.[1] === undefined ? undefined : decode(match[1])
}

export function metaOf(html: string, name: string): string | undefined {
  const match = new RegExp(`<meta name="${name}" content="([^"]*)"`).exec(html)
  return match?.[1] === undefined ? undefined : decode(match[1])
}

export function canonicalOf(html: string): string | undefined {
  return /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1]
}

export function idsOf(html: string): Set<string> {
  return new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1] ?? ''))
}

/** The visible text of an HTML fragment: tags become a space, entities are decoded, white space is one space. */
export function textOf(html: string): string {
  return decode(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim()
}

/** The text of each `h2` section of a page, by heading, in page order. */
export function sectionsOf(html: string): [heading: string, text: string][] {
  const main = /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? ''
  return [...main.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|$)/g)].map((match) => [
    textOf(match[1] ?? ''),
    textOf(match[2] ?? ''),
  ])
}

/** The attributes of the first tag of a kind that carries `name="<name>"`, a boolean attribute as an empty string. */
export function fieldOf(html: string, name: string): Record<string, string> | undefined {
  const tag = new RegExp(`<(?:input|textarea)\\b[^>]*\\sname="${name}"[^>]*>`).exec(html)?.[0]
  if (tag === undefined) return undefined
  const attrs: Record<string, string> = {}
  for (const match of tag.matchAll(/\s([a-z][\w-]*)(?:="([^"]*)")?/g))
    attrs[match[1] ?? ''] = match[2] ?? ''
  return attrs
}
