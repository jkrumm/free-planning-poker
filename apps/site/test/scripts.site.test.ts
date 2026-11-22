import { describe, expect, test } from 'bun:test'
import { allOutputs, outputRoot } from './output.ts'
import { allowlist } from './script-allowlist.ts'
import { notAllowed, scriptsIn } from './scripts.ts'

describe.each(allOutputs)('zero JavaScript by default, build %s', (output) => {
  test('no executable script and no emitted .js file outside the allowlist', async () => {
    expect(notAllowed(await scriptsIn(outputRoot(output)), allowlist)).toEqual([])
  })
})

test('the allowlist is empty until a row adds a script with its reason', () => {
  expect(allowlist).toEqual([])
})
