import { BEFORE_SEND_GLOBAL, type SendPayload } from '@fpp/telemetry/umami-script'
import { describe, expect, test } from 'bun:test'
import { listFiles, outputRoot, readText, realOutputs } from './output.ts'

const ID = '123e4567-e89b-42d3-a456-426614174000'

describe.each(['fixture-production', 'fixture-beta'] as const)(
  'Umami on every page, build %s',
  (output) => {
    const root = outputRoot(output)

    test('every page carries the hook and then the deferred tracker from our own origin', async () => {
      const pages = (await listFiles(root)).filter((file) => file.endsWith('.html'))
      expect(pages.length).toBeGreaterThan(5)
      const wrong: string[] = []
      for (const page of pages) {
        const html = await readText(root, page)
        const hook = html.indexOf(`<script>window.${BEFORE_SEND_GLOBAL}=`)
        const tracker = html.indexOf('<script defer src="/api/u/p.js"')
        if (
          hook === -1 ||
          tracker === -1 ||
          hook > tracker ||
          html.split('/api/u/p.js').length !== 2
        )
          wrong.push(page)
      }
      expect(wrong).toEqual([])
    })

    test('the tracker is told the website, the host, no query, no fragment, and the hook', async () => {
      const html = await readText(root, 'index.html')
      expect(html).toContain(
        `<script defer src="/api/u/p.js" data-website-id="${ID}" data-domains="next.example.com" data-exclude-search="true" data-exclude-hash="true" data-before-send="${BEFORE_SEND_GLOBAL}"></script>`,
      )
    })

    test('the hook, as the page carries it, rewrites a room address', async () => {
      const html = await readText(root, 'index.html')
      const script = /<script>(window\.fppBeforeSend=[\s\S]*?)<\/script>/.exec(html)?.[1]
      expect(script).toBeDefined()
      const host: Record<string, unknown> = {}
      new Function('window', script ?? '')(host)
      const hook = host[BEFORE_SEND_GLOBAL] as (type: string, payload: SendPayload) => SendPayload
      expect(hook('event', { url: '/room/team-alpha#code' }).url).toBe('/room/:slug')
      expect(hook('event', { url: '/room/123456?x=1' }).url).toBe('/room/:slug')
    })
  },
)

describe.each(realOutputs)('no website id, no tag, build %s', (output) => {
  test('the build without the variable has no tracker and no hook', async () => {
    const root = outputRoot(output)
    for (const page of (await listFiles(root)).filter((file) => file.endsWith('.html'))) {
      const html = await readText(root, page)
      expect(html).not.toContain('/api/u/p.js')
      expect(html).not.toContain(BEFORE_SEND_GLOBAL)
    }
  })
})
