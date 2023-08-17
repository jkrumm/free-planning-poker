import { NextResponse } from "next/server";
import { withLogger } from "fpp/utils/api-logger.util";
import { type AxiomRequest } from "next-axiom";
import { logEndpoint } from "fpp/constants/logging.constant";
import { MethodNotAllowedError } from "fpp/constants/error.constant";
import { connect } from "@planetscale/database";
import { env } from "fpp/env.mjs";

export const config = {
  runtime: "edge",
  regions: ["fra1"],
};

const GetRooms = withLogger(async (req: AxiomRequest) => {
  req.log.with({ endpoint: logEndpoint.GET_ROOMS });

  if (req.method !== "GET") {
    throw new MethodNotAllowedError("ABLY_TOKEN only accepts GET requests");
  }

  const conn = connect({
    url: env.DATABASE_URL,
  });

  const activeRoomsRows = (
    await conn.execute(
      "SELECT name FROM Room WHERE lastUsed > DATE_SUB(NOW(), INTERVAL 1 HOUR);"
    )
  ).rows as { name: string }[];
  const activeRooms = activeRoomsRows.map((row) => row.name);

  const usedRoomsRows = (
    await conn.execute(
      "SELECT name FROM Room WHERE lastUsed > DATE_SUB(NOW(), INTERVAL 4 HOUR);"
    )
  ).rows as { name: string }[];
  const usedRooms = usedRoomsRows.map((row) => row.name);

  console.log({ activeRooms, usedRooms });

  return NextResponse.json({ activeRooms, usedRooms }, { status: 200 });
});

export default GetRooms;
