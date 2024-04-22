import { startTransition, useEffect } from 'react';

import { env } from 'fpp/env';

import * as Sentry from '@sentry/nextjs';

import { logEndpoint } from 'fpp/constants/logging.constant';

import { validateNanoId } from 'fpp/utils/validate-nano-id.util';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';

import { type RouteType } from 'fpp/server/db/schema';

export const useTrackPageView = (
  route: keyof typeof RouteType,
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
    });
  }, [route, roomId]);
};

export const sendTrackPageView = ({
  userId,
  route,
  roomId,
  setUserIdLocalStorage,
  setUserIdRoomState,
}: {
  userId: string | null;
  route: keyof typeof RouteType;
  roomId?: number;
  setUserIdLocalStorage: (userId: string) => void;
  setUserIdRoomState: (userId: string) => void;
}) => {
  try {
    const body = JSON.stringify({
      userId,
      route,
      roomId,
    });
    const url = `${env.NEXT_PUBLIC_API_ROOT}api/track-page-view`;

    if (navigator.sendBeacon && userId && validateNanoId(userId)) {
      navigator.sendBeacon(url, body);
    } else {
      fetch(url, { body, method: 'POST', keepalive: true })
        .then((res) => res.json() as Promise<{ userId: string }>)
        .then(({ userId }) => {
          startTransition(() => {
            setUserIdLocalStorage(userId);
            setUserIdRoomState(userId);
          });
        })
        .catch((e) => {
          throw e;
        });
    }
  } catch (e) {
    if (e instanceof Error) {
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
