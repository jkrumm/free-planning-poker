// Prints the status of every external link of the guide pages (the pillar and src/content/guides), read from their
// Markdown. A link counts only when it answers 200 at the address written, with no redirect: a redirect is a link to
// fix. Run by hand on the day a guide is written or revised: `bun apps/site/scripts/check-links.ts`.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const content = join(import.meta.dir, '..', 'src', 'content')
const files = [
  join(content, 'pillar', 'guide.md'),
  ...readdirSync(join(content, 'guides'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => join(content, 'guides', name)),
]

const links = new Map<string, string[]>()
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) {
    const url = match[1] ?? ''
    links.set(url, [...(links.get(url) ?? []), file.slice(content.length + 1)])
  }
}

async function status(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (link check)' },
      signal: AbortSignal.timeout(30_000),
    })
    const to = response.headers.get('location')
    return to ? `${response.status} -> ${to}` : String(response.status)
  } catch (error) {
    return `error: ${error instanceof Error ? error.message : String(error)}`
  }
}

const day = new Date().toISOString().slice(0, 10)
let failed = 0
console.log(`External links of ${files.length} guide pages, checked ${day}`)
for (const [url, where] of links) {
  const result = await status(url)
  if (result !== '200') failed += 1
  console.log(`${result.padEnd(6)} ${url}  (${[...new Set(where)].join(', ')})`)
}
console.log(
  failed === 0
    ? `all ${links.size} links answered 200`
    : `${failed} of ${links.size} links did not answer 200`,
)
process.exit(failed === 0 ? 0 : 1)
