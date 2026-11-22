import { expect, test } from 'bun:test'
import config from '../astro.config.ts'
import { outputRoot, readText, realOutputs } from './output.ts'

test('compressHTML is true, not the Astro 7 default jsx', () => {
  expect(config.compressHTML).toBe(true)
})

// Astro 7's default (jsx) removes the white space between text and an inline element: "a<b>b</b>". Any white space
// character keeps the words apart in a browser, so the test asks for one.
test.each(realOutputs)(
  'white space between text and an inline element survives, build %s',
  async (output) => {
    const guide = await readText(outputRoot(output), 'guide.html')
    expect(guide).toMatch(
      /methodologies like\s<strong>Scrum, Kanban, and Jira<\/strong>\semphasize/,
    )
    expect(guide).toMatch(/combines\s<strong>team collaboration, game mechanics<\/strong>, and the/)
    expect(guide).toMatch(/promotes a\s<strong>diversity of viewpoints<\/strong>\.\sThe/)
  },
)
