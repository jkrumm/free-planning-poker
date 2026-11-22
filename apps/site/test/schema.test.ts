import { expect, test } from 'bun:test'
import { jsonLdBlocks, schemaProblems, typesOf } from './schema.ts'

const script = (data: object) =>
  `<script type="application/ld+json">${JSON.stringify(data)}</script>`
const faq = (question: string, answer: string) =>
  script({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } },
    ],
  })

test('a FAQPage whose question and answer are on the page passes', () => {
  const html = `<main><dl><dt>Why a fixture?</dt><dd>Because the rule needs content.</dd></dl></main>${faq('Why a fixture?', 'Because the rule needs content.')}`
  expect(schemaProblems(html)).toEqual([])
})

test('a planted FAQPage whose question is not on the page fails', () => {
  const html = `<main><p>Nothing asked here.</p></main>${faq('Why a fixture?', 'Because the rule needs content.')}`
  expect(schemaProblems(html)).toContain(
    'FAQPage: the question "Why a fixture?" is not on the page',
  )
})

test('the markup itself does not count as the visible text', () => {
  const html = `<main><p>Unrelated.</p></main>${faq('Q?', 'A.')}`
  expect(schemaProblems(html)).toHaveLength(2)
})

test('a type without its required properties fails', () => {
  const html = script({ '@context': 'https://schema.org', '@type': 'Article', headline: 'H' })
  expect(schemaProblems(html)).toContain('Article: no datePublished')
  expect(schemaProblems(script({ '@context': 'https://schema.org', '@type': 'Unknown' }))).toEqual([
    'Unknown: a type the table does not know',
  ])
})

test('blocks are read in page order', () => {
  const html = script({ '@type': 'A' }) + script({ '@type': 'B' })
  expect(typesOf(jsonLdBlocks(html))).toEqual(['A', 'B'])
})
