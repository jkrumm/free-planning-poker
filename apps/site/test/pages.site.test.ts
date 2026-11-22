import { describe, expect, test } from 'bun:test'
import {
  canonicalOf,
  idsOf,
  listFiles,
  metaOf,
  outputRoot,
  readText,
  realOutputs,
  titleOf,
} from './output.ts'

const origin = 'https://free-planning-poker.com'
const prefix = 'Free Planning Poker - '

const pages = [
  {
    path: '/',
    file: 'index.html',
    title: 'Free Planning Poker | Quick & Easy Estimates',
    ids: ['features', 'privacy'],
  },
  {
    path: '/guide',
    file: 'guide.html',
    title: prefix + 'Guide',
    ids: ['master-the-art-of-planning-poker'],
  },
  { path: '/analytics', file: 'analytics.html', title: prefix + 'Analytics', ids: [] },
  { path: '/roadmap', file: 'roadmap.html', title: prefix + 'Roadmap', ids: [] },
  { path: '/contact', file: 'contact.html', title: prefix + 'Contact', ids: [] },
  {
    path: '/imprint',
    file: 'imprint.html',
    title: prefix + 'Imprint & Privacy Policy',
    ids: ['license'],
  },
  { path: '/404', file: '404.html', title: prefix + '404 - Page Not Found', ids: [] },
]

describe.each(realOutputs)('every v1 page, build %s', (output) => {
  test.each(pages)('$path has title, description, canonical and anchors', async (page) => {
    const html = await readText(outputRoot(output), page.file)
    expect(titleOf(html)).toBe(page.title)
    expect(metaOf(html, 'description')?.length).toBeGreaterThan(20)
    expect(canonicalOf(html)).toBe(origin + page.path)
    expect(html).toContain('<html lang="en"')
    expect(metaOf(html, 'robots')).toBe(
      page.path === '/404' ? 'noindex, nofollow' : 'index, follow',
    )
    for (const id of page.ids) expect(idsOf(html).has(id)).toBe(true)
  })

  test('each page is a file of its own name, so Workers static assets serve it without a redirect', async () => {
    const files = await listFiles(outputRoot(output))
    for (const page of pages) expect(files).toContain(page.file)
    expect(files.filter((file) => file.endsWith('/index.html'))).toEqual([])
  })

  test('the page text is in the HTML', async () => {
    const root = outputRoot(output)
    expect(await readText(root, 'guide.html')).toContain('<td>At least one week</td>')
    expect(await readText(root, 'imprint.html')).toContain(
      'Bayerisches Landesamt für Datenschutzaufsicht',
    )
  })
})
