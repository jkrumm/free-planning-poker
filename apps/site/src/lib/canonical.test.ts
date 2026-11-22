import { expect, test } from 'bun:test'
import { canonicalPath } from './canonical.ts'

test('a built page maps to the path the site serves it at', () => {
  expect(canonicalPath('/')).toBe('/')
  expect(canonicalPath('/index.html')).toBe('/')
  expect(canonicalPath('/guide')).toBe('/guide')
  expect(canonicalPath('/guide/')).toBe('/guide')
  expect(canonicalPath('/guide.html')).toBe('/guide')
  expect(canonicalPath('/guides/x/index.html')).toBe('/guides/x')
})
