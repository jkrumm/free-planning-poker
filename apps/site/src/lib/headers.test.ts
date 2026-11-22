import { describe, expect, test } from 'bun:test'
import { headersFile, securityHeaders } from './headers.ts'

describe('headersFile', () => {
  test('beta sets noindex on every path', () => {
    expect(headersFile('beta').split('\n').slice(0, 1)).toEqual(['/*'])
    expect(headersFile('beta')).toContain('  X-Robots-Tag: noindex\n')
  })

  test('production sets no robots header', () => {
    expect(headersFile('production')).not.toContain('X-Robots-Tag')
  })

  test('both carry every security header of the API route', () => {
    for (const target of ['beta', 'production'] as const)
      for (const [name, value] of Object.entries(securityHeaders))
        expect(headersFile(target)).toContain(`  ${name}: ${value}\n`)
  })
})
