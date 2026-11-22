import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { parseChangelog } from './changelog.ts'

const fixture = `# Changelog

Prose before the first release is skipped.

## [2.0.0](https://github.com/o/r/compare/1.0.0...2.0.0) (2026-02-01)

### Features

* **rooms:** add rooms ([abcdef1](https://github.com/o/r/commit/abcdef1234567))

### Bug Fixes

* fix timer, closes [#4](https://github.com/o/r/issues/4) ([1234567](https://github.com/o/r/commit/1234567890))

## 1.0.0 (2026-01-01)

### Features

* first release
`

describe('parseChangelog', () => {
  test('parses releases, sections, items and their commit links, newest first', () => {
    expect(parseChangelog(fixture)).toEqual([
      {
        version: '2.0.0',
        date: '2026-02-01',
        compare: 'https://github.com/o/r/compare/1.0.0...2.0.0',
        sections: [
          {
            title: 'Features',
            items: [
              {
                text: 'rooms: add rooms',
                commit: { sha: 'abcdef1', href: 'https://github.com/o/r/commit/abcdef1234567' },
              },
            ],
          },
          {
            title: 'Bug Fixes',
            items: [
              {
                text: 'fix timer, closes #4',
                commit: { sha: '1234567', href: 'https://github.com/o/r/commit/1234567890' },
              },
            ],
          },
        ],
      },
      {
        version: '1.0.0',
        date: '2026-01-01',
        sections: [{ title: 'Features', items: [{ text: 'first release' }] }],
      },
    ])
  })

  test('the repository CHANGELOG.md parses, and its newest release has a version and a date', () => {
    const releases = parseChangelog(
      readFileSync(new URL('../../../../CHANGELOG.md', import.meta.url), 'utf8'),
    )
    expect(releases[0]?.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(releases[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(releases[0]?.sections[0]?.items[0]?.commit?.href).toStartWith('https://github.com/')
  })

  test('a malformed release heading fails the parse and names its line', () => {
    const malformed =
      '## [2.0.0](https://example.com/compare) (2026-02-01)\n\n## 1.0 (2026-01-01)\n'
    expect(() => parseChangelog(malformed)).toThrow(
      'CHANGELOG.md line 3: unrecognised release heading',
    )
  })
})
