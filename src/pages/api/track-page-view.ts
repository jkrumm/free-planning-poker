import { NextRequest, NextResponse, userAgent } from 'next/server';

import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { type AxiomRequest } from 'next-axiom';

import {
  BadRequestError,
  MethodNotAllowedError,
  log,
} from 'fpp/constants/error.constant';
import { logEndpoint } from 'fpp/constants/logging.constant';

import { withLogger } from 'fpp/utils/api-logger.util';
import { decodeBlob } from 'fpp/utils/decode.util';
import { validateNanoId } from 'fpp/utils/validate-nano-id.util';

import db from 'fpp/server/db/db';
import { RouteType, pageViews, users } from 'fpp/server/db/schema';

export const runtime = 'edge';
export const preferredRegion = 'fra1';

const TrackPageView = withLogger(async (req: AxiomRequest) => {
  req.log.with({ endpoint: logEndpoint.TRACK_PAGE_VIEW });
  if (req.method !== 'POST') {
    throw new MethodNotAllowedError(
      'TRACK_PAGE_VIEW only accepts POST requests',
    );
  }

  // eslint-disable-next-line prefer-const
  let { userId, route, roomId } = await decodeBlob<{
    userId: string | null;
    route: keyof typeof RouteType;
    roomId?: number;
  }>(req);
  req.log.with({ userId, route, roomId });
  if (userAgent(req).isBot) {
    req.log.with({ isBot: true });
  }

  if (RouteType[route] === undefined) {
    throw new BadRequestError('invalid route');
  }

  userId = (!validateNanoId(userId) ? nanoid() : userId)!;

  const userExists = !!(
    await db.select().from(users).where(eq(users.id, userId))
  )[0];

  if (!userExists) {
    const userPayload = getUserPayload(req);
    await db.insert(users).values({
      id: userId,
      ...userPayload,
    });
  }

  await db.insert(pageViews).values({
    userId,
    route,
    roomId,
  });

  return NextResponse.json({ userId }, { status: 200 });
});

export const getUserPayload = (req: AxiomRequest) => {
  if (req instanceof NextRequest) {
    const ua = userAgent(req);

    if (!ua.browser || !ua.os) {
      log.warn('userAgent undefined', {
        browser: ua?.browser?.name ?? null,
        device: ua?.device?.type ?? 'desktop',
        os: ua?.os?.name ?? null,
      });
    }

    if (!req?.geo?.country || !req?.geo?.region || !req?.geo?.city) {
      log.warn('geo undefined', {
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
      device: ua.isBot ? 'bot' : ua?.device?.type ?? 'desktop',
      os: ua?.os?.name ?? null,
      city: geo?.city ?? null,
      country: geo?.country ?? null,
      region: geo?.region ?? null,
    };
  }
  return {
    browser: null,
    device: 'desktop',
    os: null,
    city: null,
    country: null,
    region: null,
  };
};

export default TrackPageView;
