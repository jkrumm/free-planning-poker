import { expect, test } from 'bun:test'
import { breadcrumbs } from './breadcrumbs.ts'

test('the home page has no trail', () => {
  expect(breadcrumbs('/', 'Home')).toEqual([])
})

test('a page below the root is Home and itself', () => {
  expect(breadcrumbs('/guide.html', 'Guide')).toEqual([
    { name: 'Home', path: '/' },
    { name: 'Guide', path: '/guide' },
  ])
})

test('an entry is Home, its section and itself, however deep its id', () => {
  const trail = [
    { name: 'Home', path: '/' },
    { name: 'Glossary', path: '/glossary' },
  ]
  expect(breadcrumbs('/glossary/spread', 'Spread')).toEqual([
    ...trail,
    { name: 'Spread', path: '/glossary/spread' },
  ])
  expect(breadcrumbs('/glossary/a/b', 'B')).toEqual([
    ...trail,
    { name: 'B', path: '/glossary/a/b' },
  ])
})

test('a section index page is named like the section', () => {
  expect(breadcrumbs('/guides.html', 'guides')).toEqual([
    { name: 'Home', path: '/' },
    { name: 'Guides', path: '/guides' },
  ])
})

test('a nesting that is no section fails the build', () => {
  expect(() => breadcrumbs('/nowhere/page', 'Page')).toThrow('no section named nowhere')
})
