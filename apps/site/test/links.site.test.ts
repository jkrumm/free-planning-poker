import { describe, expect, test } from 'bun:test'
import { allOutputs, idsOf, listFiles, outputRoot, readText } from './output.ts'

// The room app and the API are other apps behind the same origin; their links are not the site's to resolve.
const notTheSite = /^\/(?:room|_room|api)(?:\/|$)/

/** The file a site path is served from, as Workers static assets would find it. */
function fileOf(path: string, files: Set<string>): string | undefined {
  const candidates =
    path === '/'
      ? ['index.html']
      : [path.slice(1), `${path.slice(1)}.html`, `${path.slice(1)}/index.html`]
  return candidates.find((candidate) => files.has(candidate))
}

describe.each(allOutputs)('internal links, build %s', (output) => {
  test('every link and anchor resolves to a built page', async () => {
    const root = outputRoot(output)
    const files = new Set(await listFiles(root))
    const broken: string[] = []
    for (const rel of files) {
      if (!rel.endsWith('.html')) continue
      const html = await readText(root, rel)
      for (const link of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
        const url = link[1] ?? ''
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)) continue
        const [path = '', hash] = url.split('#')
        if (notTheSite.test(path)) continue
        const target = path === '' ? rel : fileOf(path, files)
        if (target === undefined) {
          broken.push(`${rel} -> ${url}`)
        } else if (
          hash &&
          target.endsWith('.html') &&
          !idsOf(await readText(root, target)).has(hash)
        ) {
          broken.push(`${rel} -> ${url} (no such anchor)`)
        }
      }
    }
    expect(broken).toEqual([])
  })
})
