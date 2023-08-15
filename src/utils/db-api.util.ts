import { type Visitor } from "@prisma/client";
import { type Connection } from "@planetscale/database";
import { BadRequestError, NotFoundError } from "fpp/constants/error.constant";

export async function findVisitorById(
  visitorId: string | null,
  conn: Connection
): Promise<Visitor> {
  if (!visitorId || visitorId.length !== 36) {
    throw new BadRequestError("invalid visitorId");
  }

  let visitor: Visitor | null = null;
  if (visitorId) {
    const visitorQuery = await conn.execute(
      "SELECT * FROM Visitor WHERE id = ? LIMIT 1;",
      [visitorId]
    );
    visitor = visitorQuery.rows ? (visitorQuery.rows[0] as Visitor) : null;
  }

  if (!visitor) {
    throw new NotFoundError("visitor not found");
  }

  return visitor;
}
