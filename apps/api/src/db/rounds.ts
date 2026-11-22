import { asc, eq } from 'drizzle-orm'
import type { Executor } from './client.ts'
import { round, roundVote, topic } from './schema.ts'
import type { TopicRow } from './topics.ts'

export type RoundRow = typeof round.$inferSelect
export type RoundVoteRow = typeof roundVote.$inferSelect
export type RoundInput = typeof round.$inferInsert
/** A seat is an index in the room, never a name. `value` is null for a card with no number. */
export type VoteInput = Omit<typeof roundVote.$inferInsert, 'roundId'>

/** Inserts a revealed round and one row per voting seat in one transaction: all of it, or none. */
export async function insertRound(
  db: Executor,
  args: { readonly round: RoundInput; readonly votes: readonly VoteInput[] },
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(round).values(args.round)
    if (args.votes.length === 0) return
    await tx
      .insert(roundVote)
      .values(args.votes.map((vote) => ({ ...vote, roundId: args.round.id })))
  })
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
