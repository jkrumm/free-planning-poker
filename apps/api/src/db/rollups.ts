/**
 * The daily rollup behind the public statistics (docs/v9/ARCHITECTURE.md, Data model: `stat_daily`): one UTC day is
 * computed from `round`, `round_vote`, `room` and `visitor_day`, and the rows the job owns for that day are replaced
 * in one transaction, so a day computed twice leaves the same rows. `readStats` answers the public figures from the
 * rollups alone. The metric names are in `stat-metrics.ts`.
 */
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm'
import type { Db, Executor } from './client.ts'
import { statDaily } from './schema.ts'
import { addDays, type DayRange, mondayOf, workingWeeks } from './stat-calendar.ts'
import { CUSTOM_DECK, cardDimension, hourDimension, JOB_METRICS, METRIC } from './stat-metrics.ts'
import { rowsOf } from './sql.ts'

export type StatRow = {
  readonly metric: string
  readonly dimension: string
  readonly value: number
}

/** The two-integer key of the rollup's advisory lock: this application's namespace, then the job. */
const LOCK_NAMESPACE = 1_718_775_904
const LOCK_ROLLUP = 1

/** From midnight UTC of `day` up to, not including, midnight UTC of the next: independent of the session's time zone. */
const span = (day: string) => ({
  from: sql`(${day}::date)::timestamp AT TIME ZONE 'UTC'`,
  to: sql`((${day}::date + 1)::timestamp AT TIME ZONE 'UTC')`,
})

/**
 * A jsonb column read as the array or object it holds. Drizzle's jsonb column on Bun's driver stores what it is given as
 * a JSON string (`jsonb_typeof` is `string`), so a stored round's `deck` and `distribution` are usually that; the
 * statement accepts both, and is right again if the writer is ever fixed.
 */
const unwrapped = (column: SQL) =>
  sql`(CASE WHEN jsonb_typeof(${column}) = 'string' THEN (${column} #>> '{}')::jsonb ELSE ${column} END)`

const num = (value: unknown): number => Number(value ?? 0)

/** Every metric the job owns for one day, from the stored history. A day always has the scalar rows, a zero included. */
export async function computeDay(db: Executor, day: string): Promise<StatRow[]> {
  const { from, to } = span(day)
  const query = async (statement: SQL) =>
    rowsOf<Record<string, unknown>>(await db.execute(statement))
  const [rounds = {}] = await query(sql`
    SELECT count(*) AS rounds, count(*) FILTER (WHERE consensus) AS consensus, count(DISTINCT room_id) AS rooms
    FROM fpp.round WHERE revealed_at >= ${from} AND revealed_at < ${to}`)
  const hours = await query(sql`
    SELECT extract(hour FROM revealed_at AT TIME ZONE 'UTC')::int AS hour, count(*) AS rounds
    FROM fpp.round WHERE revealed_at >= ${from} AND revealed_at < ${to} GROUP BY 1`)
  const [votes = {}] = await query(sql`
    SELECT count(*) AS votes FROM fpp.round_vote v JOIN fpp.round r ON r.id = v.round_id
    WHERE r.revealed_at >= ${from} AND r.revealed_at < ${to}`)
  const cards = await query(sql`
    SELECT ${unwrapped(sql`r.deck`)}->>'id' AS deck, e->>'label' AS label, sum((e->>'count')::int) AS votes
    FROM fpp.round r, jsonb_array_elements(${unwrapped(sql`r.distribution`)}) AS e
    WHERE r.revealed_at >= ${from} AND r.revealed_at < ${to} GROUP BY 1, 2`)
  const [created = {}] = await query(sql`
    SELECT count(*) AS rooms FROM fpp.room
    WHERE origin = 'v9' AND created_at >= ${from} AND created_at < ${to}`)
  const [devices = {}] = await query(sql`
    SELECT count(*) AS estimators,
           count(*) FILTER (WHERE NOT EXISTS (
             SELECT 1 FROM fpp.visitor_day p WHERE p.visitor = v.visitor AND p.day < v.day)) AS fresh
    FROM fpp.visitor_day v WHERE v.day = ${day}::date`)
  const out: StatRow[] = [
    { metric: METRIC.rounds, dimension: '', value: num(rounds.rounds) },
    { metric: METRIC.votes, dimension: '', value: num(votes.votes) },
    { metric: METRIC.roundsConsensus, dimension: '', value: num(rounds.consensus) },
    { metric: METRIC.roomsCreated, dimension: '', value: num(created.rooms) },
    { metric: METRIC.roomsActive, dimension: '', value: num(rounds.rooms) },
    { metric: METRIC.estimators, dimension: '', value: num(devices.estimators) },
    { metric: METRIC.estimatorsNew, dimension: '', value: num(devices.fresh) },
  ]
  for (const hour of hours)
    out.push({
      metric: METRIC.roundsByHour,
      dimension: hourDimension(num(hour.hour)),
      value: num(hour.rounds),
    })
  const cardTotals = new Map<string, number>()
  for (const card of cards) {
    const dimension = cardDimension(String(card.deck), String(card.label))
    cardTotals.set(dimension, (cardTotals.get(dimension) ?? 0) + num(card.votes))
  }
  for (const [dimension, value] of cardTotals)
    out.push({ metric: METRIC.cardVotes, dimension, value })
  return out.toSorted(
    (a, b) => a.metric.localeCompare(b.metric) || a.dimension.localeCompare(b.dimension),
  )
}

/** Replaces the rows the job owns for `day`; rows of another owner stay. Run it inside a transaction. */
export async function replaceDay(
  tx: Executor,
  args: { readonly day: string; readonly rows: readonly StatRow[] },
): Promise<void> {
  await tx
    .delete(statDaily)
    .where(and(eq(statDaily.day, args.day), inArray(statDaily.metric, [...JOB_METRICS])))
  if (args.rows.length === 0) return
  await tx.insert(statDaily).values(args.rows.map((row) => ({ ...row, day: args.day })))
}

export type ComputeDay = (db: Executor, day: string) => Promise<StatRow[]>

/**
 * Rolls one day in one transaction, under an advisory lock so that two API containers overlapping in a handoff do not
 * both work: the one that cannot take the lock returns `false` at once and does nothing.
 */
export async function rollupDay(
  db: Db,
  args: { readonly day: string; readonly compute?: ComputeDay },
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [lock] = rowsOf<{ locked: boolean }>(
      await tx.execute(
        sql`SELECT pg_try_advisory_xact_lock(${LOCK_NAMESPACE}, ${LOCK_ROLLUP}) AS locked`,
      ),
    )
    if (lock?.locked !== true) return false
    const rows = await (args.compute ?? computeDay)(tx, args.day)
    await replaceDay(tx, { day: args.day, rows })
    return true
  })
}

/**
 * The first day a tick rolls: the latest day that has a `rounds` row (rolled again, as it may be half done), else the
 * first day any source holds, else today. Days after it up to today are rolled one by one, so a stopped job catches up and
 * on the first tick of a new day yesterday is rolled once more. Days the importer filled are older and stay as they are.
 */
export async function firstDayToRoll(db: Executor, today: string): Promise<string> {
  const [rolled] = rowsOf<{ day: string | null }>(
    await db.execute(sql`
      SELECT max(day)::text AS day FROM fpp.stat_daily
      WHERE metric = ${METRIC.rounds} AND dimension = '' AND day <= ${today}::date`),
  )
  if (typeof rolled?.day === 'string') return rolled.day
  const [first] = rowsOf<{ day: string | null }>(
    await db.execute(sql`
      SELECT least(
        (SELECT (min(revealed_at) AT TIME ZONE 'UTC')::date FROM fpp.round),
        (SELECT min(day) FROM fpp.visitor_day),
        (SELECT (min(created_at) AT TIME ZONE 'UTC')::date FROM fpp.room WHERE origin = 'v9')
      )::text AS day`),
  )
  const day = first?.day ?? today
  return day < today ? day : today
}

/** Weeks of the `weeks` list, and the days of the heatmap and the week-over-week figures. */
export const WEEKS_SHOWN = 52

export type WeekFigures = {
  readonly rounds: number
  readonly votes: number
  readonly roomsCreated: number
}
export type WeekOverWeek = {
  readonly workingDays: number
  readonly current: DayRange & WeekFigures
  readonly previous: DayRange & WeekFigures
  /** Relative change, `(current - previous) / previous`; null when the previous span has none. */
  readonly change: { readonly [K in keyof WeekFigures]: number | null }
}

export type RolledStats = {
  readonly totals: WeekFigures & { readonly consensusRounds: number }
  readonly consensusRate: number | null
  readonly weeks: { week: string; rounds: number; consensus: number }[]
  readonly cards: { deck: string; label: string; votes: number }[]
  readonly heatmap: { weekday: number; hour: number; rounds: number }[]
  readonly weekOverWeek: WeekOverWeek
}

const figures = (
  rows: readonly { day: string; metric: string; value: number }[],
  range: DayRange,
) => {
  const sum = (metric: string) =>
    rows
      .filter((row) => row.metric === metric && row.day >= range.from && row.day <= range.to)
      .reduce((total, row) => total + row.value, 0)
  return {
    ...range,
    rounds: sum(METRIC.rounds),
    votes: sum(METRIC.votes),
    roomsCreated: sum(METRIC.roomsCreated),
  }
}

const change = (current: number, previous: number): number | null =>
  previous === 0 ? null : (current - previous) / previous

/** The public figures, from `stat_daily` only. `today` is the UTC day the answer is for. */
export async function readStats(
  db: Executor,
  args: { readonly today: string },
): Promise<RolledStats> {
  const firstWeek = addDays(mondayOf(args.today), -7 * (WEEKS_SHOWN - 1))
  const spans = workingWeeks(args.today)
  const query = async (statement: SQL) =>
    rowsOf<Record<string, unknown>>(await db.execute(statement))
  const totals = await query(sql`
    SELECT metric, sum(value) AS value FROM fpp.stat_daily
    WHERE dimension = '' AND metric IN (${METRIC.rounds}, ${METRIC.votes}, ${METRIC.roomsCreated}, ${METRIC.roundsConsensus})
    GROUP BY metric`)
  const weekly = await query(sql`
    SELECT to_char(date_trunc('week', day::timestamp), 'YYYY-MM-DD') AS week, metric, sum(value) AS value
    FROM fpp.stat_daily
    WHERE dimension = '' AND metric IN (${METRIC.rounds}, ${METRIC.roundsConsensus}) AND day >= ${firstWeek}::date
    GROUP BY 1, 2`)
  const cards = await query(sql`
    SELECT split_part(dimension, '/', 1) AS deck, substr(dimension, strpos(dimension, '/') + 1) AS label, sum(value) AS value
    FROM fpp.stat_daily WHERE metric = ${METRIC.cardVotes} GROUP BY dimension`)
  const heat = await query(sql`
    SELECT extract(isodow FROM day)::int AS weekday, dimension AS hour, sum(value) AS value
    FROM fpp.stat_daily WHERE metric = ${METRIC.roundsByHour} AND day >= ${firstWeek}::date
    GROUP BY 1, 2`)
  const recent = await query(sql`
    SELECT day::text AS day, metric, value FROM fpp.stat_daily
    WHERE dimension = '' AND metric IN (${METRIC.rounds}, ${METRIC.votes}, ${METRIC.roomsCreated})
      AND day >= ${spans.previous.from}::date AND day <= ${spans.current.to}::date`)

  const total = (metric: string) => num(totals.find((row) => row.metric === metric)?.value)
  const rounds = total(METRIC.rounds)
  const consensusRounds = total(METRIC.roundsConsensus)

  const weeks = Array.from({ length: WEEKS_SHOWN }, (_, index) => {
    const week = addDays(firstWeek, 7 * index)
    const of = (metric: string) =>
      num(weekly.find((row) => row.week === week && row.metric === metric)?.value)
    return { week, rounds: of(METRIC.rounds), consensus: of(METRIC.roundsConsensus) }
  })

  const heatmap = Array.from({ length: 7 * 24 }, (_, index) => {
    const weekday = Math.floor(index / 24) + 1
    const hour = index % 24
    const key = hourDimension(hour)
    const cell = heat.find((row) => num(row.weekday) === weekday && row.hour === key)
    return { weekday, hour, rounds: num(cell?.value) }
  })

  const recentRows = recent.map((row) => ({
    day: String(row.day),
    metric: String(row.metric),
    value: num(row.value),
  }))
  const current = figures(recentRows, spans.current)
  const previous = figures(recentRows, spans.previous)

  return {
    totals: {
      rounds,
      votes: total(METRIC.votes),
      roomsCreated: total(METRIC.roomsCreated),
      consensusRounds,
    },
    consensusRate: rounds === 0 ? null : consensusRounds / rounds,
    weeks,
    cards: cards
      .filter((row) => row.label !== '' && row.deck !== CUSTOM_DECK)
      .map((row) => ({ deck: String(row.deck), label: String(row.label), votes: num(row.value) }))
      .toSorted(
        (a, b) =>
          a.deck.localeCompare(b.deck) || b.votes - a.votes || a.label.localeCompare(b.label),
      ),
    heatmap,
    weekOverWeek: {
      workingDays: spans.workingDays,
      current,
      previous,
      change: {
        rounds: change(current.rounds, previous.rounds),
        votes: change(current.votes, previous.votes),
        roomsCreated: change(current.roomsCreated, previous.roomsCreated),
      },
    },
  }
}
