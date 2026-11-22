import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { guideClusters } from '../src/lib/entry-schema.ts'
import {
  canonicalOf,
  idsOf,
  listFiles,
  metaOf,
  outputRoot,
  readText,
  realOutputs,
  textOf,
} from './output.ts'

const siteRoot = join(import.meta.dir, '..')
const v1Sources = join(import.meta.dir, 'fixtures', 'v1-guide')
const clusterFile = (id: string) => join(siteRoot, 'src', 'content', 'guides', `${id}.md`)
const pillarFile = join(siteRoot, 'src', 'content', 'pillar', 'guide.md')

/** Every id attribute v1's page and the components it renders write: id="x", id='x' or id={'x'}. */
function v1Ids(): string[] {
  const ids = new Set<string>()
  for (const name of readdirSync(v1Sources).filter((file) => file.endsWith('.txt'))) {
    const source = readFileSync(join(v1Sources, name), 'utf8')
    for (const match of source.matchAll(/\bid=(?:"([^"]+)"|'([^']+)'|\{['"`]([^'"`]+)['"`]\})/g))
      ids.add(match[1] ?? match[2] ?? match[3] ?? '')
  }
  return [...ids]
}

const unquote = (value: string) => value.replace(/^"(.*)"$/, '$1').replaceAll('\\"', '"')

/** The questions and answers of an entry's frontmatter, as the two-line YAML the content files use. */
function questionsOf(file: string): { question: string; answer: string }[] {
  const text = readFileSync(file, 'utf8')
  return [...text.matchAll(/^ {2}- question: (.*)\n {4}answer: (.*)$/gm)].map((match) => ({
    question: unquote(match[1] ?? ''),
    answer: unquote(match[2] ?? ''),
  }))
}

/** The hrefs of a page that leave the site. */
const externalLinks = (html: string) => [
  ...new Set([...html.matchAll(/\shref="(https?:\/\/[^"]+)"/g)].map((match) => match[1] ?? '')),
]

describe.each(realOutputs)('the pillar guide, build %s', (output) => {
  test("keeps every id v1's page and its components render as an anchor", async () => {
    const ids = v1Ids()
    expect(ids).toContain('master-the-art-of-planning-poker')
    const html = await readText(outputRoot(output), 'guide.html')
    for (const id of ids) expect(idsOf(html).has(id), id).toBe(true)
  })

  test("keeps v1's Fibonacci table as a table", async () => {
    const html = await readText(outputRoot(output), 'guide.html')
    expect(html).toContain('<th>Story Points</th>')
    expect(html.match(/<tr>/g)?.length).toBe(7)
  })

  test('prints its questions as visible text', async () => {
    const html = await readText(outputRoot(output), 'guide.html')
    const text = textOf(html)
    const questions = questionsOf(pillarFile)
    expect(questions.length).toBeGreaterThanOrEqual(3)
    expect(questions.length).toBeLessThanOrEqual(6)
    for (const { question, answer } of questions) {
      expect(text).toContain(question)
      expect(text).toContain(answer)
    }
  })

  test('has no external link that is not https', async () => {
    const html = await readText(outputRoot(output), 'guide.html')
    expect(html).not.toMatch(/\shref="http:\/\//)
  })
})

describe('the cluster guides', () => {
  const production = outputRoot('production')
  const beta = outputRoot('beta')

  test('are built on beta, each with its Markdown twin, and only as drafts', async () => {
    const files = await listFiles(beta)
    for (const id of guideClusters) {
      expect(files).toContain(`guides/${id}.html`)
      expect(files).toContain(`guides/${id}.md`)
      const html = await readText(beta, `guides/${id}.html`)
      expect(metaOf(html, 'robots')).toBe('noindex, nofollow')
      expect(html).toContain('Draft: this page is not published yet.')
      expect(canonicalOf(html)).toBe(`https://free-planning-poker.com/guides/${id}`)
      expect(readFileSync(clusterFile(id), 'utf8')).toMatch(/^draft: true$/m)
    }
  })

  test('are absent from the production output, and no production page links to them', async () => {
    const files = await listFiles(production)
    for (const id of guideClusters) {
      expect(files).not.toContain(`guides/${id}.html`)
      expect(files).not.toContain(`guides/${id}.md`)
    }
    expect(files.filter((file) => file.startsWith('guides'))).toEqual([])
    for (const rel of files) {
      const text = await readText(production, rel)
      expect(text, rel).not.toContain('/guides')
      // 'decks' is a word of the pillar's text, so only a slug that is not one is searched for.
      for (const id of guideClusters.filter((slug) => slug.includes('-')))
        expect(text, rel).not.toContain(id)
    }
  })

  test('are linked from the pillar on beta, through the helper', async () => {
    const html = await readText(beta, 'guide.html')
    for (const id of guideClusters) expect(html).toContain(`href="/guides/${id}"`)
  })

  test.each(guideClusters)(
    '%s answers one question first, links the pillar and its siblings, and is dated',
    async (id) => {
      const html = await readText(beta, `guides/${id}.html`)
      const source = readFileSync(clusterFile(id), 'utf8')
      expect(source).toMatch(/^published: 2026-11-22$/m)
      expect(source).toMatch(/^updated: 2026-11-22$/m)
      expect(html).toContain('<time datetime="2026-11-22')
      expect(html).toContain('href="/guide"')
      for (const sibling of guideClusters.filter((other) => other !== id))
        expect(html).toContain(`href="/guides/${sibling}"`)
      expect(html).not.toContain(`href="/guides/${id}"`)
      const title = /^title: (.*)$/m.exec(source)?.[1] ?? ''
      expect(title.endsWith('?')).toBe(true)
      const firstParagraph =
        /<h1[^>]*>[^<]*<\/h1>[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*?<p>([\s\S]*?)<\/p>/.exec(html)
      // The first paragraph of the body after the date line states the question the page answers.
      expect(firstParagraph?.[2]).toBeDefined()
      expect(textOf(firstParagraph?.[2] ?? '')).toContain('?')
    },
  )

  test.each(guideClusters)('%s prints three to six questions as visible text', async (id) => {
    const text = textOf(await readText(beta, `guides/${id}.html`))
    const questions = questionsOf(clusterFile(id))
    expect(questions.length).toBeGreaterThanOrEqual(3)
    expect(questions.length).toBeLessThanOrEqual(6)
    for (const { question, answer } of questions) {
      expect(text).toContain(question)
      expect(text).toContain(answer)
    }
  })

  test.each(guideClusters)('%s dates its sources and links each over https', async (id) => {
    const html = await readText(beta, `guides/${id}.html`)
    expect(textOf(html)).toContain('Read on 2026-11-22.')
    expect(externalLinks(html).length).toBeGreaterThanOrEqual(2)
    expect(html).not.toMatch(/\shref="http:\/\//)
  })
})
