import { startTransition, useEffect } from 'react';

import { env } from 'fpp/env.mjs';

import * as Sentry from '@sentry/nextjs';
import { type Logger } from 'next-axiom';

import { logEndpoint } from 'fpp/constants/logging.constant';

import { validateNanoId } from 'fpp/utils/validate-nano-id.util';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';

import { type RouteType } from 'fpp/server/db/schema';

export const useTrackPageView = (
  route: keyof typeof RouteType,
  logger: Logger,
  roomId?: number,
) => {
  const userId = useLocalstorageStore((state) => state.userId);
  const setUserIdLocalStorage = useLocalstorageStore(
    (state) => state.setUserId,
  );
  const setUserIdRoomState = useLocalstorageStore((state) => state.setUserId);

  useEffect(() => {
    sendTrackPageView({
      userId,
      route,
      roomId,
      setUserIdLocalStorage,
      setUserIdRoomState,
      logger,
    });
  }, [route, roomId]);
};

export const sendTrackPageView = ({
  userId,
  route,
  roomId,
  setUserIdLocalStorage,
  setUserIdRoomState,
  logger,
}: {
  userId: string | null;
  route: keyof typeof RouteType;
  roomId?: number;
  setUserIdLocalStorage: (userId: string) => void;
  setUserIdRoomState: (userId: string) => void;
  logger: Logger;
}) => {
  logger.with({ userId, route, roomId });

  try {
    const body = JSON.stringify({
      userId,
      route,
      roomId,
    });
    const url = `${env.NEXT_PUBLIC_API_ROOT}api/track-page-view`;

    if (navigator.sendBeacon && userId && validateNanoId(userId)) {
      navigator.sendBeacon(url, body);
      logger.debug(logEndpoint.TRACK_PAGE_VIEW, {
        withBeacon: true,
      });
    } else {
      fetch(url, { body, method: 'POST', keepalive: true })
        .then((res) => res.json() as Promise<{ userId: string }>)
        .then(({ userId }) => {
          startTransition(() => {
            setUserIdLocalStorage(userId);
            setUserIdRoomState(userId);
          });
          logger.debug(logEndpoint.TRACK_PAGE_VIEW, {
            withBeacon: false,
          });
        })
        .catch((e) => {
          throw e;
        });
    }
  } catch (e) {
    if (e instanceof Error) {
      logger.error(logEndpoint.TRACK_PAGE_VIEW, {
        endpoint: logEndpoint.TRACK_PAGE_VIEW,
        error: {
          message: e.message,
          stack: e.stack,
          name: e.name,
        },
      });
      Sentry.captureException(e, {
        tags: {
          endpoint: logEndpoint.TRACK_PAGE_VIEW,
        },
        extra: {
          userId,
          route,
          roomId,
        },
      });
    }
  }
};
