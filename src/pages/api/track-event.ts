import { NextResponse, userAgent } from "next/server";
import { env } from "fpp/env.mjs";
import { connect } from "@planetscale/database";
import { EventType } from "@prisma/client";
import {
  BadRequestError,
  MethodNotAllowedError,
} from "fpp/constants/error.constant";
import { type AxiomRequest } from "next-axiom";
import { withLogger } from "fpp/utils/api-logger.util";
import { decodeBlob } from "fpp/utils/decode.util";
import { logEndpoint } from "fpp/constants/logging.constant";
import { findVisitorById } from "fpp/utils/db-api.util";

export const config = {
  runtime: "edge",
  regions: ["fra1"],
};

export const TrackEvent = withLogger(async (req: AxiomRequest) => {
  req.log.with({ endpoint: logEndpoint.TRACK_EVENT });
  if (req.method !== "POST") {
    throw new MethodNotAllowedError("TRACK_EVENT only accepts POST requests", {
      method: req.method,
    });
  }

  const { visitorId, event } = await decodeBlob<{
    visitorId: string;
    event: EventType;
  }>(req);
  req.log.with({ visitorId, event });
  validateInput({ visitorId, event });

  if (userAgent(req).isBot) {
    req.log.with({ isBot: true });
    return NextResponse.json({}, { status: 200 });
  }

  const conn = connect({
    url: env.DATABASE_URL,
  });

  const visitor = await findVisitorById(visitorId, conn);

  await conn.execute("INSERT INTO Event (visitorId, event) VALUES (?, ?);", [
    visitor.id,
    event,
  ]);

  return NextResponse.json({}, { status: 200 });
});

const validateInput = ({
  visitorId,
  event,
}: {
  visitorId: string;
  event: EventType;
}): void => {
  if (!visitorId || visitorId.length !== 36) {
    throw new BadRequestError("invalid visitorId");
  }

  if (EventType[event] === undefined) {
    throw new BadRequestError("invalid event type");
  }
};

export default TrackEvent;
