import { describe, expect, test } from 'bun:test'
import { gzipSync } from 'bun'
import { allOutputs, listFiles, outputRoot, readText } from './output.ts'

// docs/v9/ENGINEERING.md, Budgets: a site page is at most 12 kB gzip outside islands.
const pageBudgetBytes = 12 * 1024

describe.each(allOutputs)('page budget, build %s', (output) => {
  test('every page is at most 12 kB gzip', async () => {
    const root = outputRoot(output)
    const over: string[] = []
    for (const rel of await listFiles(root)) {
      if (!rel.endsWith('.html')) continue
      const size = gzipSync(await readText(root, rel)).length
      if (size > pageBudgetBytes) over.push(`${rel}: ${size} bytes`)
    }
    expect(over).toEqual([])
  })
})
