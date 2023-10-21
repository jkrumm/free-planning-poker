import { NextRequest, NextResponse, userAgent } from "next/server";
import {
  BadRequestError,
  log,
  MethodNotAllowedError,
} from "fpp/constants/error.constant";
import { type AxiomRequest } from "next-axiom";
import { withLogger } from "fpp/utils/api-logger.util";
import { decodeBlob } from "fpp/utils/decode.util";
import { logEndpoint } from "fpp/constants/logging.constant";
import db from "fpp/server/db";
import { pageViews, RouteType, visitors } from "fpp/server/db/schema";
import { eq } from "drizzle-orm";

export const config = {
  runtime: "edge",
};

const TrackPageView = withLogger(async (req: AxiomRequest) => {
  req.log.with({ endpoint: logEndpoint.TRACK_PAGE_VIEW });
  if (req.method !== "POST") {
    throw new MethodNotAllowedError(
      "TRACK_PAGE_VIEW only accepts POST requests",
    );
  }

  // eslint-disable-next-line prefer-const
  let { visitorId, route, room } = await decodeBlob<{
    visitorId: string | null;
    route: keyof typeof RouteType;
    room?: string;
  }>(req);
  req.log.with({ visitorId, route, room });
  if (userAgent(req).isBot) {
    req.log.with({ isBot: true });
  }

  validateInput({ visitorId, route, room });
  visitorId = visitorId ?? crypto.randomUUID();

  const visitorExists = !!(
    await db.select().from(visitors).where(eq(visitors.id, visitorId))
  )[0];

  if (!visitorExists) {
    const visitorPayload = getVisitorPayload(req);
    await db.insert(visitors).values({
      id: visitorId,
      ...visitorPayload,
    });
  }

  await db.insert(pageViews).values({
    visitorId,
    route,
    room,
  });

  return NextResponse.json({ visitorId }, { status: 200 });
});

const validateInput = ({
  visitorId,
  route,
  room,
}: {
  visitorId: string | null;
  route: keyof typeof RouteType;
  room?: string;
}): void => {
  if (visitorId && visitorId.length !== 36) {
    throw new BadRequestError("invalid visitorId");
  }

  if (RouteType[route] === undefined) {
    throw new BadRequestError("invalid route");
  }

  const roomCleaned = room
    ? room.replace(/[^A-Za-z]/g, "").toLowerCase()
    : null;

  if (room && (room !== roomCleaned || room.length > 15 || room.length < 3)) {
    throw new BadRequestError("invalid room");
  }
};

const getVisitorPayload = (req: AxiomRequest) => {
  if (req instanceof NextRequest) {
    const ua = userAgent(req);

    if (!ua.browser || !ua.os) {
      log.warn("userAgent undefined", {
        browser: ua?.browser?.name ?? null,
        device: ua?.device?.type ?? "desktop",
        os: ua?.os?.name ?? null,
      });
    }

    if (!req?.geo?.country || !req?.geo?.region || !req?.geo?.city) {
      log.warn("geo undefined", {
        country: req?.geo?.country ?? null,
        region: req?.geo?.region ?? null,
        city: req?.geo?.city ?? null,
      });
    }

    const geo = {
      country: req?.geo?.country ?? null,
      region: req?.geo?.region ?? null,
      city: req?.geo?.city ?? null,
    };

    return {
      browser: ua?.browser?.name ?? null,
      device: ua.isBot ? "bot" : ua?.device?.type ?? "desktop",
      os: ua?.os?.name ?? null,
      city: geo?.city ?? null,
      country: geo?.country ?? null,
      region: geo?.region ?? null,
    };
  }
  return {
    browser: null,
    device: "desktop",
    os: null,
    city: null,
    country: null,
    region: null,
  };
};

export default TrackPageView;
