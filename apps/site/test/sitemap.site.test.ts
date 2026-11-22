import { describe, expect, test } from 'bun:test'
import { listFiles, outputRoot, readText } from './output.ts'

// The address and lastmod of every url of a sitemap file.
function urlsOf(xml: string): { loc: string; lastmod: string | undefined }[] {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((block) => {
    const body = block[1] ?? ''
    return {
      loc: /<loc>([^<]+)<\/loc>/.exec(body)?.[1] ?? '',
      lastmod: /<lastmod>([^<]+)<\/lastmod>/.exec(body)?.[1],
    }
  })
}

describe('production sitemap', () => {
  test('lists no path under the room, the room key path or the API', async () => {
    const root = outputRoot('production')
    expect(await listFiles(root)).toContain('sitemap-index.xml')
    const locs = urlsOf(await readText(root, 'sitemap-0.xml')).map(
      (url) => new URL(url.loc).pathname,
    )
    expect(locs).toContain('/guide')
    expect(locs.filter((path) => /^\/(?:room|_room|api)(?:\/|$)/.test(path))).toEqual([])
  })
})

describe('sitemap over the fixture content', () => {
  test('production holds no draft, and a published entry carries its published date as lastmod', async () => {
    const xml = await readText(outputRoot('fixture-production'), 'sitemap-0.xml')
    expect(xml).not.toContain('draft-guide')
    expect(xml).not.toContain('draft-term')
    const published = urlsOf(xml).find((url) => url.loc.endsWith('/guides/published-guide'))
    expect(published?.lastmod).toBe('2026-11-01T00:00:00.000Z')
  })
})
