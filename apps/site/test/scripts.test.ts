import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { allowlist } from './script-allowlist.ts'
import { executableIn, notAllowed, scriptsIn } from './scripts.ts'

describe('the script scanner', () => {
  test('flags an inline script, an external script and a module script', () => {
    expect(executableIn('a.html', '<p>x</p><script>alert(1)</script>')).toHaveLength(1)
    expect(executableIn('a.html', '<script src="/x.js"></script>')).toHaveLength(1)
    expect(executableIn('a.html', '<script type="module">import "/x.js"</script>')).toHaveLength(1)
  })

  test('flags an inline handler and a javascript: link', () => {
    expect(executableIn('a.html', '<button onclick="go()">x</button>')).toHaveLength(1)
    expect(executableIn('a.html', '<a href="javascript:go()">x</a>')).toHaveLength(1)
  })

  test('lets JSON-LD and plain text about scripts through', () => {
    expect(
      executableIn('a.html', '<script type="application/ld+json">{"@type":"Thing"}</script>'),
    ).toEqual([])
    expect(
      executableIn('a.html', '<p>This page has no script and no onclick = anything.</p>'),
    ).toEqual([])
  })

  test('fails a built site with a planted script tag and a planted JavaScript file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fpp-site-scripts-'))
    await mkdir(join(root, '_astro'))
    await writeFile(
      join(root, 'index.html'),
      '<!doctype html><title>x</title><script>alert(1)</script>',
    )
    await writeFile(join(root, '_astro', 'x.js'), 'export {}')
    const found = await scriptsIn(root)
    expect(found).toHaveLength(2)
    expect(notAllowed(found, allowlist)).toHaveLength(2)
  })

  test('an allowlist entry lets exactly what it matches through', () => {
    const found = ['index.html: <script src="/u.js">']
    expect(notAllowed(found, [{ match: '/u.js', reason: 'analytics' }])).toEqual([])
    expect(notAllowed(found, [{ match: '/other.js', reason: 'x' }])).toEqual(found)
  })

  test('every allowlist entry carries its reason', () => {
    for (const entry of allowlist) expect(entry.reason.trim().length).toBeGreaterThan(0)
  })
})
