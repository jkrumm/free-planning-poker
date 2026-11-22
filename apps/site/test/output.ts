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
