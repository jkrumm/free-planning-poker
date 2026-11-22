import { describe, expect, test } from 'bun:test'
import { allOutputs, canonicalOf, listFiles, metaOf, outputRoot, readText } from './output.ts'
import { jsonLdBlocks, schemaProblems, typesOf } from './schema.ts'

const entryPage = /^(?:guides|glossary|vs|blog|docs)\/[^/]+\.html$/

describe.each(allOutputs)('structured data of every page, build %s', (output) => {
  test('every block has the required properties of its type and every FAQPage question is on the page', async () => {
    const root = outputRoot(output)
    const failed: string[] = []
    for (const rel of (await listFiles(root)).filter((file) => file.endsWith('.html')))
      for (const problem of schemaProblems(await readText(root, rel)))
        failed.push(`${rel}: ${problem}`)
    expect(failed).toEqual([])
  })

  test('each page carries the types its kind needs, once', async () => {
    const root = outputRoot(output)
    const failed: string[] = []
    for (const rel of (await listFiles(root)).filter((file) => file.endsWith('.html'))) {
      const html = await readText(root, rel)
      const types = typesOf(jsonLdBlocks(html))
      const noindex = metaOf(html, 'robots')?.includes('noindex') === true
      const expected = ['Organization', 'WebSite']
      if (rel === 'index.html') expected.push('SoftwareApplication')
      if (rel === 'guide.html' || entryPage.test(rel)) expected.push('Article')
      // A page kept out of every index has no trail; the home page is the top of every trail.
      if (!noindex && rel !== 'index.html') expected.push('BreadcrumbList')
      for (const type of expected)
        if (types.filter((found) => found === type).length !== 1)
          failed.push(`${rel}: not exactly one ${type}`)
      if (rel !== 'index.html' && types.includes('SoftwareApplication'))
        failed.push(`${rel}: SoftwareApplication`)
      if (noindex && types.includes('BreadcrumbList'))
        failed.push(`${rel}: BreadcrumbList on a noindex page`)
    }
    expect(failed).toEqual([])
  })

  test('an Article names the page it is on and is never modified before it was published', async () => {
    const root = outputRoot(output)
    for (const rel of (await listFiles(root)).filter((file) => file.endsWith('.html'))) {
      const html = await readText(root, rel)
      const article = jsonLdBlocks(html).find((block) => block['@type'] === 'Article')
      if (article === undefined) continue
      expect(article.mainEntityOfPage).toBe(canonicalOf(html)!)
      expect(Date.parse(String(article.dateModified))).toBeGreaterThanOrEqual(
        Date.parse(String(article.datePublished)),
      )
    }
  })

  test('the software application has no rating and is free', async () => {
    const home = jsonLdBlocks(await readText(outputRoot(output), 'index.html')).find(
      (block) => block['@type'] === 'SoftwareApplication',
    )
    expect(home).toBeDefined()
    expect(home).not.toHaveProperty('aggregateRating')
    expect(home).not.toHaveProperty('review')
    expect(home?.offers).toMatchObject({ price: '0' })
  })
})

describe('the pages of the production build', () => {
  test('/ carries Organization, WebSite and SoftwareApplication', async () => {
    const html = await readText(outputRoot('production'), 'index.html')
    expect(typesOf(jsonLdBlocks(html))).toEqual(['Organization', 'WebSite', 'SoftwareApplication'])
  })

  test('/guide carries Article and BreadcrumbList, and FAQPage for the questions it prints', async () => {
    const html = await readText(outputRoot('production'), 'guide.html')
    expect(typesOf(jsonLdBlocks(html))).toEqual([
      'Organization',
      'WebSite',
      'Article',
      'BreadcrumbList',
      'FAQPage',
    ])
  })
})

test('a fixture page with questions prints them and marks them up from the same data', async () => {
  const html = await readText(outputRoot('fixture-production'), 'guides/published-guide.html')
  expect(typesOf(jsonLdBlocks(html))).toContain('FAQPage')
  expect(html).toContain('Why a fixture?')
})
