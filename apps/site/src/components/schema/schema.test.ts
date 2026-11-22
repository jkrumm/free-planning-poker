import { expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { article } from './article.ts'
import { breadcrumbList } from './breadcrumb-list.ts'
import { faqPage } from './faq-page.ts'
import { jsonLd } from './json-ld.ts'
import { organization, webSite } from './organization.ts'
import { softwareApplication } from './software-application.ts'

test('an Article takes its dates from the entry and falls back to published', () => {
  const input = {
    headline: 'H',
    description: 'D',
    url: 'https://free-planning-poker.com/guide',
    image: 'https://free-planning-poker.com/og/guide.png',
    published: new Date('2026-01-02'),
  }
  expect(article(input).dateModified).toBe('2026-01-02T00:00:00.000Z')
  expect(article({ ...input, updated: new Date('2026-03-04') }).dateModified).toBe(
    '2026-03-04T00:00:00.000Z',
  )
  expect(article(input).author).toEqual({ '@type': 'Person', name: 'Johannes Krumm' })
})

test('a BreadcrumbList counts its positions from one', () => {
  const list = breadcrumbList([
    { name: 'Home', url: 'https://free-planning-poker.com/' },
    { name: 'Guide', url: 'https://free-planning-poker.com/guide' },
  ])
  expect(list.itemListElement.map((item) => item.position)).toEqual([1, 2])
})

test('a FAQPage is the array it is given, nothing more', () => {
  const page = faqPage([{ question: 'Q?', answer: 'A.' }])
  expect(page.mainEntity).toEqual([
    { '@type': 'Question', name: 'Q?', acceptedAnswer: { '@type': 'Answer', text: 'A.' } },
  ])
})

test('the software application cannot carry a rating', () => {
  const data = softwareApplication()
  expect(data).not.toHaveProperty('aggregateRating')
  expect(data.offers.price).toBe('0')
})

test('a closing script tag in any value cannot end the block', () => {
  const text = jsonLd(
    faqPage([{ question: '</script><script>alert(1)</script>', answer: '<!-- x' }]),
  )
  expect(text).not.toContain('<')
  expect(JSON.parse(text).mainEntity[0].name).toBe('</script><script>alert(1)</script>')
})

test('the organization and the website name the production origin', () => {
  expect(organization().url).toBe('https://free-planning-poker.com')
  expect(webSite().url).toBe('https://free-planning-poker.com')
})

test('FAQPage enters a page only through questions.astro', () => {
  const src = join(import.meta.dir, '..', '..')
  const files = (readdirSync(src, { recursive: true, encoding: 'utf8' }) as string[]).filter(
    (file) => /\.(?:astro|ts|mdx?)$/.test(file) && !file.endsWith('.test.ts'),
  )
  const mentions = files.filter((file) =>
    /FAQPage|faq-page/.test(readFileSync(join(src, file), 'utf8')),
  )
  expect(mentions.toSorted()).toEqual([
    'components/schema/faq-page.ts',
    'components/schema/questions.astro',
  ])
})
