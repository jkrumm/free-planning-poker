import { BadRequestError, NotFoundError } from "fpp/constants/error.constant";
import { eq, type InferSelectModel, sql } from "drizzle-orm";
import { visitors } from "fpp/server/db/schema";
// import db from "fpp/server/db";
import { type SQLiteTable } from "drizzle-orm/sqlite-core";
import { type LibSQLDatabase } from "drizzle-orm/libsql";
import db from "fpp/server/db";

export async function findVisitorById(
  // db: LibSQLDatabase,
  visitorId: string | null,
): Promise<InferSelectModel<typeof visitors>> {
  if (!visitorId || visitorId.length !== 36) {
    throw new BadRequestError("invalid visitorId");
  }

  let visitor: InferSelectModel<typeof visitors> | null = null;
  if (visitorId) {
    visitor =
      (await db.select().from(visitors).where(eq(visitors.id, visitorId)))[0] ??
      null;
  }

  if (!visitor) {
    throw new NotFoundError("visitor not found");
  }

  return visitor;
}

export async function countTable(
  db: LibSQLDatabase<Record<string, unknown>>,
  table: SQLiteTable,
) {
  return Number(
    (await db.select({ count: sql<number>`count(*)` }).from(table))[0]?.count ??
      0,
  );
}
