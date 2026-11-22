/**
 * The one-time import of v1 on a private Postgres, from a dump a real `mariadb-dump` 11.4 wrote
 * (`v1-fixture.seed.sql` holds its rows and how it was made). The tests run in order on one database: the dry run, two
 * applies, what the rows hold, then the API on the imported data.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { freePort } from '@fpp/test-kit/port'
import { startPostgres, type PostgresCluster } from '@fpp/test-kit/postgres'
import { sql } from 'drizzle-orm'
import type { DbClient } from '../../src/db/client.ts'
import { NAME_HOLD, NUMBER_HOLD } from '../../src/db/holds.ts'
import { computeDay } from '../../src/db/rollups.ts'
import { METRIC } from '../../src/db/stat-metrics.ts'
import { at, interval } from '../../src/db/sql.ts'
import type { StatsBody } from '../../src/http/stats.ts'
import {
  formatReport,
  ImportRefused,
  type ImportOptions,
  type ImportReport,
  runImport,
} from '../../src/jobs/import-v1/command.ts'
import { TARGET_TABLES } from '../../src/jobs/import-v1/target.ts'
import { createRoom, prepare, query, startApi, until } from '../api.ts'
import { hello, TestClient } from '../contract/client.ts'
import { ENV } from '../support.ts'

const DUMP = new URL('./v1-fixture.sql', import.meta.url).pathname
/** The fixture's present: its last page view is this morning, its last vote yesterday. */
const NOW = new Date('2026-11-20T12:00:00Z')
const USERS = [
  'v1userAAAAAAAAAAAAAA1',
  'v1userAAAAAAAAAAAAAA2',
  'v1userAAAAAAAAAAAAAA3',
  'v1userAAAAAAAAAAAAAA4',
]

let cluster: PostgresCluster
let db: DbClient
let options: ImportOptions

beforeAll(async () => {
  cluster = await startPostgres()
  db = await prepare(cluster.url)
  options = {
    dump: Bun.file(DUMP),
    databaseUrl: cluster.url,
    visitorKey: ENV.VISITOR_KEY,
    apply: false,
    allowOtherOrigins: false,
    now: NOW,
  }
}, 60_000)

afterAll(async () => {
  await db?.close()
  await cluster?.stop()
})

const one = async <Row>(statement: ReturnType<typeof sql>) => (await query<Row>(db, statement))[0]

/** Each table's row count and a checksum of every row it holds. */
async function tables() {
  const out: Record<string, { rows: number; sum: string }> = {}
  for (const table of TARGET_TABLES) {
    const row = await one<{ n: string; sum: string }>(sql`
      SELECT count(*) AS n, md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) AS sum
      FROM ${sql.raw(`fpp.${table}`)} t`)
    out[table] = { rows: Number(row?.n), sum: String(row?.sum) }
  }
  return out
}

const skipOf = (report: ImportReport, id: number, part: string) =>
  report.skips.find((skip) => skip.table === 'fpp_rooms' && skip.id === id && skip.part === part)

describe('the import', () => {
  let dry: ImportReport

  test('the dry run prints counts per source and target table and every skip with its reason, and writes nothing', async () => {
    dry = await runImport(options)
    const printed = formatReport(dry)
    expect(printed).toContain('dry run')
    expect(printed).toMatch(/fpp_rooms\s+13/)
    expect(printed).toMatch(/fpp_votes\s+7/)
    expect(printed).toMatch(/fpp_estimations\s+17/)
    expect(printed).toMatch(/room\s+13\s+0\s+0\s+0/)
    expect(printed).toMatch(/round\s+6\s+0\s+0\s+0/)
    expect(printed).toContain(`skipped: ${dry.skips.length}`)
    for (const skip of dry.skips)
      expect(printed).toContain(`${skip.table} ${skip.id} ${skip.part}: ${skip.reason}`)
    expect(dry.source).toEqual({
      fpp_rooms: 13,
      fpp_votes: 7,
      fpp_estimations: 17,
      fpp_page_views: 5,
      fpp_events: 4,
    })
    expect(dry.estimationsNotVotes).toBe(4)
    // The 34 is no card of v1's deck.
    expect(dry.votesOffDeck).toBe(1)
    expect(dry.target.visitor_day.planned).toBe(5)
    // Twelve numbers of six digits, one name of six digits; five names: team-alpha, my-team, muller, o-neil-x, rockets.
    expect(dry.target.room_slug.planned).toBe(12 + 1 + 5)
    expect(Object.values(await tables()).every((table) => table.rows === 0)).toBe(true)
  })

  test('apply writes what the dry run planned; a second apply leaves every count and checksum unchanged', async () => {
    const first = await runImport({ ...options, apply: true })
    for (const table of TARGET_TABLES) {
      expect(first.target[table].written).toBe(dry.target[table].planned)
      expect(first.target[table].after).toBe(dry.target[table].planned)
    }
    const once = await tables()
    const second = await runImport({ ...options, apply: true })
    expect(TARGET_TABLES.map((table) => second.target[table].written)).toEqual(
      TARGET_TABLES.map(() => 0),
    )
    expect(await tables()).toEqual(once)
    expect(second.skips).toEqual(first.skips)
  })

  test('a room with a name gets two addresses, released at its last use plus each hold; a name the rule refuses is a skip with its reason', async () => {
    const lastUsed = new Date('2026-11-01T08:00:00Z')
    const addresses = await query<{
      slug: string
      kind: string
      is_primary: boolean
      on_time: boolean
    }>(
      db,
      sql`SELECT slug, kind, is_primary,
                 release_at = ${at(lastUsed)} + CASE kind WHEN 'number' THEN ${interval(NUMBER_HOLD)} ELSE ${interval(NAME_HOLD)} END AS on_time
          FROM fpp.room_slug WHERE room_id = 2 ORDER BY kind`,
    )
    expect(addresses).toEqual([
      { slug: 'team-alpha', kind: 'name', is_primary: true, on_time: true },
      { slug: '234567', kind: 'number', is_primary: false, on_time: true },
    ])
    expect(await one(sql`SELECT name, origin FROM fpp.room WHERE id = 2`)).toEqual({
      name: 'team-alpha',
      origin: 'v1',
    })

    const primary = async (id: number) =>
      (
        await one<{ slug: string }>(
          sql`SELECT slug FROM fpp.room_slug WHERE room_id = ${id} AND is_primary`,
        )
      )?.slug
    expect(await primary(1)).toBe('123456')
    expect(await primary(3)).toBe('my-team')
    expect(await primary(6)).toBe('muller')
    expect(await primary(11)).toBe('o-neil-x')
    expect(await primary(12)).toBe('rockets')
    expect(await primary(4)).toBe('456789')
    expect(await primary(5)).toBeUndefined()

    expect(skipOf(dry, 4, 'name')?.reason).toContain('no v9 name remains')
    expect(skipOf(dry, 9, 'name')?.reason).toContain('no v9 name remains')
    expect(skipOf(dry, 13, 'name')?.reason).toContain('not six or eight')
    // A name of six digits stays an address of its room, as a number beside the room's own.
    expect(
      await query(
        db,
        sql`SELECT slug, kind, is_primary FROM fpp.room_slug WHERE room_id = 8 ORDER BY slug`,
      ),
    ).toEqual([
      { slug: '789012', kind: 'number', is_primary: true },
      { slug: '999999', kind: 'number', is_primary: false },
    ])
    expect(skipOf(dry, 8, 'name')).toBeUndefined()
    expect(skipOf(dry, 5, 'number')?.reason).toContain('not six digits')
    expect(skipOf(dry, 7, 'name')?.reason).toContain('room 3')
    expect(skipOf(dry, 10, 'name')?.reason).toContain('room 2')
    expect(dry.skips.filter((skip) => skip.table === 'fpp_rooms' && skip.part === 'room')).toEqual(
      [],
    )
    // No skip carries a room's name.
    expect(JSON.stringify(dry.skips)).not.toMatch(/my team|my_team|müller|team alpha|!!!/)
  })

  test("each votes row is one untitled topic and one round with v1's summary, a room's rounds numbered by time", async () => {
    const rounds = await query<Record<string, unknown>>(
      db,
      sql`SELECT r.room_id::int AS room, r.no, r.attempt, r.players, r.spectators, r.consensus, r.auto_reveal,
                 extract(epoch FROM r.revealed_at - r.started_at)::int AS seconds,
                 jsonb_typeof(r.deck) AS deck, r.deck->>'id' AS deck_id, r.distribution::text AS distribution,
                 r.summary::text AS summary, t.title, t.state, t.position
          FROM fpp.round r JOIN fpp.topic t ON t.id = r.topic_id ORDER BY r.revealed_at`,
    )
    expect(rounds).toHaveLength(6)
    expect(rounds[1]).toEqual({
      room: 1,
      no: 2,
      attempt: 1,
      players: 3,
      spectators: 1,
      consensus: false,
      auto_reveal: true,
      seconds: 125,
      deck: 'object',
      deck_id: 'fibonacci',
      distribution: '[]',
      summary: '{"count": 3, "lowest": 2, "average": 4.33, "highest": 8}',
      title: '',
      state: 'done',
      position: 2,
    })
    expect(rounds[3]).toMatchObject({ room: 2, no: 2, players: 0, consensus: false, summary: null })
    expect(dry.skips).toContainEqual(
      expect.objectContaining({ table: 'fpp_votes', id: 6, part: 'round' }),
    )
    // A new v9 room takes an id after v1's.
    const identity = await one<{ id: string }>(
      sql`SELECT pg_sequence_last_value(pg_get_serial_sequence('fpp."room"', 'id')::regclass) AS id`,
    )
    expect(Number(identity?.id)).toBe(13)
  })

  test("stat_daily holds v1's days under the job's names, and the job rolls such a day to the same counts", async () => {
    const rows = await query<{ metric: string; dimension: string; value: number }>(
      db,
      sql`SELECT metric, dimension, value FROM fpp.stat_daily WHERE day = '2025-11-03' ORDER BY metric, dimension`,
    )
    expect(rows).toEqual([
      { metric: 'card_votes', dimension: 'fibonacci/2', value: 2 },
      { metric: 'card_votes', dimension: 'fibonacci/5', value: 1 },
      { metric: 'estimators', dimension: '', value: 4 },
      // The fourth user had only watched before: this is their first vote.
      { metric: 'estimators_new', dimension: '', value: 1 },
      { metric: 'events', dimension: 'CHANGED_ROOM_NAME', value: 1 },
      { metric: 'events', dimension: 'COPIED_ROOM_LINK', value: 2 },
      { metric: 'page_views', dimension: 'GUIDE', value: 1 },
      { metric: 'rooms_active', dimension: '', value: 2 },
      { metric: 'rooms_created', dimension: '', value: 5 },
      { metric: 'rounds', dimension: '', value: 2 },
      { metric: 'rounds_by_hour', dimension: '14', value: 1 },
      { metric: 'rounds_by_hour', dimension: '15', value: 1 },
      { metric: 'rounds_consensus', dimension: '', value: 1 },
      { metric: 'votes', dimension: '', value: 3 },
    ])
    const days = await one<{ first: string; last: string; n: string }>(
      sql`SELECT min(day)::text AS first, max(day)::text AS last, count(*) AS n FROM fpp.stat_daily WHERE metric = 'rounds'`,
    )
    expect(days).toEqual({ first: '2024-03-04', last: '2026-11-20', n: '992' })
    const stored = await query<{ metric: string; dimension: string; value: number }>(
      db,
      sql`SELECT metric, dimension, value FROM fpp.stat_daily WHERE day = '2024-03-04'
          AND metric IN ('rounds', 'votes', 'rounds_consensus', 'rooms_active', 'rounds_by_hour') ORDER BY metric, dimension`,
    )
    const rolled = (await computeDay(db.db, '2024-03-04')).filter((row) =>
      ['rounds', 'votes', 'rounds_consensus', 'rooms_active', 'rounds_by_hour'].includes(
        row.metric,
      ),
    )
    expect(rolled).toEqual(stored)
  })

  test("a v1 user id's vote day is the visitor_day value the API writes for that device id", async () => {
    const imported = await query<{ day: string; visitor: string }>(
      db,
      sql`SELECT day::text AS day, encode(visitor, 'hex') AS visitor FROM fpp.visitor_day ORDER BY day, visitor`,
    )
    expect(imported.map((row) => row.day)).toEqual([
      '2025-11-03',
      '2025-11-03',
      '2025-11-03',
      '2025-11-03',
      '2026-11-19',
    ])
    const api = await startApi(cluster.url, await freePort(), { now: () => NOW.getTime() })
    try {
      const slug = await createRoom(api)
      const client = await TestClient.open(api.ws(slug))
      client.send({ ...hello({ name: 'Device' }), device: USERS[0] })
      const welcome = (await client.next('welcome')) as unknown as {
        view: { activity: { current: string } }
      }
      client.send({
        frame: 'cmd',
        id: 'v1',
        type: 'poker.vote',
        payload: { round: welcome.view.activity.current, card: '5' },
      })
      await client.next('ack', (frame) => frame.id === 'v1')
      await until(
        async () =>
          (await one(sql`SELECT 1 FROM fpp.visitor_day WHERE day = '2026-11-20'`)) !== undefined,
      )
      client.close()
      const written = await one<{ visitor: string }>(
        sql`SELECT encode(visitor, 'hex') AS visitor FROM fpp.visitor_day WHERE day = '2026-11-20'`,
      )
      expect(written?.visitor).toBe(imported.at(-1)?.visitor)
    } finally {
      await api.stop()
    }
  })

  test('no column after the import holds a device, a place, a referrer or a raw user id of the fixture', async () => {
    const columns = await query<{ table_name: string; column_name: string }>(
      db,
      sql`SELECT table_name, column_name FROM information_schema.columns
          WHERE table_schema = 'fpp' AND table_name <> '__drizzle_migrations'`,
    )
    expect(columns.length).toBeGreaterThan(30)
    for (const { table_name, column_name } of columns) {
      const column = sql.raw(`"${column_name}"`)
      const table = sql.raw(`fpp."${table_name}"`)
      const hits = await one<{ n: string }>(sql`
        SELECT count(*) AS n FROM ${table}
        WHERE ${column}::text LIKE '%MARKER%' OR ${column}::text = 'DE'
           OR ${column}::text LIKE ANY (ARRAY[${sql.join(
             USERS.map((user) => sql`${`%${user}%`}`),
             sql`, `,
           )}])`)
      expect({ column: `${table_name}.${column_name}`, hits: Number(hits?.n) }).toEqual({
        column: `${table_name}.${column_name}`,
        hits: 0,
      })
    }
  })
})

describe('the API over the imported database', () => {
  test("GET /api/stats shows v1's own totals", async () => {
    const api = await startApi(cluster.url, await freePort(), { now: () => NOW.getTime() })
    try {
      // The v9 room counts once a rollup of its day runs, and the first tick of this process does that. Polling /stats
      // would not see it: its answer is kept for STATS_MAX_AGE_SECONDS and the test's clock does not move.
      await until(
        async () =>
          (await one(sql`SELECT 1 FROM fpp.stat_daily
            WHERE day = '2026-11-20' AND metric = ${METRIC.roomsCreated} AND dimension = '' AND value = 1`)) !==
          undefined,
      )
      const stats = (await (await api.http('/stats')).json()) as StatsBody
      // v1's own counting: 7 votes rows, 12 estimates in them, 13 rooms, 4 reveals with lowest equal to highest; plus the
      // room v9 opened above, whose vote was never revealed.
      expect(stats.totals).toEqual({
        rounds: 7,
        votes: 12,
        roomsCreated: 13 + 1,
        consensusRounds: 4,
      })
    } finally {
      await api.stop()
    }
  })

  test('a target that holds v9 rooms is refused unless told otherwise', async () => {
    await expect(runImport({ ...options, apply: true })).rejects.toBeInstanceOf(ImportRefused)
    const allowed = await runImport({ ...options, allowOtherOrigins: true })
    expect(allowed.target.room.written).toBe(0)
  })
})
