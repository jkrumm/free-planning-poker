import { expect, test } from 'bun:test'
import { socialImagePath } from './social.ts'

test('the image of a page sits under /og at its own path', () => {
  expect(socialImagePath('/')).toBe('/og/index.png')
  expect(socialImagePath('/guide')).toBe('/og/guide.png')
  expect(socialImagePath('/guide.html')).toBe('/og/guide.png')
  expect(socialImagePath('/glossary/spread/')).toBe('/og/glossary/spread.png')
  expect(socialImagePath('/404.html')).toBe('/og/404.png')
})
