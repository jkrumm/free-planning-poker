import { expect, test } from 'bun:test'
import config from '../astro.config.ts'
import { listFiles, outputRoot, allOutputs } from './output.ts'

test('locale routing is explicit and has no fallback', () => {
  expect(config.i18n?.locales).toEqual(['en', 'de', 'es', 'fr', 'zh'])
  expect(config.i18n?.defaultLocale).toBe('en')
  expect(config.i18n?.routing).toEqual({
    prefixDefaultLocale: false,
    redirectToDefaultLocale: false,
  })
  expect(config.i18n !== undefined && 'fallback' in config.i18n).toBe(false)
})

test('URLs are files without a trailing slash', () => {
  expect(config.trailingSlash).toBe('never')
  expect(config.build?.format).toBe('file')
  expect(config.site).toBe('https://free-planning-poker.com')
})

test.each(allOutputs)(
  'no translated page and no redirect page exists, build %s',
  async (output) => {
    const files = await listFiles(outputRoot(output))
    expect(files.filter((file) => /^(?:de|es|fr|zh)(?:\/|\.html$)/.test(file))).toEqual([])
  },
)
