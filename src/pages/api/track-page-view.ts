import { NextRequest, NextResponse, userAgent } from "next/server";
import { env } from "fpp/env.mjs";
import { connect } from "@planetscale/database";
import { RouteType, type Visitor } from "@prisma/client";
import {
  BadRequestError,
  log,
  MethodNotAllowedError,
} from "fpp/constants/error.constant";
import { type AxiomRequest } from "next-axiom";
import { withLogger } from "fpp/utils/api-logger.util";
import { decodeBlob } from "fpp/utils/decode.util";
import { logEndpoint } from "fpp/constants/logging.constant";

export const config = {
  runtime: "edge",
  regions: ["fra1"],
};

const TrackPageView = withLogger(async (req: AxiomRequest) => {
  req.log.with({ endpoint: logEndpoint.TRACK_PAGE_VIEW });
  if (req.method !== "POST") {
    throw new MethodNotAllowedError(
      "TRACK_PAGE_VIEW only accepts POST requests"
    );
  }

  const { visitorId, route, room } = await decodeBlob<{
    visitorId: string | null;
    route: RouteType;
    room?: string;
  }>(req);
  req.log.with({ visitorId, route, room });
  validateInput({ visitorId, route, room });

  if (userAgent(req).isBot) {
    req.log.with({ isBot: true });
    return NextResponse.json(
      { visitorId: "we_dont_track_bots" },
      { status: 200 }
    );
  }

  const conn = connect({
    url: env.DATABASE_URL,
  });

  let visitor: Visitor | null = null;
  if (visitorId) {
    const visitorQuery = await conn.execute(
      "SELECT * FROM Visitor WHERE id = ? LIMIT 1;",
      [visitorId]
    );
    visitor = visitorQuery.rows ? (visitorQuery.rows[0] as Visitor) : null;
  }

  if (!visitor) {
    const v = getVisitorPayload(req);
    const visitorUuid = crypto.randomUUID();
    await conn.execute(
      "INSERT INTO Visitor (id, browser, device, os, city, country, region) VALUES (?, ?, ?, ?, ?, ?, ?);",
      [visitorUuid, v.browser, v.device, v.os, v.city, v.country, v.region]
    );
    visitor = { id: visitorUuid } as Visitor;
  }

  await conn.execute(
    "INSERT INTO PageView (visitorId, route, room) VALUES (?, ?, ?);",
    [visitor.id, route, room]
  );

  return NextResponse.json({ visitorId: visitor.id }, { status: 200 });
});

const validateInput = ({
  visitorId,
  route,
  room,
}: {
  visitorId: string | null;
  route: RouteType;
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
      device: ua?.device?.type ?? ua.isBot ? "bot" : "desktop",
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
