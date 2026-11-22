import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { commandsOf, selfHostingPage } from './page-commands.ts'

const source = [
  '<pre data-commands="one"><code>echo "a" &amp;&amp; echo b &gt; c',
  'echo d</code></pre>',
  '<pre data-commands="two"><code>true</code></pre>',
].join('\n')

describe('commandsOf', () => {
  test('returns one block as the shell reads it', () => {
    expect(commandsOf(source, 'one')).toBe('echo "a" && echo b > c\necho d\n')
    expect(commandsOf(source, 'two')).toBe('true\n')
  })

  test('names the blocks there are when one is missing', () => {
    expect(() => commandsOf(source, 'three')).toThrow('blocks: one, two')
  })

  test('the self-hosting page holds the blocks the workflow runs, each once', () => {
    const page = readFileSync(selfHostingPage, 'utf8')
    for (const name of ['start', 'backup', 'restore', 'update'])
      expect(commandsOf(page, name).length).toBeGreaterThan(0)
  })
})
