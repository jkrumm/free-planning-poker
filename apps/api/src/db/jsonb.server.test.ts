import { afterAll, beforeAll, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { startPostgres } from '@fpp/test-kit/postgres'
import type { PostgresCluster } from '@fpp/test-kit/postgres'
import { sql } from 'drizzle-orm'
import { createDb, runMigrations } from './client.ts'
import type { DbClient } from './client.ts'
import { createRoom, findRoom, updateRoom } from './rooms.ts'
import { insertRound, listTopics } from './rounds.ts'
import { rowsOf } from './sql.ts'
import { upsertTopics } from './topics.ts'

const MIGRATIONS = new URL('../../drizzle', import.meta.url).pathname

let cluster: PostgresCluster
let client: DbClient

beforeAll(async () => {
  cluster = await startPostgres()
  client = createDb({ url: cluster.url })
  await runMigrations(client.db, MIGRATIONS)
}, 60_000)

afterAll(async () => {
  await client?.close()
  await cluster?.stop()
})

const DECK = { id: 'fibonacci' }
const DISTRIBUTION = [
  { label: '3', value: 3, count: 1 },
  { label: '5', value: 5, count: 2 },
]
const SETTINGS = { revealCountdown: 0, autoReveal: true }

/** What the old writer stored: the value's JSON text, as a JSON string. */
const asString = (value: unknown) => JSON.stringify(value)

type Types = { settings: string; deck: string; distribution: string }

const typesOf = async (roomId: number): Promise<Types> => {
  const [row] = rowsOf<Types>(
    await client.db.execute(sql`
      SELECT jsonb_typeof(o.settings) AS settings, jsonb_typeof(r.deck) AS deck,
             jsonb_typeof(r.distribution) AS distribution
      FROM fpp.room o JOIN fpp.round r ON r.room_id = o.id WHERE o.id = ${roomId}`),
  )
  if (!row) throw new Error('no row')
  return row
}

async function seedRound(roomId: number, no: number): Promise<string> {
  const [topic] = await upsertTopics(client.db, {
    roomId,
    topics: [{ id: Bun.randomUUIDv7(), position: no, title: 'x' }],
  })
  const id = Bun.randomUUIDv7()
  const revealedAt = new Date('2026-06-01T09:00:00Z')
  await insertRound(client.db, {
    round: {
      id,
      roomId,
      topicId: topic!.id,
      no,
      attempt: 1,
      deck: DECK,
      startedAt: new Date(revealedAt.getTime() - 60_000),
      revealedAt,
      players: 3,
      spectators: 0,
      distribution: DISTRIBUTION,
      consensus: false,
      autoReveal: false,
    },
    votes: [],
  })
  return id
}

test('a round and a room are stored as the object and array they hold, and read back equal', async () => {
  const roomId = await createRoom(client.db)
  await updateRoom(client.db, {
    roomId,
    row: { name: 'x', settings: SETTINGS, access: 'open', accessCode: null, accessEpoch: 0 },
    now: new Date('2026-06-01T09:00:00Z'),
  })
  await seedRound(roomId, 1)
  expect(await typesOf(roomId)).toEqual({
    settings: 'object',
    deck: 'object',
    distribution: 'array',
  })
  expect((await findRoom(client.db, roomId))?.settings).toEqual(SETTINGS)
  const [topic] = await listTopics(client.db, { roomId })
  expect(topic?.rounds[0]?.deck).toEqual(DECK)
  expect(topic?.rounds[0]?.distribution).toEqual(DISTRIBUTION)
})

test('the migration rewrites string-typed rows and leaves the others as they are', async () => {
  const legacy = await createRoom(client.db)
  const current = await createRoom(client.db)
  await seedRound(legacy, 1)
  await seedRound(current, 1)
  await client.db.execute(sql`
    UPDATE fpp.room SET settings = ${asString(SETTINGS)}::jsonb WHERE id = ${legacy}`)
  await client.db.execute(sql`
    UPDATE fpp.round SET deck = ${asString(DECK)}::jsonb, distribution = ${asString(DISTRIBUTION)}::jsonb
    WHERE room_id = ${legacy}`)
  expect(await typesOf(legacy)).toEqual({
    settings: 'string',
    deck: 'string',
    distribution: 'string',
  })

  // Before the migration runs, a string-typed row still reads as the value inside it.
  expect((await findRoom(client.db, legacy))?.settings).toEqual(SETTINGS)
  const [before] = await listTopics(client.db, { roomId: legacy })
  expect(before?.rounds[0]?.deck).toEqual(DECK)
  expect(before?.rounds[0]?.distribution).toEqual(DISTRIBUTION)

  const file = await readFile(
    new URL('../../drizzle/0003_jsonb_unwrap_strings.sql', import.meta.url),
    'utf8',
  )
  for (const statement of file.split('--> statement-breakpoint'))
    await client.db.execute(sql.raw(statement))

  expect(await typesOf(legacy)).toEqual({
    settings: 'object',
    deck: 'object',
    distribution: 'array',
  })
  expect(await typesOf(current)).toEqual({
    settings: 'object',
    deck: 'object',
    distribution: 'array',
  })
  expect((await findRoom(client.db, legacy))?.settings).toEqual(SETTINGS)
  const [topic] = await listTopics(client.db, { roomId: legacy })
  expect(topic?.rounds[0]?.deck).toEqual(DECK)
  expect(topic?.rounds[0]?.distribution).toEqual(DISTRIBUTION)
})
