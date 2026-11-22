import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { listFiles, metaOf, outputRoot, readText } from './output.ts'

const dir = join(import.meta.dir, '..', 'src', 'content', 'vs')
const pages = readdirSync(dir)
  .filter((file) => file.endsWith('.md'))
  .map((file) => ({
    id: file.replace(/\.md$/, ''),
    draft: /^draft: true$/m.test(readFileSync(join(dir, file), 'utf8')),
    checked: /^checked: (\S+)$/m.exec(readFileSync(join(dir, file), 'utf8'))?.[1] ?? '',
    sources: [...readFileSync(join(dir, file), 'utf8').matchAll(/^ {4}source: "([^"]+)"$/gm)].map(
      (match) => match[1] ?? '',
    ),
  }))

describe('production build', () => {
  const root = outputRoot('production')

  test('holds a page under /vs for a published comparison and none for a draft', async () => {
    const files = await listFiles(root)
    for (const page of pages) {
      expect(files.includes(`vs/${page.id}.html`), page.id).toBe(!page.draft)
      expect(files.includes(`vs/${page.id}.md`), page.id).toBe(!page.draft)
    }
    if (pages.every((page) => page.draft)) {
      expect(files.filter((file) => file === 'vs.html' || file.startsWith('vs/'))).toEqual([])
    }
  })

  test('names no draft comparison in any file: no sitemap line, no llms.txt line, no link', async () => {
    const drafts = pages.filter((page) => page.draft)
    for (const rel of await listFiles(root)) {
      if (!/\.(?:html|xml|txt|md)$/.test(rel)) continue
      const text = await readText(root, rel)
      for (const page of drafts) expect(text, `${rel}: ${page.id}`).not.toContain(`/vs/${page.id}`)
      if (drafts.length === pages.length) expect(text, rel).not.toContain('href="/vs')
    }
  })
})

describe('beta build', () => {
  const root = outputRoot('beta')

  test('builds the index and every page, each marked as a draft and kept out of the index', async () => {
    const files = await listFiles(root)
    expect(files).toContain('vs.html')
    for (const page of pages) {
      expect(files).toContain(`vs/${page.id}.html`)
      const html = await readText(root, `vs/${page.id}.html`)
      if (page.draft) {
        expect(metaOf(html, 'robots')).toBe('noindex, nofollow')
        expect(html).toContain('Draft: this page is not published yet.')
      }
    }
  })

  test.each(pages)(
    '$id: a checked-on date at the top and a table of dated, linked rows',
    async (page) => {
      const html = await readText(root, `vs/${page.id}.html`)
      expect(html.indexOf(`Checked on ${page.checked}`)).toBeGreaterThan(-1)
      expect(html.indexOf(`Checked on ${page.checked}`)).toBeLessThan(html.indexOf('<table'))
      const rows = html.split('<tbody>')[1]?.split('</tbody>')[0]?.split('<tr>').slice(1) ?? []
      expect(rows).toHaveLength(page.sources.length)
      for (const row of rows) {
        expect(row).toMatch(/<time datetime="\d{4}-\d{2}-\d{2}">\d{4}-\d{2}-\d{2}<\/time>/)
        expect(row).toMatch(/<a href="https:\/\/[^"]+">/)
      }
      expect(html).not.toContain('<img')
    },
  )

  test.each(pages)('$id: the Markdown twin carries the facts', async (page) => {
    const twin = await readText(root, `vs/${page.id}.md`)
    expect(twin).toContain(`Checked on ${page.checked}.`)
    for (const source of page.sources) expect(twin).toContain(source)
  })
})
