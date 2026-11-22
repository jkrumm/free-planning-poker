import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import type { Executor } from './client.ts'
import { topic } from './schema.ts'
import { rowsOf } from './sql.ts'

export type TopicRow = typeof topic.$inferSelect
export type TopicState = TopicRow['state']

/**
 * One topic of a queue. The id is a UUID v7 minted by the application. A field left out keeps its stored value on an
 * update and is empty on an insert; `null` clears it.
 */
export type TopicInput = {
  readonly id: string
  readonly position: number
  readonly title?: string
  readonly url?: string | null
  /** The tracker reference: provider, the tracker's stable id, the display key, and the site or workspace. */
  readonly source?: string | null
  readonly externalId?: string | null
  readonly externalKey?: string | null
  readonly externalSite?: string | null
  readonly state?: TopicState
}

/**
 * Writes a room's topics with their order, in one transaction. A topic whose id exists is updated. A new one whose
 * tracker reference (room, provider, site, and the tracker's id or else its key) is already in the room updates that
 * topic instead of adding one, keeping its place and state, so the same import can run twice. Returns the stored id
 * and position of each input, in order.
 */
export async function upsertTopics(
  db: Executor,
  args: { readonly roomId: number; readonly topics: readonly TopicInput[] },
): Promise<{ id: string; position: number }[]> {
  return db.transaction(async (tx) => {
    const stored: { id: string; position: number }[] = []
    for (const input of args.topics) {
      const [updated] = await tx
        .update(topic)
        .set({
          position: input.position,
          title: input.title,
          url: input.url,
          source: input.source,
          externalId: input.externalId,
          externalKey: input.externalKey,
          externalSite: input.externalSite,
          state: input.state,
        })
        .where(and(eq(topic.id, input.id), eq(topic.roomId, args.roomId)))
        .returning({ id: topic.id, position: topic.position })
      if (updated) {
        stored.push(updated)
        continue
      }
      const rows = rowsOf<{ id: string; position: number }>(
        await tx.execute(sql`
          INSERT INTO fpp.topic
            (id, room_id, position, title, url, source, external_id, external_key, external_site, state)
          VALUES (${input.id}, ${args.roomId}, ${input.position}, ${input.title ?? ''}, ${input.url ?? null},
                  ${input.source ?? null}, ${input.externalId ?? null}, ${input.externalKey ?? null},
                  ${input.externalSite ?? null}, ${input.state ?? 'queued'})
          ON CONFLICT (room_id, coalesce(source, ''), coalesce(external_site, ''), coalesce(external_id, external_key))
            WHERE coalesce(external_id, external_key) IS NOT NULL
          DO UPDATE SET title = CASE WHEN EXCLUDED.title = '' THEN fpp.topic.title ELSE EXCLUDED.title END,
                        url = coalesce(EXCLUDED.url, fpp.topic.url),
                        external_key = coalesce(EXCLUDED.external_key, fpp.topic.external_key)
          RETURNING id, position`),
      )
      const row = rows[0]
      if (!row) throw new Error('topic upsert returned no row')
      stored.push({ id: row.id, position: Number(row.position) })
    }
    return stored
  })
}

/** Records the value a team settled on for a topic. A `null` value is a card with no number (`?`, break). */
export async function recordDecision(
  db: Executor,
  args: {
    readonly roomId: number
    readonly topicId: string
    readonly finalLabel: string
    readonly finalValue: number | null
    readonly decidedBy: string
    readonly decidedAt: Date
  },
): Promise<boolean> {
  const rows = await db
    .update(topic)
    .set({
      finalLabel: args.finalLabel,
      finalValue: args.finalValue,
      decidedBy: args.decidedBy,
      decidedAt: args.decidedAt,
    })
    .where(and(eq(topic.id, args.topicId), eq(topic.roomId, args.roomId)))
    .returning({ id: topic.id })
  return rows.length > 0
}

/** The room's queue as a cold start needs it: topics still `queued` or `active`, in order. */
export async function loadOpenTopics(
  db: Executor,
  args: { readonly roomId: number },
): Promise<TopicRow[]> {
  return db
    .select()
    .from(topic)
    .where(and(eq(topic.roomId, args.roomId), inArray(topic.state, ['queued', 'active'])))
    .orderBy(asc(topic.position), asc(topic.createdAt), asc(topic.id))
}
