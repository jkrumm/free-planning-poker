import { startTransition, useEffect, useState } from 'react';

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
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const userId = useLocalstorageStore((state) => state.userId);
  const setUserIdLocalStorage = useLocalstorageStore(
    (state) => state.setUserId,
  );
  const setUserIdRoomState = useLocalstorageStore((state) => state.setUserId);

  useEffect(() => {
    if (hasMounted) {
      startTransition(() => {
        // Extract source from URL
        const urlParams = new URLSearchParams(window.location.search);
        let source = urlParams.get('source');
        if (source === null) {
          source = document.referrer === '' ? null : document.referrer;
        }

        // Remove source query param from URL
        const url = new URL(window.location.href);
        url.searchParams.delete('source');
        window.history.replaceState({}, '', url.toString());

        sendTrackPageView({
          userId,
          route,
          roomId,
          source,
          setUserIdLocalStorage,
          setUserIdRoomState,
        });
      });
    }
  }, [hasMounted, route, roomId]);
};

export const sendTrackPageView = ({
  userId,
  route,
  roomId,
  source,
  setUserIdLocalStorage,
  setUserIdRoomState,
}: {
  userId: string | null;
  route: keyof typeof RouteType;
  roomId?: number;
  source: string | null;
  setUserIdLocalStorage: (userId: string) => void;
  setUserIdRoomState: (userId: string) => void;
}) => {
  try {
    const body = JSON.stringify({
      userId,
      route,
      roomId,
      source,
    });
    const url = `${env.NEXT_PUBLIC_API_ROOT}api/track-page-view`;

    if (navigator.sendBeacon && userId && validateNanoId(userId)) {
      try {
        navigator.sendBeacon(url, body);
      } catch (e) {
        fetch(url, { body, method: 'POST', keepalive: true })
          .then((res) => res.json() as Promise<{ userId: string }>)
          .then(({ userId }) => {
            setUserIdLocalStorage(userId);
            setUserIdRoomState(userId);
          })
          .catch((e) => {
            throw e;
          });
      }
    } else {
      fetch(url, { body, method: 'POST', keepalive: true })
        .then((res) => res.json() as Promise<{ userId: string }>)
        .then(({ userId }) => {
          setUserIdLocalStorage(userId);
          setUserIdRoomState(userId);
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
