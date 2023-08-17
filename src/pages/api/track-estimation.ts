import { NextResponse, userAgent } from "next/server";
import { env } from "fpp/env.mjs";
import { connect } from "@planetscale/database";
import {
  BadRequestError,
  MethodNotAllowedError,
} from "fpp/constants/error.constant";
import { type AxiomRequest } from "next-axiom";
import { withLogger } from "fpp/utils/api-logger.util";
import { decodeBlob } from "fpp/utils/decode.util";
import { logEndpoint } from "fpp/constants/logging.constant";
import { fibonacciSequence } from "fpp/constants/fibonacci.constant";
import { findVisitorById } from "fpp/utils/db-api.util";

export const config = {
  runtime: "edge",
  regions: ["fra1"],
};

const TrackEstimation = withLogger(async (req: AxiomRequest) => {
  req.log.with({ endpoint: logEndpoint.TRACK_ESTIMATION });
  if (req.method !== "POST") {
    throw new MethodNotAllowedError(
      "TRACK_ESTIMATION only accepts POST requests"
    );
  }

  const { visitorId, room, estimation, spectator } = await decodeBlob<{
    visitorId: string;
    room: string;
    estimation: number | null;
    spectator: boolean;
  }>(req);
  req.log.with({ visitorId, room, estimation, spectator });
  validateInput({ visitorId, room, estimation, spectator });

  if (userAgent(req).isBot) {
    req.log.with({ isBot: true });
    return NextResponse.json({}, { status: 200 });
  }

  const conn = connect({
    url: env.DATABASE_URL,
  });

  const visitor = await findVisitorById(visitorId, conn);

  await conn.execute(
    "INSERT INTO Estimation (visitorId, room, estimation, spectator) VALUES (?, ?, ?, ?);",
    [visitor.id, room, estimation, spectator]
  );

  return NextResponse.json({}, { status: 200 });
});

const validateInput = ({
  visitorId,
  room,
  estimation,
  spectator,
}: {
  visitorId: string;
  room: string;
  estimation: number | null;
  spectator: boolean;
}): void => {
  if (!visitorId || visitorId.length !== 36) {
    throw new BadRequestError("invalid visitorId");
  }

  const roomCleaned = room
    ? room.replace(/[^A-Za-z]/g, "").toLowerCase()
    : null;

  if (room && (room !== roomCleaned || room.length > 15 || room.length < 3)) {
    throw new BadRequestError("invalid room");
  }

  if (!estimation && !spectator) {
    throw new BadRequestError("estimation or spectator is required");
  }

  if (estimation && !fibonacciSequence.includes(estimation)) {
    throw new BadRequestError("estimation not in fibonacci sequence");
  }
};

export default TrackEstimation;
