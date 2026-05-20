import { userAgentFromString } from 'next/dist/server/web/spec-extension/user-agent';

import type {
  NextApiRequest,
  NextApiResponse,
} from '@trpc/server/adapters/next';

import { RouteType, pageViews, users } from '@fpp/db';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import {
  BadRequestError,
  MethodNotAllowedError,
} from 'fpp/constants/error.constant';

import { log, recordError } from 'fpp/utils/app-error';
import { validateNanoId } from 'fpp/utils/validate-nano-id.util';

import db from 'fpp/server/db/db';

export const preferredRegion = 'fra1';

const TrackPageView = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    if (req.method !== 'POST') {
      throw new MethodNotAllowedError(
        'TRACK_PAGE_VIEW only accepts POST requests',
      );
    }

    // eslint-disable-next-line prefer-const
    let { userId, route, roomId, source } = (
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    ) as {
      userId: string | null;
      route: keyof typeof RouteType;
      roomId?: number;
      source: string | null;
    };

    userId = (!validateNanoId(userId) ? nanoid() : userId)!;

    if (userAgentFromString(req.headers['user-agent']).isBot) {
      return res.status(200).json({ userId });
    }

    if (RouteType[route] === undefined) {
      throw new BadRequestError('invalid route');
    }

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
      source,
    });

    return res.status(200).json({ userId });
  } catch (error) {
    // Capture error with context
    recordError(
      error instanceof Error ? error : new Error('Failed to track page view'),
      {
        component: 'track-page-view',
        action: 'TrackPageView',
        extra: {
          method: req.method ?? 'unknown',
          hasBody: !!req.body,
          userAgent: req.headers['user-agent']?.substring(0, 100) ?? 'unknown',
        },
      },
      'high',
    );

    // Return error response
    return res.status(500).json({
      error: 'Internal server error',
      userId: null,
    });
  }
};

const headerValue = (req: NextApiRequest, name: string): string | null => {
  const value = req.headers[name];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
};

// decodeURIComponent throws on malformed input — fall back to the raw value.
const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const getUserPayload = (req: NextApiRequest) => {
  const ua = userAgentFromString(req.headers['user-agent']);

  // Approximate geolocation comes from Vercel's edge headers: the visitor's IP
  // is resolved to a coarse location at the edge and is NOT forwarded to any
  // third party and NOT stored. This is what the privacy policy (imprint.tsx)
  // promises — keep them in sync.
  const country = headerValue(req, 'x-vercel-ip-country');
  const region = headerValue(req, 'x-vercel-ip-country-region');
  const cityRaw = headerValue(req, 'x-vercel-ip-city'); // RFC3986-encoded
  const city = cityRaw ? safeDecode(cityRaw) : null;

  // Fail-open monitor: when the edge geo headers are absent we store no location
  // rather than calling out to a third-party IP service. This warn (no IP, no
  // PII) is how we measure how often that happens — if it stays ~0 in
  // production the Vercel-edge path is validated and no fallback is needed.
  // Goes through log.warn (not raw Pino) so it reaches HyperDX as an OTLP log
  // record — Vercel stdout is not aggregated into our stack.
  if (!country && process.env.NODE_ENV === 'production') {
    log.warn(
      'geo headers absent — stored null location (no third-party fallback)',
      { component: 'getUserPayload' },
    );
  }

  /*
   * FALLBACK DISABLED (2026-05-20). Geolocation previously resolved by sending
   * the visitor's full IP to ip-api.com over plain HTTP — a third-country
   * transfer of personal data, unencrypted in transit. Replaced by the Vercel
   * edge headers above. Left here, commented out, until the "geo headers
   * absent" warn log confirms the edge path covers production traffic. If a
   * fallback is ever reintroduced it MUST use an HTTPS provider and be
   * disclosed in the privacy policy as a processor + third-country transfer.
   *
   * let ip =
   *   req?.headers['x-forwarded-for'] ??
   *   req?.headers['x-real-ip'] ??
   *   req.socket.remoteAddress ?? '::1';
   * const geoResponse = await fetch(`https://<https-geo-provider>/json/${ip}`);
   * const geoData = await geoResponse.json();
   */

  return {
    browser: ua?.browser?.name ?? null,
    device: ua.isBot ? 'bot' : (ua?.device?.type ?? 'desktop'),
    os: ua?.os?.name ?? null,
    city,
    country,
    region,
  };
};

export default TrackPageView;
