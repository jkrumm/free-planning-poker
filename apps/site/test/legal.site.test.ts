import { describe, expect, test } from 'bun:test'
import { privacyFacts } from '../src/lib/privacy-facts.ts'
import { v1ImprintSections } from './fixtures/v1-imprint.ts'
import {
  fieldOf,
  listFiles,
  outputRoot,
  readText,
  realOutputs,
  sectionsOf,
  textOf,
} from './output.ts'
import { executableIn } from './scripts.ts'

describe.each(realOutputs)('legal pages, build %s', (output) => {
  const root = outputRoot(output)

  test("/imprint holds v1's sections word for word, and one sentence that links /privacy", async () => {
    const sections = new Map(sectionsOf(await readText(root, 'imprint.html')))
    for (const { heading, text } of v1ImprintSections) expect(sections.get(heading)).toBe(text)
    expect([...sections.keys()]).toEqual([
      'Operated by',
      'Contact',
      'Privacy',
      'Project License',
      'Donations',
    ])
    expect(sections.get('Privacy')).toBe(
      'What Free Planning Poker stores and measures, and for how long, is described on the privacy page.',
    )
  })

  test('/imprint publishes no e-mail address', async () => {
    const html = await readText(root, 'imprint.html')
    expect(html).not.toMatch(/mailto:/i)
    expect(textOf(html)).not.toMatch(/[^\s@]+@[^\s@]+\.[a-z]{2,}/i)
    expect(html).toContain('<a href="/privacy">privacy page</a>')
  })

  test('/privacy states every figure of its facts, and the ruling', async () => {
    const html = await readText(root, 'privacy.html')
    const text = textOf(html)
    for (const fact of Object.values(privacyFacts)) expect(text).toContain(fact.words)
    for (const part of ['/api/u', '/room/:slug', 'fpp:v9:', 'No cookie'])
      expect(text).toContain(part)
    expect(text).toContain('Why there is no banner.')
    expect(html).toContain('href="/imprint"')
    expect(html).toContain('href="/contact"')
  })

  test("the contact form's fields carry v1's limits as HTML attributes", async () => {
    const html = await readText(root, 'contact.html')
    expect(/<form\b[^>]*>/.exec(html)?.[0]).toMatch(/method="post"[^>]*action="\/api\/contact"/)
    expect(fieldOf(html, 'name')).toMatchObject({ type: 'text', maxlength: '50' })
    expect(fieldOf(html, 'name')).not.toHaveProperty('required')
    expect(fieldOf(html, 'email')).toMatchObject({ type: 'email', maxlength: '70' })
    expect(fieldOf(html, 'email')).toHaveProperty('required')
    expect(fieldOf(html, 'subject')).toMatchObject({
      type: 'text',
      minlength: '3',
      maxlength: '100',
    })
    expect(fieldOf(html, 'subject')).toHaveProperty('required')
    expect(fieldOf(html, 'message')).toMatchObject({ maxlength: '800' })
    expect(fieldOf(html, 'message')).not.toHaveProperty('required')
  })

  test('the footer of every page links /privacy, /imprint and /contact', async () => {
    const pages = (await listFiles(root)).filter((file) => file.endsWith('.html'))
    expect(pages.length).toBeGreaterThan(0)
    const missing: string[] = []
    for (const page of pages) {
      const footer = /<footer[\s\S]*<\/footer>/.exec(await readText(root, page))?.[0] ?? ''
      for (const href of ['/privacy', '/imprint', '/contact']) {
        if (!footer.includes(`href="${href}"`)) missing.push(`${page}: ${href}`)
      }
    }
    expect(missing).toEqual([])
  })

  // JSON-LD blocks are data, not scripts (scripts.ts), so a page with structured data still has none.
  test('only the contact page carries an executable script', async () => {
    const withScript: string[] = []
    for (const page of (await listFiles(root)).filter((file) => file.endsWith('.html'))) {
      if (executableIn(page, await readText(root, page)).length > 0) withScript.push(page)
    }
    expect(withScript).toEqual(['contact.html'])
  })
})
