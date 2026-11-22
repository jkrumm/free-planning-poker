import { describe, expect, test } from 'bun:test'
import { headProblems } from './head.ts'
import { allOutputs, listFiles, outputRoot, pngSize, readText } from './output.ts'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

describe.each(allOutputs)('the head of every page, build %s', (output) => {
  test('has a title, a description, a canonical link and a social image that exists', async () => {
    const root = outputRoot(output)
    const files = await listFiles(root)
    const known = new Set(files)
    const failed: string[] = []
    for (const rel of files.filter((file) => file.endsWith('.html'))) {
      const html = await readText(root, rel)
      for (const problem of headProblems(html, (path) => known.has(path.slice(1))))
        failed.push(`${rel}: ${problem}`)
    }
    expect(failed).toEqual([])
  })

  test('every social image is a PNG of 1200 by 630 pixels', async () => {
    const root = outputRoot(output)
    const images = (await listFiles(root)).filter((file) => file.startsWith('og/'))
    expect(images.length).toBeGreaterThan(0)
    for (const rel of images) {
      expect({ rel, size: pngSize(await readFile(join(root, rel))) }).toEqual({
        rel,
        size: { width: 1200, height: 630 },
      })
    }
  })

  test('every page has an image and no image is left over', async () => {
    const root = outputRoot(output)
    const files = await listFiles(root)
    const named = new Set<string>()
    for (const rel of files.filter((file) => file.endsWith('.html'))) {
      const image = /<meta property="og:image" content="[^"]*?(\/og\/[^"]*)"/.exec(
        await readText(root, rel),
      )?.[1]
      if (image !== undefined) named.add(image.slice(1))
    }
    expect(files.filter((file) => file.startsWith('og/')).toSorted()).toEqual([...named].toSorted())
  })
})
