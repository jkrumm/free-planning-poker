/**
 * A room's history over HTTP on a private Postgres: `GET /api/rooms/:slug/topics` and `/summary` as JSON, CSV and
 * Markdown, proved by a seat of that room (docs/v9/ARCHITECTURE.md, HTTP API).
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { freePort } from '@fpp/test-kit/port'
import { startPostgres, type PostgresCluster } from '@fpp/test-kit/postgres'
import { sql } from 'drizzle-orm'
import type { DbClient } from '../src/db/client.ts'
import { SUMMARY_CSV_COLUMNS, TOPICS_CSV_COLUMNS } from '../src/http/history.format.ts'
import { createRoom, prepare, query, roomIdOf, startApi, until } from './api.ts'
import { join, type TestClient } from './contract/client.ts'

let cluster: PostgresCluster
let db: DbClient
let api: Awaited<ReturnType<typeof startApi>>
const open: TestClient[] = []

/** A display name no result may ever carry. */
const MARKER = 'Zed-marker-7f3a91'

beforeAll(async () => {
  cluster = await startPostgres()
  db = await prepare(cluster.url)
  api = await startApi(cluster.url, await freePort())
}, 60_000)

afterEach(() => {
  for (const client of open.splice(0)) client.close()
})

afterAll(async () => {
  await api?.stop()
  await db?.close()
  await cluster?.stop()
})

const track = <T extends { client: TestClient }>(joined: T) => {
  open.push(joined.client)
  return joined
}

let ids = 0
const cmd = (client: TestClient, type: string, payload: Record<string, unknown>) => {
  const id = `c${(ids += 1)}`
  client.send({ frame: 'cmd', id, type, payload })
  return client.next('ack', (frame) => frame.id === id)
}

/** Runs a command that starts a round and returns the new round's id. */
async function starting(client: TestClient, type: string, payload: Record<string, unknown>) {
  const started = client.next('evt', (frame) => frame.type === 'poker.roundStarted')
  await cmd(client, type, payload)
  const frame = (await started) as unknown as { payload: { round: { id: string } } }
  return frame.payload.round.id
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` })
const read = (slug: string, route: 'topics' | 'summary', format: string, token?: string) =>
  api.http(`/rooms/${slug}/${route}${format === 'json' ? '' : `?format=${format}`}`, {
    headers: token === undefined ? {} : auth(token),
  })
const count = async (statement: ReturnType<typeof sql>) =>
  Number((await query<{ n: string }>(db, statement))[0]?.n ?? 0)

type Played = Awaited<ReturnType<typeof play>>

/**
 * Three rounds on two topics: the first agreed on 5 in one round, the second not agreed after a re-vote. Two players
 * (one named MARKER) and a spectator sit in the room.
 */
async function play() {
  const slug = await createRoom(api)
  const zed = track(await join(api.ws(slug), { name: MARKER }))
  const bob = track(await join(api.ws(slug), { name: 'Bob' }))
  const sam = track(await join(api.ws(slug), { name: 'Sam' }))
  await cmd(sam.client, 'seat.setRole', { seat: sam.welcome.seat, role: 'spectator' })
  const first = zed.welcome.view.activity.current
  const topic = zed.welcome.view.topics[0]!.id
  await cmd(zed.client, 'topic.update', { topic, title: 'Login, "SSO" flow', url: null, ref: null })
  await cmd(zed.client, 'topic.add', {
    topics: [{ title: '=HYPERLINK("http://evil.test")', url: null, ref: null }],
  })
  await cmd(zed.client, 'poker.vote', { round: first, card: '5' })
  await cmd(bob.client, 'poker.vote', { round: first, card: '5' })
  await cmd(zed.client, 'poker.reveal', { round: first })
  const second = await starting(zed.client, 'topic.next', { round: first })
  await cmd(zed.client, 'poker.vote', { round: second, card: '3' })
  await cmd(bob.client, 'poker.vote', { round: second, card: '8' })
  await cmd(zed.client, 'poker.reveal', { round: second })
  const third = await starting(zed.client, 'poker.revote', { round: second })
  await cmd(zed.client, 'poker.vote', { round: third, card: '3' })
  await cmd(bob.client, 'poker.vote', { round: third, card: '5' })
  await cmd(zed.client, 'poker.reveal', { round: third })
  const roomId = await roomIdOf(db, slug)
  await until(
    async () =>
      (await count(sql`SELECT count(*) AS n FROM fpp.round WHERE room_id = ${roomId}`)) === 3 &&
      (await count(
        sql`SELECT count(*) AS n FROM fpp.topic WHERE room_id = ${roomId} AND final_value = 5`,
      )) === 1,
  )
  return { slug, roomId, zed, bob, sam }
}

let played: Played
const lines = (text: string) => text.split('\r\n')

describe('the history of a played room', () => {
  beforeAll(async () => {
    played = await play()
  }, 30_000)

  test('JSON lists both topics, in queue order, with their rounds in the shape of the result contract', async () => {
    const response = await read(played.slug, 'topics', 'json', played.zed.welcome.seatToken)
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      room: { slug: string }
      topics: {
        title: string | null
        state: string
        decided: Record<string, unknown> | null
        rounds: { result: Record<string, unknown>; spectators: number; autoReveal: boolean }[]
      }[]
    }
    expect(body.room.slug).toBe(played.slug)
    expect(body.topics.map((topic) => [topic.title, topic.state])).toEqual([
      ['Login, "SSO" flow', 'done'],
      ['=HYPERLINK("http://evil.test")', 'active'],
    ])
    const [login, formula] = body.topics
    expect(login?.decided).toMatchObject({
      type: 'topic.decided',
      v: 1,
      final: { label: '5', value: 5, decidedBy: 'agreed' },
      round: { no: 1, attempt: 1, consensus: true },
    })
    expect(formula?.decided).toBeNull()
    expect(login?.rounds).toHaveLength(1)
    expect(login?.rounds[0]?.result).toMatchObject({
      type: 'poker.revealed',
      v: 1,
      room: { slug: played.slug },
      topic: { title: 'Login, "SSO" flow', url: null, source: null },
      round: {
        no: 1,
        attempt: 1,
        deck: 'fibonacci',
        voters: 2,
        consensus: true,
        distribution: [{ label: '5', value: 5, count: 2 }],
      },
    })
    expect(formula?.rounds.map((round) => round.result['round'])).toMatchObject([
      {
        no: 2,
        attempt: 1,
        voters: 2,
        consensus: false,
        distribution: [
          { label: '3', value: 3, count: 1 },
          { label: '8', value: 8, count: 1 },
        ],
      },
      {
        no: 3,
        attempt: 2,
        voters: 2,
        consensus: false,
        distribution: [
          { label: '3', value: 3, count: 1 },
          { label: '5', value: 5, count: 1 },
        ],
      },
    ])
    expect(login?.rounds[0]).toMatchObject({ spectators: 1, autoReveal: false })
  })

  test('CSV holds one line per round under the documented header, quoted and escaped', async () => {
    const response = await read(played.slug, 'topics', 'csv', played.zed.welcome.seatToken)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('no-store')
    const rows = lines(await response.text())
    expect(rows.pop()).toBe('')
    expect(rows).toHaveLength(4)
    expect(rows[0]).toBe(TOPICS_CSV_COLUMNS.join(','))
    // RFC 4180: a comma or a quote puts the field in quotes and doubles its quotes.
    expect(rows[1]).toStartWith(`${(rows[1] ?? '').split(',')[0]},"Login, ""SSO"" flow",`)
    // A title that starts with = is text, never a formula.
    expect(rows[2]).toContain(`"'=HYPERLINK(""http://evil.test"")"`)
    expect(rows[3]).toContain(`"'=HYPERLINK(""http://evil.test"")"`)
    expect(rows.slice(1).map((row) => row.includes(',5,agreed,'))).toEqual([true, false, false])
  })

  test('Markdown renders the summary as one table, and the open topic shows its most played card', async () => {
    const response = await read(played.slug, 'summary', 'markdown', played.zed.welcome.seatToken)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    const rows = (await response.text()).trimEnd().split('\n')
    expect(rows[0]).toBe('| Topic | Final | Spread | Rounds | Duration |')
    expect(rows[1]).toMatch(/^\| - \| - \| - \| - \| - \|$/)
    expect(rows[2]).toMatch(/^\| Login, "SSO" flow \| 5 \| 5 \| 1 \| \d+s \|$/)
    expect(rows[3]).toMatch(
      /^\| =HYPERLINK\("http:\/\/evil.test"\) \| 3 \(open\) \| 3–5 \| 2 \| \d+s \|$/,
    )
    expect(rows[4]).toMatch(/^\| Total: 1 of 2 decided \| 5 \| {2}\| 3 \| \d+s \|$/)
    expect(rows).toHaveLength(5)
  })

  test('the summary in JSON and CSV agrees', async () => {
    const json = (await (
      await read(played.slug, 'summary', 'json', played.zed.welcome.seatToken)
    ).json()) as {
      topics: Record<string, unknown>[]
      totals: Record<string, unknown>
    }
    expect(json.topics[0]).toMatchObject({
      final: { label: '5', value: 5, decidedBy: 'agreed' },
      open: false,
      spread: { lowest: 5, highest: 5 },
      rounds: 1,
    })
    expect(json.topics[1]).toMatchObject({
      final: null,
      open: true,
      leading: { label: '3', value: 3, count: 1 },
      spread: { lowest: 3, highest: 5 },
      rounds: 2,
    })
    expect(json.totals).toMatchObject({ topics: 2, decided: 1, rounds: 3, points: 5 })
    const csv = lines(
      await (await read(played.slug, 'summary', 'csv', played.zed.welcome.seatToken)).text(),
    )
    expect(csv[0]).toBe(SUMMARY_CSV_COLUMNS.join(','))
    expect(csv).toHaveLength(4)
  })

  test('a spectator may read', async () => {
    const response = await read(played.slug, 'summary', 'json', played.sam.welcome.seatToken)
    expect(response.status).toBe(200)
  })

  test('no participant name and no single seat vote leave in any format', async () => {
    const token = played.zed.welcome.seatToken
    for (const route of ['topics', 'summary'] as const)
      for (const format of ['json', 'csv', 'markdown']) {
        const text = await (await read(played.slug, route, format, token)).text()
        expect(text).not.toContain(MARKER)
        expect(text).not.toContain('Bob')
        expect(text).not.toContain('Sam')
        expect(text).not.toMatch(/"(seat|votes|vote|name)":\s*[^{]*?"(Bob|Sam)"/)
        expect(text).not.toMatch(/"(seat|votes)"/)
      }
  })

  test('a malformed address is 400, an unknown one 404, an unknown format 400', async () => {
    const token = played.zed.welcome.seatToken
    for (const route of ['topics', 'summary'] as const) {
      const bad = await api.http(`/rooms/Not%20A%20Slug/${route}`, { headers: auth(token) })
      expect([bad.status, await bad.json()]).toEqual([400, { error: 'invalid_slug' }])
      const unknown = await api.http(`/rooms/900002/${route}`, { headers: auth(token) })
      expect([unknown.status, await unknown.json()]).toEqual([404, { error: 'unknown_room' }])
      const format = await read(played.slug, route, 'xml', token)
      expect([format.status, await format.json()]).toEqual([400, { error: 'invalid_format' }])
    }
  })
})

describe('who may read', () => {
  test('no header, another room, a malformed header and a voided seat are 403 not_seated', async () => {
    const slug = await createRoom(api)
    const other = await createRoom(api)
    const alice = track(await join(api.ws(slug), { name: 'Alice' }))
    const bob = track(await join(api.ws(slug), { name: 'Bob' }))
    const olga = track(await join(api.ws(other), { name: 'Olga' }))
    const voided = await api.http(`/rooms/${slug}/access`, {
      method: 'PUT',
      body: JSON.stringify({ access: 'locked', code: 'new-word', signOut: true }),
      headers: auth(alice.welcome.seatToken),
    })
    expect(voided.status).toBe(200)
    const cases: [string, Record<string, string>][] = [
      ['no header', {}],
      ['a scheme that is not Bearer', { authorization: 'Basic abc' }],
      ['a token of another room', auth(olga.welcome.seatToken)],
      ['a voided seat', auth(bob.welcome.seatToken)],
    ]
    for (const route of ['topics', 'summary'])
      for (const [why, headers] of cases) {
        const response = await api.http(`/rooms/${slug}/${route}`, { headers })
        expect([why, response.status, await response.json()]).toEqual([
          why,
          403,
          { error: 'not_seated' },
        ])
      }
  })
})

describe('rounds from v1', () => {
  test("a round with only v1's summary renders without a distribution", async () => {
    const slug = await createRoom(api)
    const alice = track(await join(api.ws(slug), { name: 'Alice' }))
    const roomId = await roomIdOf(db, slug)
    const topicId = crypto.randomUUID()
    await db.db.execute(sql`
      INSERT INTO fpp.topic (id, room_id, position, state)
      VALUES (${topicId}, ${roomId}, 50, 'done')`)
    await db.db.execute(sql`
      INSERT INTO fpp.round (id, room_id, topic_id, no, attempt, deck, started_at, revealed_at, players, spectators,
                             distribution, consensus, auto_reveal, summary)
      VALUES (${crypto.randomUUID()}, ${roomId}, ${topicId}, 100, 1, '{"id":"fibonacci"}'::jsonb,
              '2024-03-01T10:00:00Z', '2024-03-01T10:01:30Z', 5, 1, '[]'::jsonb, false, true,
              '{"average":5.4,"lowest":2,"highest":13,"count":5}'::jsonb)`)
    const token = alice.welcome.seatToken
    const body = (await (await read(slug, 'topics', 'json', token)).json()) as {
      topics: { position: number; rounds: Record<string, unknown>[] }[]
    }
    const imported = body.topics.find((topic) => topic.position === 50)
    expect(imported?.rounds[0]).toMatchObject({
      result: {
        round: { no: 100, deck: 'fibonacci', voters: 5, consensus: false, distribution: [] },
      },
      summary: { average: 5.4, lowest: 2, highest: 13, count: 5 },
      figures: { lowest: 2, highest: 13, average: 5.4 },
      autoReveal: true,
    })
    const summary = (await (await read(slug, 'summary', 'json', token)).json()) as {
      topics: { position: number }[]
    }
    expect(summary.topics.find((topic) => topic.position === 50)).toMatchObject({
      leading: null,
      spread: { lowest: 2, highest: 13 },
      rounds: 1,
      durationSeconds: 90,
    })
    const md = await (await read(slug, 'summary', 'markdown', token)).text()
    expect(md).toContain('| (untitled) | open | 2–13 | 1 | 1m 30s |')
  })
})

describe('a full room', () => {
  test('200 topics and 1,000 rounds answer in every format well inside a second', async () => {
    const slug = await createRoom(api)
    const alice = track(await join(api.ws(slug), { name: 'Alice' }))
    const roomId = await roomIdOf(db, slug)
    await db.db.execute(sql`
      INSERT INTO fpp.topic (id, room_id, position, title, state)
      SELECT gen_random_uuid(), ${roomId}, 100 + g, 'Topic ' || g, 'done' FROM generate_series(1, 200) g`)
    await db.db.execute(sql`
      INSERT INTO fpp.round (id, room_id, topic_id, no, attempt, deck, started_at, revealed_at, players, spectators,
                             distribution, consensus, auto_reveal)
      SELECT gen_random_uuid(), ${roomId}, t.id, (t.position - 101) * 5 + a, a, '{"id":"fibonacci"}'::jsonb,
             now() - interval '1 minute', now(), 5, 1,
             '[{"label":"3","value":3,"count":3},{"label":"5","value":5,"count":2}]'::jsonb, false, false
      FROM fpp.topic t CROSS JOIN generate_series(1, 5) a
      WHERE t.room_id = ${roomId} AND t.position > 100`)
    expect(await count(sql`SELECT count(*) AS n FROM fpp.round WHERE room_id = ${roomId}`)).toBe(
      1000,
    )
    const token = alice.welcome.seatToken
    const measured: string[] = []
    for (const route of ['topics', 'summary'] as const)
      for (const format of ['json', 'csv', 'markdown']) {
        const began = performance.now()
        const response = await read(slug, route, format, token)
        const text = await response.text()
        const took = Math.round(performance.now() - began)
        measured.push(`${route} ${format} ${took} ms, ${Math.round(text.length / 1024)} KiB`)
        expect(response.status).toBe(200)
        expect(took).toBeLessThan(1000)
      }
    console.log(`history of 200 topics and 1,000 rounds: ${measured.join('; ')}`)
  })
})
