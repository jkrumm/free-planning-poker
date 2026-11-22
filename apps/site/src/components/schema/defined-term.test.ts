import { expect, test } from 'bun:test'
import { definedTerm, definedTermSet } from './defined-term.ts'
import { jsonLd } from './json-ld.ts'

const set = 'https://free-planning-poker.com/glossary'
const term = {
  name: 'Spread',
  description: 'The range between the lowest and the highest card.',
  url: `${set}/spread`,
}

test('a DefinedTerm names its set by address', () => {
  expect(definedTerm({ ...term, setUrl: set })).toEqual({
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    ...term,
    inDefinedTermSet: set,
  })
})

test('a DefinedTermSet lists its terms without repeating the context', () => {
  const data = definedTermSet({ name: 'Glossary', description: 'Terms.', url: set, terms: [term] })
  expect(data['@type']).toBe('DefinedTermSet')
  expect(data.hasDefinedTerm).toEqual([{ '@type': 'DefinedTerm', ...term }])
})

test('a closing script tag inside a value cannot end the block', () => {
  const text = jsonLd(
    definedTerm({ ...term, name: '</script><script>alert(1)</script>', setUrl: set }),
  )
  expect(text).not.toContain('<')
  expect(JSON.parse(text).name).toBe('</script><script>alert(1)</script>')
})
