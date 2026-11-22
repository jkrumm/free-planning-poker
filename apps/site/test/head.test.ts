import { expect, test } from 'bun:test'
import { headProblems } from './head.ts'

const page = (omit: string[] = []) =>
  [
    '<title>A page</title>',
    '<meta name="description" content="What the page says.">',
    '<link rel="canonical" href="https://free-planning-poker.com/a">',
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="A page">',
    '<meta property="og:description" content="What the page says.">',
    '<meta property="og:url" content="https://free-planning-poker.com/a">',
    '<meta property="og:image" content="https://free-planning-poker.com/og/a.png">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">',
  ]
    .filter((line) => !omit.some((key) => line.includes(key)))
    .join('')

const present = () => true

test('a complete head has no problem', () => {
  expect(headProblems(page(), present)).toEqual([])
})

test('a planted page without a description fails', () => {
  expect(headProblems(page(['name="description"']), present)).toEqual(['no meta description'])
})

test('a page without a title, a canonical link or an image file fails', () => {
  expect(headProblems(page(['<title>']), present)).toEqual(['no title'])
  expect(headProblems(page(['rel="canonical"']), present)).toContain(
    'no canonical link on the production origin',
  )
  expect(headProblems(page(), () => false)).toEqual([
    'og:image https://free-planning-poker.com/og/a.png is not in the output',
  ])
})
