import { describe, expect, test } from 'bun:test'
import { crawlers } from '../src/lib/robots.ts'
import { outputRoot, readText, realOutputs } from './output.ts'

const origin = 'https://free-planning-poker.com'
const blocked = ['Disallow: /room', 'Disallow: /_room/', 'Disallow: /api/']

// The groups of a robots.txt: each block that opens with a User-agent line, with the rules under it.
function groupsOf(text: string): Map<string, string[]> {
  const groups = new Map<string, string[]>()
  for (const block of text.split('\n\n')) {
    const lines = block.split('\n').filter((line) => line !== '' && !line.startsWith('#'))
    const agent = /^User-agent: (.+)$/.exec(lines[0] ?? '')?.[1]
    if (agent !== undefined) groups.set(agent, lines.slice(1))
  }
  return groups
}

describe.each(realOutputs)('robots.txt, build %s', (output) => {
  test('every crawler the policy names has an Allow group', async () => {
    const groups = groupsOf(await readText(outputRoot(output), 'robots.txt'))
    for (const token of crawlers) expect(groups.get(token), token).toContain('Allow: /')
  })

  test('every group, the catch-all included, disallows the room, its key path and the API', async () => {
    const groups = groupsOf(await readText(outputRoot(output), 'robots.txt'))
    expect(groups.has('*')).toBe(true)
    for (const [agent, rules] of groups)
      for (const rule of blocked) expect(rules, agent).toContain(rule)
  })

  test('one Sitemap line names the production sitemap', async () => {
    const lines = (await readText(outputRoot(output), 'robots.txt')).split('\n')
    expect(lines.filter((line) => line.startsWith('Sitemap:'))).toEqual([
      `Sitemap: ${origin}/sitemap-index.xml`,
    ])
  })
})
