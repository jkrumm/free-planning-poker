import { NextResponse } from "next/server";
import { withLogger } from "fpp/utils/api-logger.util";
import { type AxiomRequest } from "next-axiom";
import { logEndpoint } from "fpp/constants/logging.constant";
import { MethodNotAllowedError } from "fpp/constants/error.constant";
import db from "fpp/server/db";
import { rooms } from "fpp/server/db/schema";
import { sql } from "drizzle-orm";

export const config = {
  runtime: "edge",
};

const GetRooms = withLogger(async (req: AxiomRequest) => {
  req.log.with({ endpoint: logEndpoint.GET_ROOMS });

  if (req.method !== "GET") {
    throw new MethodNotAllowedError("GET_ROOMS only accepts GET requests");
  }

  const activeRooms = (
    await db
      .select({ name: rooms.name })
      .from(rooms)
      .where(sql`${rooms.lastUsedAt} >= datetime('now', '-1 hour')`)
  ).map((row) => row.name);

  const usedRooms = (
    await db
      .select({ name: rooms.name })
      .from(rooms)
      .where(sql`${rooms.lastUsedAt} >= datetime('now', '-4 hour')`)
  ).map((row) => row.name);

  return NextResponse.json({ activeRooms, usedRooms }, { status: 200 });
});

export default GetRooms;
