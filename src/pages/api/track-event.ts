import { NextResponse, userAgent } from 'next/server';

import { type AxiomRequest } from 'next-axiom';

import {
  BadRequestError,
  MethodNotAllowedError,
} from 'fpp/constants/error.constant';
import { logEndpoint } from 'fpp/constants/logging.constant';

import { withLogger } from 'fpp/utils/api-logger.util';
import { findUserById } from 'fpp/utils/db-api.util';
import { decodeBlob } from 'fpp/utils/decode.util';

import db from 'fpp/server/db/db';
import { EventType, events } from 'fpp/server/db/schema';

export const runtime = 'edge';
export const preferredRegion = 'fra1';

const TrackEvent = withLogger(async (req: AxiomRequest) => {
  req.log.with({ endpoint: logEndpoint.TRACK_EVENT });
  if (req.method !== 'POST') {
    throw new MethodNotAllowedError('TRACK_EVENT only accepts POST requests');
  }

  const { userId, event } = await decodeBlob<{
    userId: string;
    event: keyof typeof EventType;
  }>(req);
  req.log.with({ userId, event });
  validateInput({ userId, event });

  if (userAgent(req).isBot) {
    req.log.with({ isBot: true });
    return NextResponse.json({}, { status: 200 });
  }

  const user = await findUserById(userId);

  await db.insert(events).values({
    userId: user.id,
    event,
  });

  return NextResponse.json({}, { status: 200 });
});

const validateInput = ({
  userId,
  event,
}: {
  userId: string;
  event: keyof typeof EventType;
}): void => {
  if (!userId || userId.length !== 21) {
    throw new BadRequestError('invalid visitorId');
  }

  if (EventType[event] === undefined) {
    throw new BadRequestError('invalid event type');
  }
};

export default TrackEvent;
