import { NextResponse, userAgent } from "next/server";
import {
  BadRequestError,
  MethodNotAllowedError,
} from "fpp/constants/error.constant";
import { type AxiomRequest } from "next-axiom";
import { withLogger } from "fpp/utils/api-logger.util";
import { decodeBlob } from "fpp/utils/decode.util";
import { logEndpoint } from "fpp/constants/logging.constant";
import { findVisitorById } from "fpp/utils/db-api.util";
import { events, EventType } from "fpp/server/db/schema";
import db from "fpp/server/db";

export const config = {
  runtime: "edge",
};

const TrackEvent = withLogger(async (req: AxiomRequest) => {
  req.log.with({ endpoint: logEndpoint.TRACK_EVENT });
  if (req.method !== "POST") {
    throw new MethodNotAllowedError("TRACK_EVENT only accepts POST requests");
  }

  const { visitorId, event } = await decodeBlob<{
    visitorId: string;
    event: keyof typeof EventType;
  }>(req);
  req.log.with({ visitorId, event });
  validateInput({ visitorId, event });

  if (userAgent(req).isBot) {
    req.log.with({ isBot: true });
    return NextResponse.json({}, { status: 200 });
  }

  const visitor = await findVisitorById(visitorId);

  await db.insert(events).values({
    visitorId: visitor.id,
    event,
  });

  return NextResponse.json({}, { status: 200 });
});

const validateInput = ({
  visitorId,
  event,
}: {
  visitorId: string;
  event: keyof typeof EventType;
}): void => {
  if (!visitorId || visitorId.length !== 36) {
    throw new BadRequestError("invalid visitorId");
  }

  if (EventType[event] === undefined) {
    throw new BadRequestError("invalid event type");
  }
};

export default TrackEvent;
