import { userAgentFromString } from 'next/dist/server/web/spec-extension/user-agent';
import { NextResponse } from 'next/server';

import {
  type NextApiRequest,
  type NextApiResponse,
} from '@trpc/server/adapters/next';

import {
  BadRequestError,
  MethodNotAllowedError,
} from 'fpp/constants/error.constant';

import { findUserById } from 'fpp/utils/db-api.util';
import { validateNanoId } from 'fpp/utils/validate-nano-id.util';

import db from 'fpp/server/db/db';
import { EventType, events } from 'fpp/server/db/schema';

export const preferredRegion = 'fra1';

const TrackEvent = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    throw new MethodNotAllowedError('TRACK_EVENT only accepts POST requests');
  }

  const { userId, event } = (
    typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  ) as {
    userId: string;
    event: keyof typeof EventType;
  };

  validateInput({ userId, event });

  if (userAgentFromString(req.headers['user-agent']).isBot) {
    return NextResponse.json({}, { status: 200 });
  }

  const user = await findUserById(userId);

  await db.insert(events).values({
    userId: user.id,
    event,
  });

  return res.status(200).end();
};

const validateInput = ({
  userId,
  event,
}: {
  userId: string;
  event: keyof typeof EventType;
}): void => {
  if (!validateNanoId(userId)) {
    throw new BadRequestError('invalid userId');
  }

  if (EventType[event] === undefined) {
    throw new BadRequestError('invalid event type');
  }
};

export default TrackEvent;
