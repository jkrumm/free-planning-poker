import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { readContentIndex } from './content-index.ts'

const fixtures = join(import.meta.dir, '..', '..', 'test', 'fixtures', 'content')

describe('readContentIndex over the fixture content', () => {
  const index = readContentIndex(fixtures)
  const find = (id: string) => index.find((entry) => entry.id === id)

  test('reads the draft flag of every entry, and the published date', () => {
    expect(find('draft-guide')).toMatchObject({ section: 'guides', data: { draft: true } })
    expect(find('published-guide')?.data.draft).toBe(false)
    expect(find('published-guide')?.data.published.toISOString().slice(0, 10)).toBe('2026-11-01')
  })

  test('reads MDX entries too, and leaves out files whose name starts with an underscore', () => {
    expect(find('mdx-doc')?.section).toBe('docs')
    expect(index.some((entry) => entry.id.startsWith('_'))).toBe(false)
  })
})
