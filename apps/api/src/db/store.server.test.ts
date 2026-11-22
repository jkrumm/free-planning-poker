import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { startPostgres } from '@fpp/test-kit/postgres'
import type { PostgresCluster } from '@fpp/test-kit/postgres'
import { readdir, readFile } from 'node:fs/promises'
import { sql } from 'drizzle-orm'
import { bookName, claimAddress, findClaimable, resolveAddress, touchAddress } from './addresses.ts'
import { createDb, runMigrations } from './client.ts'
import type { DbClient } from './client.ts'
import { SNAPSHOT_TTL_MS } from './holds.ts'
import {
  claimRoom,
  createRoom,
  loadRoom,
  releaseRoom,
  sweepSnapshots,
  writeSnapshot,
} from './rooms.ts'
import { insertRound, listTopics, roundCounters } from './rounds.ts'
import {
  loadOpenTopics,
  type QueueTopic,
  recordDecision,
  upsertTopics,
  writeQueue,
} from './topics.ts'
import {
  deleteEstimatingDaysBefore,
  hashVisitor,
  recordEstimatingDay,
  upsertDailyStat,
  utcDay,
} from './visitors.ts'
import { rowsOf } from './sql.ts'

const MIGRATIONS = new URL('../../drizzle', import.meta.url).pathname
const T0 = new Date('2026-06-01T10:00:00Z')
const plus = (when: Date, ms: number) => new Date(when.getTime() + ms)
const DAY = 24 * 60 * 60 * 1000

let cluster: PostgresCluster
let client: DbClient
const db = () => client.db

beforeAll(async () => {
  cluster = await startPostgres()
  client = createDb({ url: cluster.url })
  await runMigrations(client.db, MIGRATIONS)
}, 60_000)

afterAll(async () => {
  await client?.close()
  await cluster?.stop()
})

const query = async <Row>(statement: ReturnType<typeof sql>) =>
  rowsOf<Row>(await db().execute(statement))

describe('migrations', () => {
  test('create the schema fpp with its journal, room_snapshot unlogged and every other table logged', async () => {
    const tables = await query<{ relname: string; relpersistence: string }>(sql`
      SELECT c.relname, c.relpersistence FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'fpp' AND c.relkind = 'r' ORDER BY c.relname`)
    expect(tables).toEqual([
      { relname: '__drizzle_migrations', relpersistence: 'p' },
      { relname: 'room', relpersistence: 'p' },
      { relname: 'room_slug', relpersistence: 'p' },
      { relname: 'room_snapshot', relpersistence: 'u' },
      { relname: 'round', relpersistence: 'p' },
      { relname: 'round_vote', relpersistence: 'p' },
      { relname: 'stat_daily', relpersistence: 'p' },
      { relname: 'topic', relpersistence: 'p' },
      { relname: 'visitor_day', relpersistence: 'p' },
    ])
  })

  test('run again change nothing', async () => {
    await runMigrations(db(), MIGRATIONS)
    const [row] = await query<{ n: string }>(
      sql`SELECT count(*) AS n FROM fpp.__drizzle_migrations`,
    )
    const journal = JSON.parse(await readFile(`${MIGRATIONS}/meta/_journal.json`, 'utf8')) as {
      entries: unknown[]
    }
    expect(Number(row?.n)).toBe(journal.entries.length)
  })

  test('no table holds a display name, an IP address or a user agent', async () => {
    const columns = await query<{ table_name: string; column_name: string }>(sql`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'fpp' AND (column_name ~ '(^|_)(ip|agent|nickname|username|display_name)($|_)')`)
    expect(columns).toEqual([])
  })

  test('no statement of the store deletes a room, a round or a vote, and a topic only while queued and unplayed', async () => {
    const files = (await readdir(__dirname)).filter(
      (f) => f.endsWith('.ts') && !f.includes('.test.'),
    )
    for (const file of files) {
      const code = await readFile(`${__dirname}/${file}`, 'utf8')
      expect(code).not.toMatch(/DELETE\s+FROM\s+fpp\.(room|round|round_vote)\b/i)
      expect(code).not.toMatch(/\.delete\(\s*(room|round|roundVote|topic)\b/)
      // A room removes only a queued topic, which no round names: the one topic deletion (writeQueue).
      for (const [statement] of code.matchAll(/DELETE\s+FROM\s+fpp\.topic\b[^`]*/gi)) {
        expect(statement).toContain("state = 'queued'")
        expect(statement).toContain('NOT EXISTS (SELECT 1 FROM fpp.round')
      }
    }
  })
})

describe('room ownership', () => {
  test('two claims get different epochs and the stale one writes nothing', async () => {
    const roomId = await createRoom(db())
    const first = await claimRoom(db(), { roomId, owner: 'proc-a', now: T0 })
    expect(first).toEqual({ epoch: 1, seq: 0, state: null })
    expect(
      await writeSnapshot(db(), {
        roomId,
        epoch: 1,
        owner: 'proc-a',
        state: { v: 1 },
        seq: 5,
        now: T0,
      }),
    ).toBe('owned')

    const second = await claimRoom(db(), { roomId, owner: 'proc-b', now: plus(T0, 1000) })
    expect(second.epoch).toBe(2)
    expect(second.state).toEqual({ v: 1 })
    expect(second.seq).toBe(5)

    const stale = await writeSnapshot(db(), {
      roomId,
      epoch: first.epoch,
      owner: 'proc-a',
      state: { v: 'stale' },
      seq: 9,
      now: plus(T0, 2000),
    })
    expect(stale).toBe('lost')
    const [row] = await query<{ state: unknown; seq: string; owner: string }>(
      sql`SELECT state::text AS state, seq, owner FROM fpp.room_snapshot WHERE room_id = ${roomId}`,
    )
    expect(row).toEqual({ state: '{"v": 1}', seq: '5', owner: 'proc-b' })
  })

  test('concurrent claims of one room each get their own epoch', async () => {
    const roomId = await createRoom(db())
    const claims = await Promise.all(
      Array.from({ length: 20 }, (_, i) => claimRoom(db(), { roomId, owner: `p${i}`, now: T0 })),
    )
    expect(claims.map((c) => c.epoch).toSorted((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    )
  })

  test('release clears the owner for the owner only and keeps the snapshot', async () => {
    const roomId = await createRoom(db())
    const a = await claimRoom(db(), { roomId, owner: 'a', now: T0 })
    await writeSnapshot(db(), {
      roomId,
      epoch: a.epoch,
      owner: 'a',
      state: { k: 1 },
      seq: 1,
      now: T0,
    })
    expect(await releaseRoom(db(), { roomId, epoch: a.epoch, owner: 'b' })).toBe('lost')
    expect(await releaseRoom(db(), { roomId, epoch: a.epoch, owner: 'a' })).toBe('owned')
    expect(
      await writeSnapshot(db(), { roomId, epoch: a.epoch, owner: 'a', state: {}, seq: 2, now: T0 }),
    ).toBe('lost')
    const next = await claimRoom(db(), { roomId, owner: 'b', now: plus(T0, 1) })
    expect(next).toEqual({ epoch: 2, seq: 1, state: { k: 1 } })
  })

  test('an expired snapshot is not restored, but the epoch keeps counting', async () => {
    const roomId = await createRoom(db())
    const a = await claimRoom(db(), { roomId, owner: 'a', now: T0 })
    await writeSnapshot(db(), {
      roomId,
      epoch: a.epoch,
      owner: 'a',
      state: { k: 1 },
      seq: 4,
      now: T0,
    })
    const later = plus(T0, SNAPSHOT_TTL_MS + 1000)
    expect(await claimRoom(db(), { roomId, owner: 'b', now: later })).toEqual({
      epoch: 2,
      seq: 0,
      state: null,
    })
  })

  test('the sweep deletes expired snapshots only', async () => {
    const [expired, live] = [await createRoom(db()), await createRoom(db())]
    await claimRoom(db(), { roomId: expired, owner: 'a', now: T0 })
    await claimRoom(db(), { roomId: live, owner: 'a', now: plus(T0, SNAPSHOT_TTL_MS) })
    const before = await query<{ n: string }>(sql`SELECT count(*) AS n FROM fpp.room_snapshot`)
    const removed = await sweepSnapshots(db(), { now: plus(T0, SNAPSHOT_TTL_MS + 1000) })
    expect(removed).toBeGreaterThanOrEqual(1)
    const left = await query<{ room_id: string }>(
      sql`SELECT room_id FROM fpp.room_snapshot WHERE room_id IN (${expired}, ${live})`,
    )
    expect(left.map((r) => Number(r.room_id))).toEqual([live])
    const [rooms] = await query<{ n: string }>(
      sql`SELECT count(*) AS n FROM fpp.room WHERE id IN (${expired}, ${live})`,
    )
    expect(Number(rooms?.n)).toBe(2)
    expect(Number(before[0]?.n)).toBeGreaterThanOrEqual(2)
  })
})

const roundOf = (roomId: number, topicId: string, no: number, attempt = 1) => ({
  id: Bun.randomUUIDv7(),
  roomId,
  topicId,
  no,
  attempt,
  deck: { id: 'fibonacci' },
  startedAt: T0,
  revealedAt: plus(T0, 60_000),
  players: 3,
  spectators: 1,
  distribution: [{ label: '5', value: 5, count: 3 }],
  consensus: true,
  autoReveal: false,
})

const paste = (site: string | null) => ({
  id: Bun.randomUUIDv7(),
  position: 1,
  title: 'x',
  externalKey: 'SHOP-1',
  externalSite: site,
})

describe('topics and rounds', () => {
  test('a round and its votes are inserted together or not at all', async () => {
    const roomId = await createRoom(db())
    const [stored] = await upsertTopics(db(), {
      roomId,
      topics: [{ id: Bun.randomUUIDv7(), position: 0, title: 'Checkout' }],
    })
    const topicId = stored!.id

    const bad = roundOf(roomId, topicId, 1)
    await expect(
      insertRound(db(), {
        round: bad,
        votes: [
          { seat: 0, label: '5', value: 5 },
          { seat: 0, label: '8', value: 8 },
        ],
      }),
    ).rejects.toThrow()
    expect(await query(sql`SELECT 1 FROM fpp.round WHERE id = ${bad.id}`)).toEqual([])
    expect(await query(sql`SELECT 1 FROM fpp.round_vote WHERE round_id = ${bad.id}`)).toEqual([])

    const good = roundOf(roomId, topicId, 1)
    await insertRound(db(), {
      round: good,
      votes: [
        { seat: 1, label: '?', value: null },
        { seat: 0, label: '5', value: 5 },
      ],
    })
    const topics = await listTopics(db(), { roomId })
    expect(topics).toHaveLength(1)
    expect(topics[0]?.rounds).toHaveLength(1)
    expect(topics[0]?.rounds[0]?.votes.map((v) => [v.seat, v.label, v.value])).toEqual([
      [0, '5', 5],
      [1, '?', null],
    ])
  })

  test('importing one tracker reference twice leaves one topic', async () => {
    const roomId = await createRoom(db())
    const ref = {
      source: 'jira',
      externalId: '10042',
      externalKey: 'SHOP-123',
      externalSite: 'site-1',
    }
    const [first] = await upsertTopics(db(), {
      roomId,
      topics: [{ id: Bun.randomUUIDv7(), position: 0, title: 'Checkout redesign', ...ref }],
    })
    // The issue moved: a new key, the same stable id.
    const [second] = await upsertTopics(db(), {
      roomId,
      topics: [
        {
          id: Bun.randomUUIDv7(),
          position: 7,
          title: 'Checkout redesign',
          ...ref,
          externalKey: 'PAY-9',
        },
      ],
    })
    expect(second?.id).toBe(first?.id)
    const topics = await listTopics(db(), { roomId })
    expect(topics).toHaveLength(1)
    expect(topics[0]).toMatchObject({ position: 0, externalKey: 'PAY-9', externalId: '10042' })

    // A pasted line has a key and no id; the same key in another site is another topic.
    await upsertTopics(db(), { roomId, topics: [paste(null), paste(null), paste('other')] })
    expect(await listTopics(db(), { roomId })).toHaveLength(3)
  })

  test('a topic without a tracker reference is never merged, and its id updates it', async () => {
    const roomId = await createRoom(db())
    const id = Bun.randomUUIDv7()
    await upsertTopics(db(), {
      roomId,
      topics: [
        { id, position: 0, title: 'a' },
        { id: Bun.randomUUIDv7(), position: 1, title: 'a' },
      ],
    })
    await upsertTopics(db(), { roomId, topics: [{ id, position: 5, state: 'active' }] })
    const topics = await listTopics(db(), { roomId })
    expect(topics.map((t) => [t.title, t.position, t.state])).toEqual([
      ['a', 1, 'queued'],
      ['a', 5, 'active'],
    ])
  })

  test('a decision and the open topics', async () => {
    const roomId = await createRoom(db())
    const [a, b, c] = [Bun.randomUUIDv7(), Bun.randomUUIDv7(), Bun.randomUUIDv7()]
    await upsertTopics(db(), {
      roomId,
      topics: [
        { id: a, position: 0, title: 'done one', state: 'done' },
        { id: b, position: 2, title: 'second' },
        { id: c, position: 1, title: 'first', state: 'active' },
      ],
    })
    const decidedAt = plus(T0, 5000)
    expect(
      await recordDecision(db(), {
        roomId,
        topicId: c,
        finalLabel: '8',
        finalValue: 8,
        decidedBy: 'agreed',
        decidedAt,
      }),
    ).toBe(true)
    expect(
      await recordDecision(db(), {
        roomId: roomId + 1,
        topicId: c,
        finalLabel: '1',
        finalValue: 1,
        decidedBy: 'agreed',
        decidedAt,
      }),
    ).toBe(false)
    const open = await loadOpenTopics(db(), { roomId })
    expect(open.map((t) => t.title)).toEqual(['first', 'second'])
    expect(open[0]).toMatchObject({
      finalLabel: '8',
      finalValue: 8,
      decidedBy: 'agreed',
      decidedAt,
    })
    const cold = await loadRoom(db(), roomId)
    expect(cold?.openTopics).toHaveLength(2)
  })
})

describe('addresses', () => {
  test('fifty concurrent claims of one free address yield exactly one owner', async () => {
    const rooms = await Promise.all(Array.from({ length: 50 }, () => createRoom(db())))
    const results = await Promise.all(
      rooms.map((roomId) =>
        claimAddress(db(), { roomId, slug: '482913', kind: 'number', now: T0 }),
      ),
    )
    expect(results.filter((slug) => slug !== null)).toEqual(['482913'])
    const [row] = await query<{ n: string }>(
      sql`SELECT count(*) AS n FROM fpp.room_slug WHERE slug = '482913'`,
    )
    expect(Number(row?.n)).toBe(1)
  })

  test('a held address is refused, a released one changes hands and the previous room keeps its rounds', async () => {
    const [a, b] = [await createRoom(db()), await createRoom(db())]
    const slug = '100001'
    expect(await claimAddress(db(), { roomId: a, slug, kind: 'number', now: T0 })).toBe(slug)

    // Held: three months from T0.
    expect(
      await claimAddress(db(), { roomId: b, slug, kind: 'number', now: plus(T0, 89 * DAY) }),
    ).toBeNull()
    expect((await resolveAddress(db(), { slug, now: plus(T0, 89 * DAY) }))?.roomId).toBe(a)

    const [stored] = await upsertTopics(db(), {
      roomId: a,
      topics: [{ id: Bun.randomUUIDv7(), position: 0 }],
    })
    await insertRound(db(), {
      round: {
        id: Bun.randomUUIDv7(),
        roomId: a,
        topicId: stored!.id,
        no: 1,
        attempt: 1,
        deck: {},
        startedAt: T0,
        revealedAt: T0,
        players: 2,
        spectators: 0,
        distribution: [],
        consensus: false,
        autoReveal: false,
      },
      votes: [{ seat: 0, label: '3', value: 3 }],
    })

    // Released but not taken: it still leads to room a, flagged as released.
    const late = plus(T0, 100 * DAY)
    expect(await resolveAddress(db(), { slug, now: late })).toMatchObject({
      roomId: a,
      released: true,
    })

    expect(await claimAddress(db(), { roomId: b, slug, kind: 'number', now: late })).toBe(slug)
    expect(await resolveAddress(db(), { slug, now: late })).toMatchObject({
      roomId: b,
      released: false,
      primarySlug: slug,
    })
    const kept = await listTopics(db(), { roomId: a })
    expect(kept).toHaveLength(1)
    expect(kept[0]?.rounds).toHaveLength(1)
    expect(kept[0]?.rounds[0]?.votes).toHaveLength(1)
  })

  test('the claimable candidate is a never used one first, then the one released longest ago', async () => {
    const [a, b] = [await createRoom(db()), await createRoom(db())]
    await claimAddress(db(), { roomId: a, slug: '200001', kind: 'number', now: T0 })
    await claimAddress(db(), { roomId: b, slug: '200002', kind: 'number', now: plus(T0, 10 * DAY) })
    await claimAddress(db(), {
      roomId: b,
      slug: '200003',
      kind: 'number',
      now: plus(T0, 20 * DAY),
    }).catch(() => null)
    const now = plus(T0, 200 * DAY)
    const candidates = ['200002', '200001', '200009']
    expect(await findClaimable(db(), { candidates, now })).toBe('200009')
    expect(await findClaimable(db(), { candidates: ['200002', '200001'], now })).toBe('200001')
    // 200001 is still held at day 50.
    expect(
      await findClaimable(db(), { candidates: ['200001'], now: plus(T0, 50 * DAY) }),
    ).toBeNull()
    expect(await findClaimable(db(), { candidates: [], now })).toBeNull()
  })

  test('booking a name moves the primary address, the replaced one stays valid for 30 days', async () => {
    const [a, b] = [await createRoom(db()), await createRoom(db())]
    await claimAddress(db(), { roomId: a, slug: '300001', kind: 'number', now: T0 })
    const bookedAt = plus(T0, 10 * DAY)
    expect(await bookName(db(), { roomId: a, name: 'team-alpha', now: bookedAt })).toBe(
      'team-alpha',
    )
    expect(
      await resolveAddress(db(), { slug: '300001', now: plus(bookedAt, 29 * DAY) }),
    ).toMatchObject({
      roomId: a,
      primarySlug: 'team-alpha',
      released: false,
    })
    expect(
      await resolveAddress(db(), { slug: '300001', now: plus(bookedAt, 31 * DAY) }),
    ).toMatchObject({
      roomId: a,
      released: true,
    })

    // Held by a: b cannot book it; a booking its own name again is fine.
    expect(
      await bookName(db(), { roomId: b, name: 'team-alpha', now: plus(bookedAt, DAY) }),
    ).toBeNull()
    expect(await bookName(db(), { roomId: a, name: 'team-alpha', now: plus(bookedAt, DAY) })).toBe(
      'team-alpha',
    )

    // A change of name: the previous name stays valid for 30 days.
    const changedAt = plus(bookedAt, 40 * DAY)
    expect(await bookName(db(), { roomId: a, name: 'team-beta', now: changedAt })).toBe('team-beta')
    expect(
      await resolveAddress(db(), { slug: 'team-alpha', now: plus(changedAt, 29 * DAY) }),
    ).toMatchObject({
      roomId: a,
      primarySlug: 'team-beta',
      released: false,
    })
    const primaries = await query<{ n: string }>(
      sql`SELECT count(*) AS n FROM fpp.room_slug WHERE room_id = ${a} AND is_primary`,
    )
    expect(Number(primaries[0]?.n)).toBe(1)

    // After the grace, b can book the old name.
    expect(
      await bookName(db(), { roomId: b, name: 'team-alpha', now: plus(changedAt, 31 * DAY) }),
    ).toBe('team-alpha')
  })

  test('one primary address per room', async () => {
    const a = await createRoom(db())
    await claimAddress(db(), { roomId: a, slug: '400001', kind: 'number', now: T0 })
    await expect(
      claimAddress(db(), { roomId: a, slug: '400002', kind: 'number', now: T0 }),
    ).rejects.toThrow()
  })

  test('a visit pushes the release date forward at most once a day, and only for the room that holds it', async () => {
    const [a, b] = [await createRoom(db()), await createRoom(db())]
    await claimAddress(db(), { roomId: a, slug: '500001', kind: 'number', now: T0 })
    expect(await touchAddress(db(), { roomId: a, slug: '500001', now: plus(T0, 1000) })).toBe(false)
    expect(await touchAddress(db(), { roomId: a, slug: '500001', now: plus(T0, 2 * DAY) })).toBe(
      true,
    )
    expect(
      await touchAddress(db(), { roomId: a, slug: '500001', now: plus(T0, 2 * DAY + 1000) }),
    ).toBe(false)
    expect(await touchAddress(db(), { roomId: b, slug: '500001', now: plus(T0, 9 * DAY) })).toBe(
      false,
    )
    const [row] = await query<{ release_at: Date }>(
      sql`SELECT release_at FROM fpp.room_slug WHERE slug = '500001'`,
    )
    // Three months after the second day of the visit (2026-06-03 + 3 months).
    expect(new Date(row!.release_at).toISOString()).toBe('2026-09-03T10:00:00.000Z')
  })
})

describe('estimating days and rollups', () => {
  test('two estimating days of one device on one day leave one row', async () => {
    const visitor = hashVisitor({ key: 'server-secret', deviceId: 'device-1' })
    expect(visitor).toHaveLength(16)
    expect(hashVisitor({ key: 'server-secret', deviceId: 'device-1' })).toEqual(visitor)
    expect(hashVisitor({ key: 'other-secret', deviceId: 'device-1' })).not.toEqual(visitor)
    const day = utcDay(T0)
    expect(await recordEstimatingDay(db(), { day, visitor })).toBe(true)
    expect(await recordEstimatingDay(db(), { day, visitor })).toBe(false)
    const rows = await query<{ visitor: Uint8Array }>(
      sql`SELECT visitor FROM fpp.visitor_day WHERE day = ${day}`,
    )
    expect(rows).toHaveLength(1)
    expect(Uint8Array.from(rows[0]!.visitor)).toEqual(Uint8Array.from(visitor))
  })

  test('a visitor that is not 16 bytes is refused', async () => {
    await expect(
      recordEstimatingDay(db(), { day: '2026-01-01', visitor: new Uint8Array(8) }),
    ).rejects.toThrow()
  })

  test('estimating days older than 13 months are deleted, newer ones are kept', async () => {
    const visitor = hashVisitor({ key: 'k', deviceId: 'retention' })
    const now = new Date('2026-11-22T00:00:00Z')
    await recordEstimatingDay(db(), { day: '2025-10-21', visitor })
    await recordEstimatingDay(db(), { day: '2025-10-22', visitor })
    await recordEstimatingDay(db(), { day: '2026-11-21', visitor })
    await deleteEstimatingDaysBefore(db(), { now })
    const days = await query<{ day: string }>(
      sql`SELECT day::text AS day FROM fpp.visitor_day WHERE visitor = ${visitor} ORDER BY day`,
    )
    expect(days.map((d) => d.day)).toEqual(['2025-10-22', '2026-11-21'])
  })

  test('a daily statistic is replaced by a rerun', async () => {
    await upsertDailyStat(db(), { day: '2026-01-01', metric: 'rounds', value: 3 })
    await upsertDailyStat(db(), { day: '2026-01-01', metric: 'rounds', value: 5 })
    await upsertDailyStat(db(), {
      day: '2026-01-01',
      metric: 'rounds',
      dimension: 'fibonacci',
      value: 2,
    })
    const rows = await query<{ dimension: string; value: number }>(
      sql`SELECT dimension, value FROM fpp.stat_daily WHERE metric = 'rounds' ORDER BY dimension`,
    )
    expect(rows).toEqual([
      { dimension: '', value: 5 },
      { dimension: 'fibonacci', value: 2 },
    ])
  })
})

const queued = (id: string, position: number, extra: Partial<QueueTopic> = {}): QueueTopic => ({
  id,
  position,
  title: `Topic ${position}`,
  url: null,
  source: null,
  externalId: null,
  externalKey: null,
  externalSite: null,
  state: 'queued',
  ...extra,
})

describe('the live queue written through', () => {
  test('topics are written by id, a removed queued one is deleted, a played one is kept', async () => {
    const roomId = await createRoom(db())
    const [a, b, c] = [Bun.randomUUIDv7(), Bun.randomUUIDv7(), Bun.randomUUIDv7()]
    await writeQueue(db(), {
      roomId,
      topics: [queued(a, 0, { state: 'active' }), queued(b, 1), queued(c, 2)],
      removed: [],
    })
    await insertRound(db(), { round: roundOf(roomId, a, 1), votes: [] })
    await writeQueue(db(), {
      roomId,
      topics: [queued(c, 1, { title: 'Renamed' })],
      removed: [a, b],
    })
    const rows = await query<{ id: string; position: number; title: string }>(
      sql`SELECT id, position, title FROM fpp.topic WHERE room_id = ${roomId} ORDER BY position`,
    )
    expect(rows).toEqual([
      { id: a, position: 0, title: 'Topic 0' },
      { id: c, position: 1, title: 'Renamed' },
    ])
  })

  test('a second topic with a tracker reference the room holds is stored without it', async () => {
    const roomId = await createRoom(db())
    const ref = { source: 'jira', externalKey: 'SHOP-1', externalSite: 'acme' }
    const [first, second] = [Bun.randomUUIDv7(), Bun.randomUUIDv7()]
    await writeQueue(db(), {
      roomId,
      topics: [queued(first, 0, ref), queued(second, 1, ref)],
      removed: [],
    })
    const rows = await query<{ id: string; external_key: string | null }>(
      sql`SELECT id, external_key FROM fpp.topic WHERE room_id = ${roomId} ORDER BY position`,
    )
    expect(rows).toEqual([
      { id: first, external_key: 'SHOP-1' },
      { id: second, external_key: null },
    ])
  })

  test("the round counters name the highest number and each topic's latest round; a repeated round is stored once", async () => {
    const roomId = await createRoom(db())
    const topicId = Bun.randomUUIDv7()
    await writeQueue(db(), {
      roomId,
      topics: [queued(topicId, 0, { state: 'active' })],
      removed: [],
    })
    const first = { ...roundOf(roomId, topicId, 1), attempt: 1 }
    const second = { ...roundOf(roomId, topicId, 2), attempt: 2 }
    await insertRound(db(), { round: first, votes: [{ seat: 0, label: '5', value: 5 }] })
    await insertRound(db(), { round: second, votes: [] })
    await insertRound(db(), { round: first, votes: [{ seat: 0, label: '5', value: 5 }] })
    const counters = await roundCounters(db(), { roomId, topicIds: [topicId] })
    expect(counters.no).toBe(2)
    expect(counters.latest.get(topicId)).toEqual({ id: second.id, attempt: 2 })
    expect(
      await query(sql`SELECT 1 FROM fpp.round_vote WHERE round_id = ${first.id}`),
    ).toHaveLength(1)
  })
})
