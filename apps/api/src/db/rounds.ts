import { asc, eq, sql } from 'drizzle-orm'
import type { Executor } from './client.ts'
import { round, roundVote, topic } from './schema.ts'
import { rowsOf } from './sql.ts'
import type { TopicRow } from './topics.ts'

export type RoundRow = typeof round.$inferSelect
export type RoundVoteRow = typeof roundVote.$inferSelect
export type RoundInput = typeof round.$inferInsert
/** A seat is an index in the room, never a name. `value` is null for a card with no number. */
export type VoteInput = Omit<typeof roundVote.$inferInsert, 'roundId'>

/**
 * Inserts a revealed round and one row per voting seat in one transaction: all of it, or none. A round whose id is
 * already stored is left as it is, so a write retried after a lost answer stores it once.
 */
export async function insertRound(
  db: Executor,
  args: { readonly round: RoundInput; readonly votes: readonly VoteInput[] },
): Promise<void> {
  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(round)
      .values(args.round)
      .onConflictDoNothing({ target: round.id })
      .returning({ id: round.id })
    if (inserted.length === 0 || args.votes.length === 0) return
    await tx
      .insert(roundVote)
      .values(args.votes.map((vote) => ({ ...vote, roundId: args.round.id })))
  })
}

/** Where a room's numbering stands: its highest round number, and the latest round of each topic asked for. */
export async function roundCounters(
  db: Executor,
  args: { readonly roomId: number; readonly topicIds: readonly string[] },
): Promise<{ no: number; latest: Map<string, { id: string; attempt: number }> }> {
  const [highest] = rowsOf<{ no: number | string | null }>(
    await db.execute(sql`SELECT max(no) AS no FROM fpp.round WHERE room_id = ${args.roomId}`),
  )
  const latest = new Map<string, { id: string; attempt: number }>()
  if (args.topicIds.length > 0) {
    const ids = sql.join(
      args.topicIds.map((id) => sql`${id}`),
      sql`, `,
    )
    const rows = rowsOf<{ topic_id: string; id: string; attempt: number | string }>(
      await db.execute(sql`
        SELECT DISTINCT ON (topic_id) topic_id, id, attempt FROM fpp.round
        WHERE room_id = ${args.roomId} AND topic_id IN (${ids})
        ORDER BY topic_id, attempt DESC`),
    )
    for (const row of rows) latest.set(row.topic_id, { id: row.id, attempt: Number(row.attempt) })
  }
  return { no: Number(highest?.no ?? 0), latest }
}

export type TopicWithRounds = TopicRow & { rounds: (RoundRow & { votes: RoundVoteRow[] })[] }

/** A room's topics in queue order, each with its rounds (by number) and their votes (by seat). */
export async function listTopics(
  db: Executor,
  args: { readonly roomId: number },
): Promise<TopicWithRounds[]> {
  const [topics, rounds, votes] = await Promise.all([
    db
      .select()
      .from(topic)
      .where(eq(topic.roomId, args.roomId))
      .orderBy(asc(topic.position), asc(topic.createdAt), asc(topic.id)),
    db.select().from(round).where(eq(round.roomId, args.roomId)).orderBy(asc(round.no)),
    db
      .select({ vote: roundVote })
      .from(roundVote)
      .innerJoin(round, eq(round.id, roundVote.roundId))
      .where(eq(round.roomId, args.roomId))
      .orderBy(asc(roundVote.seat)),
  ])
  const votesOf = new Map<string, RoundVoteRow[]>()
  for (const { vote } of votes)
    votesOf.set(vote.roundId, [...(votesOf.get(vote.roundId) ?? []), vote])
  const roundsOf = new Map<string, TopicWithRounds['rounds']>()
  for (const row of rounds) {
    const entry = { ...row, votes: votesOf.get(row.id) ?? [] }
    roundsOf.set(row.topicId, [...(roundsOf.get(row.topicId) ?? []), entry])
  }
  return topics.map((row) => ({ ...row, rounds: roundsOf.get(row.id) ?? [] }))
}
