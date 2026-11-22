import { expect, test } from 'bun:test'
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  checkMessages,
  literalAttributes,
  parsePo,
  untranslated,
  withoutStamp,
} from './messages.ts'

const PO = `msgid ""
msgstr ""
"POT-Creation-Date: 2026-11-22 17:31+0100\\n"
"Language: de\\n"

#: ../../apps/room/src/a.tsx
msgid "Reveal cards"
msgstr "Karten aufdecken"

msgid "Long "
"message"
msgstr ""
`

test('a PO file reads as its messages, the header left out and continuation lines joined', () => {
  expect(parsePo(PO)).toEqual([
    { id: 'Reveal cards', text: 'Karten aufdecken' },
    { id: 'Long message', text: '' },
  ])
  expect(untranslated(PO)).toEqual(['Long message'])
})

test('the creation stamp does not make two extractions differ', () => {
  expect(withoutStamp(PO)).not.toContain('POT-Creation-Date')
})

test('a literal in a visible attribute is found, an id or a message is not', () => {
  expect(literalAttributes('<input aria-label="Your name" placeholder=\'Name\' />')).toHaveLength(2)
  expect(literalAttributes('<p title="Hello" alt="x1">')).toHaveLength(2)
  expect(
    literalAttributes('<input aria-label={t`Your name`} data-testid="name" type="text" />'),
  ).toEqual([])
  expect(literalAttributes('<div title="" aria-label="123" />')).toEqual([])
})

/** A copy of the package and one source file, with the real node_modules linked in: a tree to plant faults in. */
function plant(edit: (tree: { readonly source: string; readonly de: string }) => void) {
  const root = mkdtempSync(join(tmpdir(), 'fpp-messages-'))
  const here = join(import.meta.dirname, '..')
  const packageDir = join(root, 'packages/i18n')
  cpSync(here, packageDir, {
    recursive: true,
    filter: (path) => !path.includes('node_modules'),
  })
  symlinkSync(join(here, 'node_modules'), join(packageDir, 'node_modules'))
  const sourceDir = join(root, 'apps/room/src')
  const real = join(here, '../../apps/room/src')
  cpSync(real, sourceDir, { recursive: true })
  edit({
    source: join(sourceDir, 'features/lobby/lobby-page.tsx'),
    de: join(packageDir, 'locales/lobby/de.po'),
  })
  try {
    return checkMessages({ packageDir, sourceDir })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('the catalogue of the repository is true', () => {
  const root = join(import.meta.dirname, '../../..')
  const before = readFileSync(join(root, 'packages/i18n/locales/lobby/de.po'), 'utf8')
  expect(
    checkMessages({
      packageDir: join(root, 'packages/i18n'),
      sourceDir: join(root, 'apps/room/src'),
    }),
  ).toEqual([])
  // The check reads: it leaves the files as they were.
  expect(readFileSync(join(root, 'packages/i18n/locales/lobby/de.po'), 'utf8')).toBe(before)
})

test('a message used in code and missing in the catalogue fails', () => {
  const problems = plant(({ source }) => {
    const code = readFileSync(source, 'utf8')
    writeFileSync(source, code.replace('{t`Start planning`}', '{t`Start planning now`}'))
  })
  expect(problems.some((problem) => problem.includes('out of date'))).toBe(true)
})

test('a key missing in German fails, a key missing in Spanish does not', () => {
  const missingDe = plant(({ de }) => {
    const po = readFileSync(de, 'utf8')
    writeFileSync(de, po.replace(/(msgid "Start planning"\n)msgstr "[^"]*"/, '$1msgstr ""'))
  })
  expect(missingDe).toContain('lobby/de.po: no de translation for "Start planning"')
  const missingEs = plant(({ de }) => {
    const es = de.replace('de.po', 'es.po')
    const po = readFileSync(es, 'utf8')
    writeFileSync(es, po.replace(/(msgid "Start planning"\n)msgstr "[^"]*"/, '$1msgstr ""'))
  })
  expect(missingEs).toEqual([])
})

test('a literal text in a visible attribute fails', () => {
  const problems = plant(({ source }) => {
    const code = readFileSync(source, 'utf8')
    writeFileSync(source, code.replace('<main>', '<main aria-label="Lobby">'))
  })
  expect(problems.some((problem) => problem.includes('aria-label="Lobby"'))).toBe(true)
})
