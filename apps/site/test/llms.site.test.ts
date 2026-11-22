import { describe, expect, test } from 'bun:test'
import { allOutputs, listFiles, outputRoot, readText } from './output.ts'

const origin = 'https://free-planning-poker.com'
const contentPage = /^(?:guides|glossary|vs|blog|docs)\/[^/]+\.html$/

// The addresses llms.txt lists, one per "- [title](address): description" line.
function listedAddresses(text: string): string[] {
  return [...text.matchAll(/^- \[[^\]]+\]\((\S+?)\): /gm)].map((match) => match[1] ?? '')
}

describe.each(allOutputs)('llms.txt, build %s', (output) => {
  test('lists every content page the build serves, the guide included, and nothing else', async () => {
    const root = outputRoot(output)
    const served = (await listFiles(root))
      .filter((file) => contentPage.test(file) || file === 'guide.html')
      .map((file) => `${origin}/${file.replace(/\.html$/, '')}`)
    const listed = listedAddresses(await readText(root, 'llms.txt'))
    expect(listed.toSorted()).toEqual(served.toSorted())
  })

  test('every page it lists has a Markdown twin at the same address plus .md', async () => {
    const root = outputRoot(output)
    const files = new Set(await listFiles(root))
    for (const address of listedAddresses(await readText(root, 'llms.txt'))) {
      expect(files.has(`${address.slice(origin.length + 1)}.md`), address).toBe(true)
    }
  })
})

describe.each(['production', 'fixture-production'] as const)(
  'llms.txt drafts, build %s',
  (output) => {
    test('a draft is listed nowhere and has no twin', async () => {
      const root = outputRoot(output)
      expect(await readText(root, 'llms.txt')).not.toContain('draft-')
      expect(await listFiles(root)).not.toContain('guides/draft-guide.md')
    })
  },
)
