import { describe, expect, test } from 'bun:test'
import { canonicalOf, listFiles, metaOf, outputRoot, readText } from './output.ts'

const draftPage = 'guides/draft-guide.html'
const productionRoot = outputRoot('fixture-production')
const betaRoot = outputRoot('fixture-beta')

describe('production build of the fixture content', () => {
  test('a published entry has a route, written from MDX too', async () => {
    const files = await listFiles(productionRoot)
    expect(files).toContain('guides/published-guide.html')
    expect(files).toContain('docs/mdx-doc.html')
    expect(await readText(productionRoot, 'docs/mdx-doc.html')).toContain('<h1')
  })

  test('a draft has no route, and a section holding only drafts has no index', async () => {
    const files = await listFiles(productionRoot)
    expect(files).not.toContain(draftPage)
    expect(files).not.toContain('glossary/draft-term.html')
    expect(files).not.toContain('glossary.html')
  })

  test('no file names a draft, in an index or anywhere else', async () => {
    const files = await listFiles(productionRoot)
    for (const rel of files) {
      const text = await readText(productionRoot, rel)
      expect(text).not.toContain('draft-guide')
      expect(text).not.toContain('draft-term')
    }
  })

  test('the index lists the published entry', async () => {
    const index = await readText(productionRoot, 'guides.html')
    expect(index).toContain('href="/guides/published-guide"')
    expect(index).not.toContain('Draft guide')
  })

  test('the questions are on the page as plain text', async () => {
    const page = await readText(productionRoot, 'guides/published-guide.html')
    expect(page).toContain('<dt>Why a fixture?</dt>')
    expect(page).toContain('<dd>Because the draft rule needs content to act on.</dd>')
  })
})

describe('beta build of the fixture content', () => {
  test('a draft is built with a draft line, robots noindex and the production canonical', async () => {
    const page = await readText(betaRoot, draftPage)
    expect(metaOf(page, 'robots')).toBe('noindex, nofollow')
    expect(page).toContain('Draft: this page is not published yet.')
    expect(canonicalOf(page)).toBe('https://free-planning-poker.com/guides/draft-guide')
  })

  test('a published entry on beta is not marked', async () => {
    const page = await readText(betaRoot, 'guides/published-guide.html')
    expect(metaOf(page, 'robots')).toBe('index, follow')
    expect(page).not.toContain('Draft:')
  })

  test('the lists show the draft, marked', async () => {
    expect(await readText(betaRoot, 'guides.html')).toContain('href="/guides/draft-guide"')
    expect(await listFiles(betaRoot)).toContain('glossary/draft-term.html')
  })
})
