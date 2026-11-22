import { expect, test } from 'bun:test'
import { outputRoot, readText } from './output.ts'

// The rules of a _headers file: each path line with the header lines indented under it.
function rulesOf(text: string): Map<string, string[]> {
  const rules = new Map<string, string[]>()
  let path: string | undefined
  for (const line of text.split('\n')) {
    if (line.trim() === '' || line.startsWith('#')) continue
    if (!line.startsWith(' ')) {
      path = line.trim()
      rules.set(path, [])
    } else if (path !== undefined) rules.get(path)?.push(line.trim())
  }
  return rules
}

test('the beta build sets noindex on every path and detaches it nowhere', async () => {
  const text = await readText(outputRoot('beta'), '_headers')
  expect(rulesOf(text).get('/*')).toContain('X-Robots-Tag: noindex')
  expect(text).not.toMatch(/^\s*!\s*X-Robots-Tag/im)
})

test('the production build sets no robots header', async () => {
  const text = await readText(outputRoot('production'), '_headers')
  expect(rulesOf(text).has('/*')).toBe(true)
  expect(text).not.toMatch(/X-Robots-Tag/i)
})
