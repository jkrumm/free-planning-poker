import { describe, expect, test } from 'bun:test'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { listFiles, outputRoot, readText } from './output.ts'

const origin = 'https://free-planning-poker.com'
const slugShape = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const blogFiles = (files: string[]) =>
  files.filter((file) => file === 'blog.html' || file.startsWith('blog/'))
const itemsIn = (xml: string) => (xml.match(/<item>/g) ?? []).length

/** The post slugs the build wrote: blog/<slug>.html, the feed and the index excluded. */
function builtSlugs(files: string[]): string[] {
  return files
    .filter((file) => file.startsWith('blog/') && file.endsWith('.html'))
    .map((file) => file.slice('blog/'.length, -'.html'.length))
    .toSorted()
}

/** The post names in a content folder, from the file names the glob loader reads (no leading underscore). */
async function sourceSlugs(dir: string): Promise<string[]> {
  const names = await readdir(dir)
  return names
    .filter((name) => /\.mdx?$/.test(name) && !name.startsWith('_'))
    .map((name) => name.replace(/\.mdx?$/, ''))
    .toSorted()
}

describe('fixture content, production build', () => {
  const root = outputRoot('fixture-production')

  test('the index lists the published post and no draft', async () => {
    const index = await readText(root, 'blog.html')
    expect(index).toContain('href="/blog/published-post"')
    expect(index).not.toContain('draft-post')
  })

  test('the feed is RSS 2.0 with one item, the published post', async () => {
    const xml = await readText(root, 'blog/rss.xml')
    expect(xml.startsWith('<?xml')).toBe(true)
    expect(xml).toContain('<rss version="2.0"')
    expect(itemsIn(xml)).toBe(1)
    expect(xml).toContain(`<link>${origin}/blog/published-post</link>`)
    expect(xml).toContain('<title>Published post</title>')
    expect(xml).toContain('<pubDate>')
    expect(xml).not.toContain('draft-post')
  })

  test('the footer links /blog', async () => {
    expect(await readText(root, 'index.html')).toContain('href="/blog"')
  })

  test('the post has a page of its own, and no file names the draft', async () => {
    const files = await listFiles(root)
    expect(files).toContain('blog/published-post.html')
    for (const rel of files) expect(await readText(root, rel)).not.toContain('draft-post')
  })
})

describe('fixture content, beta build', () => {
  const root = outputRoot('fixture-beta')

  test('the feed holds the draft too, and the draft page is marked', async () => {
    expect(itemsIn(await readText(root, 'blog/rss.xml'))).toBe(2)
    const page = await readText(root, 'blog/draft-post.html')
    expect(page).toContain('Draft: this page is not published yet.')
    expect(page).toContain('<meta name="robots" content="noindex, nofollow"')
  })
})

describe('real content', () => {
  test('production has no blog path: no index, no post, no feed, no footer link', async () => {
    const root = outputRoot('production')
    expect(blogFiles(await listFiles(root))).toEqual([])
    expect(await readText(root, 'index.html')).not.toContain('href="/blog"')
  })

  test('beta has the index, the feed and the first post, marked as a draft', async () => {
    const root = outputRoot('beta')
    const files = await listFiles(root)
    expect(files).toContain('blog.html')
    expect(files).toContain('blog/rss.xml')
    expect(files).toContain('blog/what-is-new-in-9-0-0.html')
    expect(await readText(root, 'blog.html')).toContain('href="/blog/what-is-new-in-9-0-0"')
    expect(itemsIn(await readText(root, 'blog/rss.xml'))).toBe(1)
    const page = await readText(root, 'blog/what-is-new-in-9-0-0.html')
    expect(page).toContain('<meta name="robots" content="noindex, nofollow"')
  })
})

describe.each([
  { output: 'beta' as const, dir: join(import.meta.dir, '..', 'src', 'content', 'blog') },
  { output: 'fixture-beta' as const, dir: join(import.meta.dir, 'fixtures', 'content', 'blog') },
])('post addresses, build $output', ({ output, dir }) => {
  test('each address is lower case with hyphens and is its file name', async () => {
    const sources = await sourceSlugs(dir)
    expect(sources.length).toBeGreaterThan(0)
    for (const slug of sources) expect(slug).toMatch(slugShape)
    expect(builtSlugs(await listFiles(outputRoot(output)))).toEqual(sources)
  })
})
