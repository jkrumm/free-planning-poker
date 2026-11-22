import { listFiles, readText } from './output.ts'

/** A script a page may carry, with the reason it is allowed. `match` is a substring of a finding. */
export type AllowedScript = { match: string; reason: string }

/** Script types that hold data and run nothing. */
const dataTypes = new Set(['application/ld+json', 'application/json'])

function describe(rel: string, what: string): string {
  return `${rel}: ${what}`
}

/** Every executable script of one page: a script tag that is not data, an inline handler, a javascript: link. */
export function executableIn(rel: string, html: string): string[] {
  const found: string[] = []
  for (const tag of html.matchAll(/<script\b([^>]*)>(?:([\s\S]*?)<\/script>)?/gi)) {
    const type = /\btype=["']?([^"'\s>]*)/i.exec(tag[1] ?? '')?.[1]?.toLowerCase()
    if (type !== undefined && dataTypes.has(type)) continue
    // An inline script is named by its text, so an entry allows that script and not any inline one.
    const inline = /\ssrc=/i.test(tag[1] ?? '') ? '' : (tag[2] ?? '')
    found.push(describe(rel, `<script${tag[1] ?? ''}>${inline}`))
  }
  for (const tag of html.matchAll(/<[a-z][^>]*>/gi)) {
    const handler = /\son[a-z]+\s*=/i.exec(tag[0])
    if (handler) found.push(describe(rel, `inline handler in ${tag[0]}`))
    if (/\b(?:href|src|action)=["']?\s*javascript:/i.test(tag[0]))
      found.push(describe(rel, `javascript: url in ${tag[0]}`))
  }
  return found
}

/** Every script of a built site: in each page, and every emitted JavaScript file. */
export async function scriptsIn(root: string): Promise<string[]> {
  const files = await listFiles(root)
  const found: string[] = []
  for (const rel of files) {
    if (/\.(?:m?js|cjs)$/.test(rel)) found.push(describe(rel, 'emitted JavaScript file'))
    if (rel.endsWith('.html')) found.push(...executableIn(rel, await readText(root, rel)))
  }
  return found
}

export function notAllowed(found: string[], allowlist: readonly AllowedScript[]): string[] {
  return found.filter((item) => !allowlist.some((entry) => item.includes(entry.match)))
}
