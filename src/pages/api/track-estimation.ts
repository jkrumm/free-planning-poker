import { NextResponse, userAgent } from "next/server";
import {
  BadRequestError,
  MethodNotAllowedError,
} from "fpp/constants/error.constant";
import { type AxiomRequest } from "next-axiom";
import { withLogger } from "fpp/utils/api-logger.util";
import { decodeBlob } from "fpp/utils/decode.util";
import { logEndpoint } from "fpp/constants/logging.constant";
import { fibonacciSequence } from "fpp/constants/fibonacci.constant";
import { findUserById } from "fpp/utils/db-api.util";
import { estimations } from "fpp/server/db/schema";
import db from "fpp/server/db/db";

export const runtime = "edge";
export const preferredRegion = "fra1";

const TrackEstimation = withLogger(async (req: AxiomRequest) => {
  req.log.with({ endpoint: logEndpoint.TRACK_ESTIMATION });
  if (req.method !== "POST") {
    throw new MethodNotAllowedError(
      "TRACK_ESTIMATION only accepts POST requests",
    );
  }

  const { userId, roomId, estimation, spectator } = await decodeBlob<{
    userId: string | null;
    roomId: number;
    estimation: number | null;
    spectator: boolean;
  }>(req);
  req.log.with({ userId, roomId, estimation, spectator });
  validateInput({ userId, roomId, estimation, spectator });

  if (userAgent(req).isBot) {
    req.log.with({ isBot: true });
    return NextResponse.json({}, { status: 200 });
  }

  const user = await findUserById(userId);

  await db.insert(estimations).values({
    userId: user.id,
    roomId,
    estimation,
    spectator,
  });

  return NextResponse.json({}, { status: 200 });
});

const validateInput = ({
  userId,
  roomId,
  estimation,
  spectator,
}: {
  userId: string | null;
  roomId: number;
  estimation: number | null;
  spectator: boolean;
}): void => {
  if (!userId || userId.length !== 21) {
    throw new BadRequestError("invalid userId");
  }

  if (!roomId) {
    throw new BadRequestError("no roomId provided");
  }

  if (!estimation && !spectator) {
    throw new BadRequestError("estimation or spectator is required");
  }

  if (estimation && !fibonacciSequence.includes(estimation)) {
    throw new BadRequestError("estimation not in fibonacci sequence");
  }
};

export default TrackEstimation;
