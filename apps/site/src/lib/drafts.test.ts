import { expect, test } from 'bun:test'
import { visibleEntries } from './drafts.ts'
import { resolveTarget } from './target.ts'

const entries = [{ data: { draft: false } }, { data: { draft: true } }]

test('production drops drafts and beta keeps them', () => {
  expect(visibleEntries(entries, 'production')).toEqual([{ data: { draft: false } }])
  expect(visibleEntries(entries, 'beta')).toEqual(entries)
})

test('an unset or unknown target is production, so a forgotten flag hides drafts', () => {
  expect(resolveTarget(undefined)).toBe('production')
  expect(resolveTarget('')).toBe('production')
  expect(resolveTarget('Beta')).toBe('production')
  expect(resolveTarget('beta')).toBe('beta')
})
