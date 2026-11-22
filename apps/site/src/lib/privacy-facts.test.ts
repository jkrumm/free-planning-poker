import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { privacyFacts, type PrivacyFact } from './privacy-facts.ts'

const root = join(import.meta.dir, '..', '..', '..', '..')
const read = (file: string) => readFileSync(join(root, file), 'utf8')
const facts = Object.entries(privacyFacts) as [string, PrivacyFact][]

/** The right-hand side of `export const NAME = ...`, without a trailing comment. */
function constantOf(source: string, name: string): string | undefined {
  return new RegExp(`^export const ${name} = (.+)$`, 'm')
    .exec(source)?.[1]
    ?.replace(/\s*\/\/.*$/, '')
    .trim()
}

test.each(facts.filter(([, fact]) => fact.constant !== undefined))(
  'the figure %s is the named constant',
  (_, fact) => {
    const value = constantOf(read(fact.file), fact.constant ?? '')
    expect(value === undefined ? undefined : value.replace(/^'|'$/g, '')).toBe(fact.literal)
  },
)

test('six hours are the snapshot constant in milliseconds', () => {
  const product = (constantOf(read(privacyFacts.snapshotTtl.file), 'SNAPSHOT_TTL_MS') ?? '')
    .split('*')
    .map(Number)
    .reduce((a, b) => a * b, 1)
  expect(product).toBe(6 * 60 * 60 * 1000)
})

test.each(facts.filter(([, fact]) => fact.quote !== undefined))(
  'the figure %s is stated by its document',
  (_, fact) => {
    expect(read(fact.file)).toContain(fact.quote ?? '')
  },
)
