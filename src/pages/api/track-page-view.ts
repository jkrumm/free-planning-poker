import { userAgentFromString } from 'next/dist/server/web/spec-extension/user-agent';

import type {
  NextApiRequest,
  NextApiResponse,
} from '@trpc/server/adapters/next';

import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import {
  BadRequestError,
  MethodNotAllowedError,
} from 'fpp/constants/error.constant';

import { validateNanoId } from 'fpp/utils/validate-nano-id.util';

import db from 'fpp/server/db/db';
import { RouteType, pageViews, users } from 'fpp/server/db/schema';

export const preferredRegion = 'fra1';

const TrackPageView = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    throw new MethodNotAllowedError(
      'TRACK_PAGE_VIEW only accepts POST requests',
    );
  }

  // eslint-disable-next-line prefer-const
  let { userId, route, roomId } = JSON.parse(req.body as string) as {
    userId: string | null;
    route: keyof typeof RouteType;
    roomId?: number;
  };

  userId = (!validateNanoId(userId) ? nanoid() : userId)!;

  if (userAgentFromString(req.headers['user-agent']).isBot) {
    return { userId };
  }

  if (RouteType[route] === undefined) {
    throw new BadRequestError('invalid route');
  }

  const userExists = !!(
    await db.select().from(users).where(eq(users.id, userId))
  )[0];

  if (!userExists) {
    const userPayload = await getUserPayload(req);
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

  return res.status(200).json({ userId });
};

export const getUserPayload = async (req: NextApiRequest) => {
  const ua = userAgentFromString(req.headers['user-agent']);

  // if (!ua.browser || !ua.os) {
  //   log.warn('userAgent undefined', {
  //     browser: ua?.browser?.name ?? null,
  //     device: ua?.device?.type ?? 'desktop',
  //     os: ua?.os?.name ?? null,
  //   });
  // }

  const geo: {
    country: string | null;
    region: string | null;
    city: string | null;
  } = {
    country: null,
    region: null,
    city: null,
  };

  let ip =
    req?.headers['x-forwarded-for'] ??
    req?.headers['X-Forwarded-For'] ??
    req?.headers['x-real-ip'] ??
    req.socket.remoteAddress ??
    '::1';

  if (ip instanceof Array && ip.length > 0) {
    ip = ip[0]!;
  }

  if (ip.includes(',') && ip instanceof String) {
    ip = ip.split(',')[0]!;
  }

  if (ip !== '::1') {
    try {
      const geoResponse = await fetch(`http://ip-api.com/json/${ip as string}`);
      const geoData = (await geoResponse.json()) as {
        countryCode: string;
        region: string;
        city: string;
      };
      console.log('geoData', geoData);
      geo.country = geoData.countryCode;
      geo.region = geoData.region;
      geo.city = geoData.city;
    } catch (error) {
      if (error instanceof Error) {
        console.error('error fetching geo data', {
          error: error.message,
        });
      }
    }
  }

  return {
    browser: ua?.browser?.name ?? null,
    device: ua.isBot ? 'bot' : ua?.device?.type ?? 'desktop',
    os: ua?.os?.name ?? null,
    city: geo.city ?? null,
    country: geo.country ?? null,
    region: geo.region ?? null,
  };
};

export default TrackPageView;
