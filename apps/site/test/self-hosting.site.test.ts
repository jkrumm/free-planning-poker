import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { commandsOf, selfHostingPage } from '../scripts/page-commands.ts'
import { outputRoot, readText, realOutputs, textOf } from './output.ts'

describe.each(realOutputs)('/self-hosting, build %s', (output) => {
  test('the page shows the commands the workflow runs, read from its source', async () => {
    const html = await readText(outputRoot(output), 'self-hosting.html')
    const source = readFileSync(selfHostingPage, 'utf8')
    for (const name of ['start', 'update', 'backup', 'restore']) {
      const shown = [...html.matchAll(/<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>/g)].map((match) =>
        textOf(match[1] ?? ''),
      )
      const wanted = textOf(commandsOf(source, name))
      expect(
        shown.map((block) => block.replace(/\s+/g, ' ')),
        name,
      ).toContain(wanted.replace(/\s+/g, ' '))
    }
  })
})
