/**
 * The one-time import of v1 (docs/v9/ARCHITECTURE.md, Data model: What comes over from v1; Cutover, step 2): reads a
 * `mariadb-dump` of v1, plans its rows for v9 (`plan.ts`) and writes them in batched transactions. A dry run by
 * default: it reads the target and writes nothing. A second apply finds every row and changes none. A target that
 * holds rooms of another origin is refused unless `allowOtherOrigins`. Every statement runs through `Database.run`
 * and waits out an outage with `retryWhileDown`; each batch is idempotent, so a retried one adds nothing twice.
 */
import { Data, Duration, Effect } from 'effect'
import type { Db } from '../../db/client.ts'
import { acquireDatabase, type Database, retryWhileDown } from '../../db/resilience.ts'
import { dumpStream } from './dump.ts'
import { type Plan, planImport, type PlannedRound, type PlannedSlug, type Skip } from './plan.ts'
import {
  advanceRoomIds,
  countRows,
  foreignRoomIds,
  heldAddresses,
  insertAddresses,
  insertRooms,
  insertRounds,
  insertTopics,
  insertVisitorDays,
  otherOriginRooms,
  retainedFrom,
  TARGET_TABLES,
  type TargetTable,
  upsertStats,
} from './target.ts'
import { readV1 } from './v1-reader.ts'

/** Rows per transaction; each batch stays far below Postgres's 65,535 parameters and `STATEMENT_TIMEOUT`. */
export const BATCH = { rooms: 1000, rounds: 1000, rows: 5000 } as const

export type ImportOptions = {
  /** The dump file (`Bun.file`); a name ending in `.gz` is gunzipped. */
  readonly dump: {
    readonly name?: string | undefined
    readonly stream: () => ReadableStream<Uint8Array>
  }
  readonly databaseUrl: string
  /** The API's `VISITOR_KEY`. */
  readonly visitorKey: string
  readonly apply: boolean
  readonly allowOtherOrigins: boolean
  /** The 13 months of `visitor_day` are counted back from this instant. */
  readonly now: Date
}

export type TableCount = {
  /** Rows the import holds for the table. */
  readonly planned: number
  /** Rows it added or, for `stat_daily`, changed: none in a dry run, none in a second apply. */
  readonly written: number
  readonly before: number
  readonly after: number
}

export type ImportReport = {
  readonly mode: 'dry-run' | 'apply'
  readonly dump: string
  readonly at: string
  /** The first day kept in `visitor_day`; earlier v1 days are in `stat_daily` only. */
  readonly retainedFrom: string
  /** The v1 days `stat_daily` covers. */
  readonly days: Plan['days']
  /** Rows read per v1 table; estimations that were no vote (a spectator's, or empty) are counted apart. */
  readonly source: Readonly<Record<string, number>>
  readonly estimationsNotVotes: number
  /** Votes with a value that is no card of v1's deck: in `votes`, never in `card_votes`. */
  readonly votesOffDeck: number
  readonly target: Readonly<Record<TargetTable, TableCount>>
  readonly skips: readonly Skip[]
  readonly phases: readonly { readonly phase: string; readonly ms: number }[]
}

/** The target holds rooms of another origin, and the caller did not allow it. */
export class ImportRefused extends Data.TaggedError('ImportRefused')<{ readonly rooms: number }> {}

/** The dump could not be read: not a v1 dump, not in UTC, or cut short. */
export class DumpUnreadable extends Data.TaggedError('DumpUnreadable')<{
  readonly cause: unknown
}> {}

const batches = <T>(rows: readonly T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

/** Drops from the plan what the target already gives to someone else, and says why. */
const checkTarget = (
  plan: Plan,
  run: <A>(work: (db: Db) => Promise<A>) => Effect.Effect<A, unknown>,
  foreign: boolean,
) =>
  Effect.gen(function* () {
    const skips: Skip[] = []
    const taken = new Set<number>()
    if (foreign)
      for (const batch of batches(plan.rooms, BATCH.rows)) {
        const ids = yield* run((db) =>
          foreignRoomIds(
            db,
            batch.map((room) => room.id),
          ),
        )
        for (const id of ids) {
          taken.add(id)
          skips.push({
            table: 'fpp_rooms',
            id,
            part: 'room',
            reason: 'its id is a v9 room of the target',
          })
        }
      }
    const slugs: PlannedSlug[] = []
    for (const batch of batches(plan.slugs, BATCH.rows)) {
      const held = yield* run((db) =>
        heldAddresses(
          db,
          batch.map((slug) => slug.slug),
        ),
      )
      for (const slug of batch) {
        if (taken.has(slug.roomId)) continue
        const holder = held.get(slug.slug)
        if (holder === undefined || holder === slug.roomId) slugs.push(slug)
        else
          skips.push({
            table: 'fpp_rooms',
            id: slug.v1Id,
            part: slug.kind,
            reason: `its ${slug.kind} is held in the target by room ${holder}`,
          })
      }
    }
    // A room whose name could not be carried shows its number.
    const primaries = new Set(slugs.filter((slug) => slug.primary).map((slug) => slug.roomId))
    for (const slug of slugs)
      if (slug.kind === 'number' && !primaries.has(slug.roomId)) {
        slug.primary = true
        primaries.add(slug.roomId)
      }
    const rounds: PlannedRound[] = plan.rounds.filter((round) => !taken.has(round.roomId))
    for (const round of plan.rounds)
      if (taken.has(round.roomId))
        skips.push({
          table: 'fpp_votes',
          id: round.v1Id,
          part: 'round',
          reason: `its room ${round.roomId} was not imported`,
        })
    return {
      ...plan,
      rooms: plan.rooms.filter((room) => !taken.has(room.id)),
      slugs,
      rounds,
      skips: [...plan.skips, ...skips],
    } satisfies Plan
  })

export const importV1 = (options: ImportOptions, database: Database) => {
  const run = <A>(work: (db: Db) => Promise<A>) => retryWhileDown(database.run(work))
  return Effect.gen(function* () {
    const phases: { phase: string; ms: number }[] = []
    const timed = <A, E>(phase: string, effect: Effect.Effect<A, E>) =>
      Effect.timed(effect).pipe(
        Effect.map(([duration, value]) => {
          phases.push({ phase, ms: Math.round(Duration.toMillis(duration)) })
          return value
        }),
      )

    const before = yield* run(countRows)
    const foreign = yield* run(otherOriginRooms)
    if (foreign > 0 && !options.allowOtherOrigins)
      return yield* new ImportRefused({ rooms: foreign })
    const retained = yield* run((db) => retainedFrom(db, options.now))

    const data = yield* timed(
      'read dump',
      Effect.tryPromise({
        try: () =>
          readV1(
            dumpStream({ name: options.dump.name ?? '', stream: () => options.dump.stream() }),
          ),
        catch: (cause) => new DumpUnreadable({ cause }),
      }),
    )
    const planned = yield* timed(
      'plan',
      Effect.sync(() =>
        planImport(data, { retainedFrom: retained, visitorKey: options.visitorKey }),
      ),
    )
    const plan = yield* timed('check target', checkTarget(planned, run, foreign > 0))

    const written: Record<TargetTable, number> = {
      room: 0,
      room_slug: 0,
      topic: 0,
      round: 0,
      round_vote: 0,
      visitor_day: 0,
      stat_daily: 0,
    }
    if (options.apply) {
      yield* timed(
        'write rooms and addresses',
        Effect.gen(function* () {
          const slugsOf = Map.groupBy(plan.slugs, (slug) => slug.roomId)
          for (const batch of batches(plan.rooms, BATCH.rooms)) {
            const slugs = batch.flatMap((room) => slugsOf.get(room.id) ?? [])
            const [rooms, addresses] = yield* run((db) =>
              db.transaction(
                async (tx) =>
                  [await insertRooms(tx, batch), await insertAddresses(tx, slugs)] as const,
              ),
            )
            written.room += rooms
            written.room_slug += addresses
          }
          yield* run(advanceRoomIds)
        }),
      )
      yield* timed(
        'write topics and rounds',
        Effect.gen(function* () {
          for (const batch of batches(plan.rounds, BATCH.rounds)) {
            const [topics, rounds] = yield* run((db) =>
              db.transaction(
                async (tx) =>
                  [await insertTopics(tx, batch), await insertRounds(tx, batch)] as const,
              ),
            )
            written.topic += topics
            written.round += rounds
          }
        }),
      )
      yield* timed(
        'write visitor days',
        Effect.gen(function* () {
          for (const batch of batches(plan.visitorDays, BATCH.rows))
            written.visitor_day += yield* run((db) => insertVisitorDays(db, batch))
        }),
      )
      yield* timed(
        'write daily statistics',
        Effect.gen(function* () {
          for (const batch of batches(plan.stats, BATCH.rows))
            written.stat_daily += yield* run((db) => upsertStats(db, batch))
        }),
      )
    }
    const after = yield* run(countRows)

    const planCount: Record<TargetTable, number> = {
      room: plan.rooms.length,
      room_slug: plan.slugs.length,
      topic: plan.rounds.length,
      round: plan.rounds.length,
      round_vote: 0,
      visitor_day: plan.visitorDays.length,
      stat_daily: plan.stats.length,
    }
    const target = Object.fromEntries(
      TARGET_TABLES.map((table) => [
        table,
        {
          planned: planCount[table],
          written: written[table],
          before: before[table],
          after: after[table],
        },
      ]),
    ) as Record<TargetTable, TableCount>
    return {
      mode: options.apply ? 'apply' : 'dry-run',
      dump: options.dump.name ?? '',
      at: options.now.toISOString(),
      retainedFrom: retained,
      days: plan.days,
      source: data.read,
      estimationsNotVotes: data.notVotes,
      votesOffDeck: plan.offDeckVotes,
      target,
      skips: plan.skips.toSorted(
        (a, b) => a.table.localeCompare(b.table) || a.id - b.id || a.part.localeCompare(b.part),
      ),
      phases,
    } satisfies ImportReport
  })
}

/** Runs the import on its own pool, closed when it ends. Rejects with `ImportRefused`, `DumpUnreadable` or a defect. */
export function runImport(options: ImportOptions): Promise<ImportReport> {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const database = yield* acquireDatabase({ url: options.databaseUrl, max: 2 })
        return yield* importV1(options, database)
      }),
    ),
  )
}

const pad = (value: string | number, width: number) => String(value).padStart(width)

/** The report as the command prints it: counts per source and target table, every skip with its reason, the phases. */
export function formatReport(report: ImportReport): string {
  const lines = [
    report.mode === 'apply'
      ? `v1 import: applied ${report.dump}`
      : `v1 import: dry run of ${report.dump}, nothing written (--apply writes)`,
    `days ${report.days === null ? 'none' : `${report.days.from} to ${report.days.to}`}; visitor_day from ${report.retainedFrom}`,
    '',
    `${'source'.padEnd(16)}${pad('rows', 10)}`,
    ...Object.entries(report.source).map(([table, rows]) => `${table.padEnd(16)}${pad(rows, 10)}`),
    `  of which estimations that were no vote: ${report.estimationsNotVotes}`,
    `  of which votes with a value off v1's deck, counted in no card: ${report.votesOffDeck}`,
    '',
    `${'target'.padEnd(16)}${pad('planned', 10)}${pad('written', 10)}${pad('before', 10)}${pad('after', 10)}`,
    ...TARGET_TABLES.map((table) => {
      const count = report.target[table]
      return `${table.padEnd(16)}${pad(count.planned, 10)}${pad(count.written, 10)}${pad(count.before, 10)}${pad(count.after, 10)}`
    }),
    '',
    `skipped: ${report.skips.length}`,
    ...report.skips.map((skip) => `  ${skip.table} ${skip.id} ${skip.part}: ${skip.reason}`),
    '',
    ...report.phases.map((phase) => `phase ${phase.phase}: ${phase.ms} ms`),
  ]
  return lines.join('\n')
}
