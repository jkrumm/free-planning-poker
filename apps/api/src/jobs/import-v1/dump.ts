/**
 * A streaming reader of a `mariadb-dump` file, the form in which v1's database leaves production (docs/v9/ARCHITECTURE.md,
 * Cutover, step 2). It splits the stream into statements, reads each `CREATE TABLE` for its column order and each
 * `INSERT` of a table it was asked for into rows of values, in the column order the caller asked for. A table it was not
 * asked for is skipped unread (v1's `fpp_users` holds devices and places, and never leaves this file as a value).
 *
 * It refuses a dump not written in UTC: `mariadb-dump` writes `SET TIME_ZONE='+00:00'` and every TIMESTAMP in UTC
 * unless it was told `--skip-tz-utc`.
 */

/** A value as the dump holds it: a string, unescaped, or a number's digits, or null for NULL. */
export type DumpValue = string | null

export type TableReader = {
  /** The columns the caller reads, by name; each row's values come in this order. */
  readonly columns: readonly string[]
  readonly row: (values: readonly DumpValue[]) => void
}

export type DumpSummary = {
  /** Rows read per table asked for. */
  readonly rows: Readonly<Record<string, number>>
}

const UTC_MARKER = "SET TIME_ZONE='+00:00'"
/** A block comment longer than this is never the time-zone line, so its text is not kept. */
const MARKER_SCAN = 200

const enum Mode {
  Code,
  Single,
  Double,
  Backtick,
  Line,
  Block,
}

/** Reads a dump from `stream` (UTF-8 text) and hands each row of the tables in `tables` to its reader. */
export async function readDump(
  stream: ReadableStream<Uint8Array>,
  tables: Readonly<Record<string, TableReader>>,
): Promise<DumpSummary> {
  const rows: Record<string, number> = {}
  const order = new Map<string, readonly number[]>()
  let utc = false

  const statement = (text: string) => {
    const created = /^CREATE TABLE `([^`]+)`\s*\(([\s\S]*)\)[^)]*$/.exec(text)
    if (created !== null) {
      const name = created[1] ?? ''
      const reader = tables[name]
      if (reader === undefined) return
      const columns = [...(created[2] ?? '').matchAll(/^\s*`([^`]+)`\s/gm)].map((m) => m[1] ?? '')
      order.set(name, positions(name, columns, reader.columns))
      return
    }
    const inserted = /^INSERT INTO `([^`]+)`\s*(\(([^)]*)\))?\s*VALUES\s*/.exec(text)
    if (inserted === null) return
    const name = inserted[1] ?? ''
    const reader = tables[name]
    if (reader === undefined) return
    if (!utc) throw new Error(`the dump is not in UTC: no ${UTC_MARKER} before its data`)
    const listed = inserted[3]
    const index =
      listed === undefined
        ? order.get(name)
        : positions(
            name,
            [...listed.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? ''),
            reader.columns,
          )
    if (index === undefined) throw new Error(`${name}: rows before its CREATE TABLE`)
    rows[name] = (rows[name] ?? 0) + readTuples(text, inserted[0].length, index, reader.row)
  }

  // The statement splitter: one pass over the characters, carrying its state across chunks.
  let mode: Mode = Mode.Code
  let pieces: string[] = []
  let started = false
  let comment = ''
  let carry = ''
  const decoder = new TextDecoder('utf-8', { fatal: true })

  const scan = (chunk: string, final: boolean) => {
    const text = carry + chunk
    carry = ''
    // Inside a statement the chunk continues it; inside a comment it does not.
    let from = started && mode !== Mode.Line && mode !== Mode.Block ? 0 : -1
    const end = text.length
    for (let i = 0; i < end; i += 1) {
      const c = text.charCodeAt(i)
      switch (mode) {
        case Mode.Code: {
          // Lookahead of one character; at the end of a chunk the character waits for the next one.
          const needsNext = c === 0x2d || c === 0x2f
          if (needsNext && i + 1 >= end && !final) {
            if (from >= 0) pieces.push(text.slice(from, i))
            carry = text.slice(i)
            return
          }
          const next = text.charCodeAt(i + 1)
          if (c === 0x2d && next === 0x2d) {
            if (from >= 0) pieces.push(text.slice(from, i))
            from = -1
            mode = Mode.Line
            i += 1
          } else if (c === 0x23) {
            if (from >= 0) pieces.push(text.slice(from, i))
            from = -1
            mode = Mode.Line
          } else if (c === 0x2f && next === 0x2a) {
            if (from >= 0) pieces.push(text.slice(from, i))
            from = -1
            mode = Mode.Block
            comment = ''
            i += 1
          } else if (c === 0x3b) {
            if (from >= 0) pieces.push(text.slice(from, i))
            if (started) statement(pieces.join('').trim())
            pieces = []
            started = false
            from = -1
          } else {
            if (!started && c > 0x20) started = true
            if (started && from < 0) from = i
            if (c === 0x27) mode = Mode.Single
            else if (c === 0x22) mode = Mode.Double
            else if (c === 0x60) mode = Mode.Backtick
          }
          break
        }
        case Mode.Single:
        case Mode.Double:
          if (c === 0x5c) {
            if (i + 1 >= end && !final) {
              pieces.push(text.slice(from, i))
              carry = text.slice(i)
              return
            }
            i += 1
          } else if ((mode === Mode.Single && c === 0x27) || (mode === Mode.Double && c === 0x22)) {
            mode = Mode.Code
          }
          break
        case Mode.Backtick:
          if (c === 0x60) mode = Mode.Code
          break
        case Mode.Line:
          if (c === 0x0a) {
            mode = Mode.Code
            if (started) from = i
          }
          break
        case Mode.Block:
          if (c === 0x2a && i + 1 >= end && !final) {
            carry = text.slice(i)
            return
          }
          if (c === 0x2a && text.charCodeAt(i + 1) === 0x2f) {
            if (comment.includes(UTC_MARKER)) utc = true
            mode = Mode.Code
            i += 1
            if (started) from = i + 1
          } else if (comment.length < MARKER_SCAN) {
            comment += text[i]
          }
          break
      }
    }
    if (from >= 0 && from < end) pieces.push(text.slice(from, end))
  }

  for await (const bytes of stream) scan(decoder.decode(bytes, { stream: true }), false)
  scan(decoder.decode(), true)
  if (pieces.join('').trim() !== '') throw new Error('the dump ends inside a statement')
  for (const name of Object.keys(tables))
    if (!order.has(name)) throw new Error(`the dump has no table ${name}`)
  return { rows }
}

/** Where each wanted column stands among the dump's columns. */
function positions(table: string, have: readonly string[], want: readonly string[]): number[] {
  return want.map((column) => {
    const at = have.indexOf(column)
    if (at < 0) throw new Error(`${table} has no column ${column}`)
    return at
  })
}

const ESCAPES: Readonly<Record<string, string>> = {
  '0': '\0',
  b: '\b',
  n: '\n',
  r: '\r',
  t: '\t',
  Z: '\x1a',
}

/** Reads `(..),(..)` from `start` to the end of the statement; returns the number of rows. */
function readTuples(
  text: string,
  start: number,
  index: readonly number[],
  row: (values: readonly DumpValue[]) => void,
): number {
  let i = start
  let count = 0
  const skipSpace = () => {
    while (i < text.length && text.charCodeAt(i) <= 0x20) i += 1
  }
  const fail = (what: string): never => {
    throw new Error(`unreadable INSERT at offset ${i}: ${what}`)
  }
  while (true) {
    skipSpace()
    if (text[i] !== '(') fail('expected (')
    i += 1
    const values: DumpValue[] = []
    while (true) {
      skipSpace()
      values.push(readValue())
      skipSpace()
      const c = text[i]
      i += 1
      if (c === ')') break
      if (c !== ',') fail('expected , or )')
    }
    row(index.map((at) => values[at] ?? null))
    count += 1
    skipSpace()
    if (i >= text.length) return count
    if (text[i] !== ',') fail('expected , between rows')
    i += 1
  }

  function readValue(): DumpValue {
    if (text[i] === "'") return readString()
    const from = i
    while (i < text.length && text[i] !== ',' && text[i] !== ')') i += 1
    const token = text.slice(from, i).trim()
    if (token === 'NULL') return null
    if (/^_[a-z0-9]+\s*'/i.test(token)) {
      i = from + token.indexOf("'")
      return readString()
    }
    if (!/^-?[0-9.eE+-]+$/.test(token)) fail(`a value that is no number: ${token.slice(0, 20)}`)
    return token
  }

  function readString(): string {
    i += 1
    let out = ''
    let from = i
    while (i < text.length) {
      const c = text[i]
      if (c === '\\') {
        out += text.slice(from, i)
        const e = text[i + 1] ?? ''
        out += ESCAPES[e] ?? e
        i += 2
        from = i
      } else if (c === "'") {
        if (text[i + 1] === "'") {
          out += text.slice(from, i + 1)
          i += 2
          from = i
        } else {
          out += text.slice(from, i)
          i += 1
          return out
        }
      } else {
        i += 1
      }
    }
    return fail('a string that does not end')
  }
}

/** A dump file as a byte stream; a name ending in `.gz` is gunzipped on the way. */
export function dumpStream(file: {
  readonly name: string
  readonly stream: () => ReadableStream<Uint8Array>
}) {
  const bytes = file.stream()
  return file.name.endsWith('.gz')
    ? bytes.pipeThrough(
        new DecompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>,
      )
    : bytes
}

/** A TIMESTAMP of a UTC dump (`YYYY-MM-DD HH:MM:SS`) as an instant. */
export function utcTimestamp(value: DumpValue): Date {
  const match =
    value === null ? null : /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(value)
  if (match === null) throw new Error(`not a timestamp: ${String(value)}`)
  const [, y, mo, d, h, mi, s] = match.map(Number)
  return new Date(Date.UTC(y ?? 0, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0, s ?? 0))
}
