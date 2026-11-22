/**
 * The protocol's three sources agree: the schemas, the fixtures under fixtures/v1 and docs/v9/protocol.md name the
 * same frames, commands, events and fx, and every fixture parses. Every command and event type carries its owner.
 */
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ClientFrameSchema,
  CmdFrameSchema,
  CommandSchema,
  EventSchema,
  EvtFrameSchema,
  FRAME_SCHEMAS,
  FxSchema,
  ServerCommandSchema,
  ServerFrameSchema,
} from '../src/protocol/schema.ts'
import {
  CLOSE_CODES,
  COMMAND_TYPES,
  EVENT_TYPES,
  FRAME_NAMES,
  FX_TYPES,
  NACK_REASONS,
  OWNERS,
  SERVER_COMMAND_TYPES,
} from '../src/protocol/names.ts'

const ROOT = join(import.meta.dir, '..')
const FIXTURES = join(ROOT, 'fixtures', 'v1')
const DOC = readFileSync(join(ROOT, '..', '..', 'docs', 'v9', 'protocol.md'), 'utf8')

const sorted = (names: Iterable<string>) => [...names].toSorted()

/** The `### \`name\`` headings under one `## ` section of protocol.md. */
function documented(section: string): string[] {
  const start = DOC.indexOf(`\n## ${section}\n`)
  if (start === -1) throw new Error(`protocol.md has no section ${section}`)
  const end = DOC.indexOf('\n## ', start + 1)
  const body = DOC.slice(start, end === -1 ? undefined : end)
  return [...body.matchAll(/^### `([^`]+)`$/gm)].map((match) => match[1]!)
}

/** The first backticked cell of each table row under one section. */
function tabled(section: string, column: number): string[] {
  const start = DOC.indexOf(`\n## ${section}\n`)
  const end = DOC.indexOf('\n## ', start + 1)
  const body = DOC.slice(start, end === -1 ? undefined : end)
  return body
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.startsWith('|-'))
    .map((line) => line.split('|')[column + 1]?.trim() ?? '')
    .filter((cell) => cell.startsWith('`'))
    .map((cell) => cell.replaceAll('`', ''))
}

const fixtures = (dir: string) =>
  readdirSync(join(FIXTURES, dir))
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))

const fixture = (dir: string, name: string): unknown =>
  JSON.parse(readFileSync(join(FIXTURES, dir, `${name}.json`), 'utf8'))

const typesOf = (schema: { options: readonly { shape: { type: { value: string } } }[] }) =>
  schema.options.map((option) => option.shape.type.value)

describe('protocol drift', () => {
  test('frames: schemas, protocol.md and fixtures name the same', () => {
    const fromSchema = sorted(Object.keys(FRAME_SCHEMAS))
    expect(fromSchema).toEqual(sorted(FRAME_NAMES))
    expect(sorted(documented('Frames'))).toEqual(fromSchema)
    expect(sorted(fixtures('frames'))).toEqual(fromSchema)
  })

  test('commands: schemas, protocol.md and fixtures name the same', () => {
    const fromSchema = sorted(typesOf(CommandSchema))
    expect(fromSchema).toEqual(sorted(COMMAND_TYPES))
    expect(sorted(documented('Commands'))).toEqual(fromSchema)
    expect(sorted(fixtures('commands'))).toEqual(fromSchema)
  })

  test('server commands: schemas, protocol.md and fixtures name the same', () => {
    const fromSchema = sorted(typesOf(ServerCommandSchema))
    expect(fromSchema).toEqual(sorted(SERVER_COMMAND_TYPES))
    expect(sorted(documented('Server commands'))).toEqual(fromSchema)
    expect(sorted(fixtures('server-commands'))).toEqual(fromSchema)
  })

  test('events: schemas, protocol.md and fixtures name the same', () => {
    const fromSchema = sorted(typesOf(EventSchema))
    expect(fromSchema).toEqual(sorted(EVENT_TYPES))
    expect(sorted(documented('Events'))).toEqual(fromSchema)
    expect(sorted(fixtures('events'))).toEqual(fromSchema)
  })

  test('fx: schemas and protocol.md name the same', () => {
    const fromSchema = sorted(typesOf(FxSchema))
    expect(fromSchema).toEqual(sorted(FX_TYPES))
    expect(sorted(documented('Fx'))).toEqual(fromSchema)
  })

  test('rejection reasons and close codes: names and protocol.md agree', () => {
    expect(sorted(tabled('Rejection reasons', 0))).toEqual(sorted(NACK_REASONS))
    expect(sorted(tabled('Close codes', 1))).toEqual(sorted(Object.keys(CLOSE_CODES)))
    for (const [name, code] of Object.entries(CLOSE_CODES))
      expect(DOC).toContain(`| ${code} | \`${name}\` |`)
  })
})

describe('owner prefixes', () => {
  const owned = new RegExp(`^(${OWNERS.join('|')})\\.[a-z][A-Za-z]*$`)
  const all = [
    ...typesOf(CommandSchema),
    ...typesOf(ServerCommandSchema),
    ...typesOf(EventSchema),
    ...typesOf(FxSchema),
    ...COMMAND_TYPES,
    ...SERVER_COMMAND_TYPES,
    ...EVENT_TYPES,
    ...FX_TYPES,
  ]

  test.each(all)('%s starts with poker., topic., seat. or room.', (type) => {
    expect(type).toMatch(owned)
  })

  test('the check refuses a type without an owner', () => {
    expect('vote').not.toMatch(owned)
    expect('chat.send').not.toMatch(owned)
    expect('pokerX.vote').not.toMatch(owned)
  })
})

describe('fixtures of protocol version 1', () => {
  test.each(fixtures('frames'))('frame %s parses, unchanged, and is that frame', (name) => {
    const raw = fixture('frames', name) as { frame: string }
    expect(raw.frame).toBe(name)
    const schema = FRAME_SCHEMAS[name as keyof typeof FRAME_SCHEMAS]
    expect(schema.parse(raw)).toEqual(raw as never)
    const direction = ['hello', 'cmd'].includes(name)
      ? ClientFrameSchema
      : ['welcome', 'ack', 'nack', 'evt'].includes(name)
        ? ServerFrameSchema
        : null
    if (direction !== null) expect(direction.safeParse(raw).success).toBe(true)
  })

  test.each(fixtures('commands'))('command %s parses as a cmd frame, unchanged', (name) => {
    const raw = fixture('commands', name) as { type: string }
    expect(raw.type).toBe(name)
    expect(CmdFrameSchema.parse(raw)).toEqual(raw as never)
    expect(ClientFrameSchema.safeParse(raw).success).toBe(true)
  })

  test.each(fixtures('server-commands'))('server command %s parses, unchanged', (name) => {
    const raw = fixture('server-commands', name) as { type: string }
    expect(raw.type).toBe(name)
    expect(ServerCommandSchema.parse(raw)).toEqual(raw as never)
  })

  test.each(fixtures('events'))('event %s parses as an evt frame, unchanged', (name) => {
    const raw = fixture('events', name) as { type: string }
    expect(raw.type).toBe(name)
    expect(EvtFrameSchema.parse(raw)).toEqual(raw as never)
    expect(ServerFrameSchema.safeParse(raw).success).toBe(true)
  })

  test('a server command is refused in a cmd frame', () => {
    const seatJoin = fixture('server-commands', 'seat.join') as object
    expect(CmdFrameSchema.safeParse({ frame: 'cmd', id: 'm1', ...seatJoin }).success).toBe(false)
  })

  test('a nack outside the closed list is refused', () => {
    expect(FRAME_SCHEMAS.nack.safeParse({ frame: 'nack', id: 'm1', reason: 'nope' }).success).toBe(
      false,
    )
  })

  test('unknown fields are ignored, not refused', () => {
    const vote = fixture('commands', 'poker.vote') as Record<string, unknown>
    expect(CmdFrameSchema.safeParse({ ...vote, later: true }).success).toBe(true)
  })

  test('a vote that names no round is refused', () => {
    expect(CommandSchema.safeParse({ type: 'poker.vote', payload: { card: '5' } }).success).toBe(
      false,
    )
  })
})
