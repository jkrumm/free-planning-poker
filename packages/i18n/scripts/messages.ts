/**
 * The message check (rule strings.md): the catalogues match the code, English and German are complete, and no visible
 * attribute carries a literal. Literal text between JSX tags is oxlint's `react/jsx-no-literals`.
 *
 * - Extraction runs into the working tree, its result is compared with what was there, and the files are put back:
 *   a catalogue that extraction would change is out of date (a message added or removed without `bun run i18n`).
 * - A language marked `complete` in `LANGUAGES` has a translation for every message of every catalogue file.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { LANGUAGES } from '../src/languages.ts'

export type PoEntry = { readonly id: string; readonly text: string }

const unquote = (line: string) => line.slice(line.indexOf('"') + 1, line.lastIndexOf('"'))

/** The messages of a PO file: msgid and msgstr, with their continuation lines joined; the header is left out. */
export function parsePo(content: string): PoEntry[] {
  const entries: { id: string; text: string }[] = []
  let current: { id: string; text: string } | undefined
  let field: 'id' | 'text' | undefined
  for (const line of content.split('\n')) {
    if (line.startsWith('msgid ')) {
      current = { id: unquote(line), text: '' }
      entries.push(current)
      field = 'id'
    } else if (line.startsWith('msgstr ')) {
      if (current !== undefined) current.text = unquote(line)
      field = 'text'
    } else if (line.startsWith('"') && current !== undefined && field !== undefined) {
      current[field] += unquote(line)
    } else if (line.trim() === '') {
      field = undefined
    }
  }
  return entries.filter((entry) => entry.id !== '')
}

/** The messages a language has no translation for. */
export const untranslated = (content: string): string[] =>
  parsePo(content)
    .filter((entry) => entry.text.trim() === '')
    .map((entry) => entry.id)

/** The same file with the volatile header line left out, so two extractions compare equal. */
export const withoutStamp = (content: string): string =>
  content.replace(/^"POT-Creation-Date:.*\n/m, '')

const VISIBLE_ATTRIBUTE =
  /\b(aria-label|aria-description|aria-placeholder|aria-roledescription|placeholder|title|alt)=(?:"[^"]*[\p{L}][^"]*"|'[^']*[\p{L}][^']*')/gu

/** The visible attributes of a JSX file that carry text in the source instead of a message. */
export const literalAttributes = (source: string): string[] =>
  [...source.matchAll(VISIBLE_ATTRIBUTE)].map((match) => match[0])

const filesUnder = (dir: string, accept: (name: string) => boolean): string[] =>
  readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && accept(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))

export type MessageCheck = {
  /** The package directory: `lingui.config.ts`, `locales`. */
  readonly packageDir: string
  /** The sources whose JSX is scanned. */
  readonly sourceDir: string
}

/** Every problem found, each a line; empty when the catalogue is true. */
export function checkMessages(check: MessageCheck): string[] {
  const problems: string[] = []
  const locales = join(check.packageDir, 'locales')
  const files = filesUnder(locales, (name) => name.endsWith('.po')).toSorted()
  const before = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]))

  const extract = spawnSync(
    join(check.packageDir, 'node_modules/.bin/lingui'),
    ['extract', '--clean'],
    {
      cwd: check.packageDir,
      encoding: 'utf8',
    },
  )
  if (extract.status !== 0) {
    for (const [file, content] of before) writeFileSync(file, content)
    return [`lingui extract failed: ${extract.stderr || extract.stdout}`]
  }
  const after = new Map(
    filesUnder(locales, (name) => name.endsWith('.po')).map((file) => [
      file,
      readFileSync(file, 'utf8'),
    ]),
  )
  // Put the tree back as it was: this check reads, it does not write.
  for (const file of new Set([...before.keys(), ...after.keys()])) {
    const content = before.get(file)
    if (content !== undefined) writeFileSync(file, content)
  }
  for (const file of new Set([...before.keys(), ...after.keys()])) {
    const was = before.get(file)
    const now = after.get(file)
    if (was === undefined || now === undefined || withoutStamp(was) !== withoutStamp(now))
      problems.push(
        `${relative(locales, file)} is out of date: run \`bun run i18n\` and commit the catalogues`,
      )
  }

  for (const language of LANGUAGES.filter((candidate) => candidate.complete)) {
    for (const file of files.filter((name) => name.endsWith(`/${language.code}.po`))) {
      for (const id of untranslated(before.get(file) ?? ''))
        problems.push(`${relative(locales, file)}: no ${language.code} translation for "${id}"`)
    }
  }

  for (const file of filesUnder(check.sourceDir, (name) => name.endsWith('.tsx'))) {
    for (const found of literalAttributes(readFileSync(file, 'utf8')))
      problems.push(`${relative(check.sourceDir, file)}: literal text in ${found}: use a message`)
  }
  return problems
}

if (import.meta.main) {
  const packageDir = join(import.meta.dirname, '..')
  const problems = checkMessages({ packageDir, sourceDir: join(packageDir, '../../apps/room/src') })
  for (const problem of problems) console.error(problem)
  if (problems.length > 0) process.exit(1)
}
