import { describe, expect, test } from 'bun:test'
import { allOutputs, outputRoot } from './output.ts'
import { allowlist } from './script-allowlist.ts'
import { notAllowed, scriptsIn } from './scripts.ts'

describe.each(allOutputs)('zero JavaScript by default, build %s', (output) => {
  test('no executable script and no emitted .js file outside the allowlist', async () => {
    expect(notAllowed(await scriptsIn(outputRoot(output)), allowlist)).toEqual([])
  })
})

test('every allowlist entry names its page and gives a reason', () => {
  for (const entry of allowlist) {
    expect(entry.reason.length).toBeGreaterThan(40)
    expect(entry.match).toMatch(/^[\w./-]*\.html: <script/)
  }
  expect(allowlist.map((entry) => entry.match)).toEqual([
    'contact.html: <script type="module">',
    '.html: <script>window.fppBeforeSend=function',
    '.html: <script defer src="/api/u/p.js" data-website-id=',
  ])
})
