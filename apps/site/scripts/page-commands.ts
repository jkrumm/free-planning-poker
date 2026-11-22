// The commands of a page, read from its source: `bun apps/site/scripts/page-commands.ts <block>` prints the block named
// `data-commands="<block>"` of src/pages/self-hosting.astro, as the shell would read it. .github/workflows/selfhost.yml runs what
// this prints, so changing a command on the page changes what the workflow runs. A block is one `<pre data-commands="name">
// <code>...</code></pre>`; braces and an opening angle bracket are not written inside it (Astro would read them).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const selfHostingPage = join(import.meta.dir, '..', 'src', 'pages', 'self-hosting.astro')

const entities: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}

/** The text of one block of a page's source, entities decoded, with one trailing newline; throws when there is no such block. */
export function commandsOf(source: string, name: string): string {
  const blocks = [
    ...source.matchAll(/<pre data-commands="([^"]+)"><code>([\s\S]*?)<\/code><\/pre>/g),
  ]
  const found = blocks.filter((match) => match[1] === name)
  if (found.length !== 1) {
    const known = blocks.map((match) => match[1]).join(', ') || 'none'
    throw new Error(`the page has ${found.length} blocks named "${name}" (blocks: ${known})`)
  }
  const text = (found[0]?.[2] ?? '').replace(
    /&(amp|lt|gt|quot|#39);/g,
    (match) => entities[match] ?? match,
  )
  return `${text.trim()}\n`
}

if (import.meta.main) {
  const name = process.argv[2]
  if (name === undefined) {
    console.error('usage: bun apps/site/scripts/page-commands.ts <block>')
    process.exit(2)
  }
  try {
    process.stdout.write(commandsOf(readFileSync(selfHostingPage, 'utf8'), name))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
