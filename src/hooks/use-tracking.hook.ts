import { startTransition, useEffect, useState } from 'react';

import { env } from 'fpp/env';

import * as Sentry from '@sentry/nextjs';

import { logEndpoint } from 'fpp/constants/logging.constant';

import { addBreadcrumb, captureError } from 'fpp/utils/app-error';
import { validateNanoId } from 'fpp/utils/validate-nano-id.util';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';

import { type RouteType } from 'fpp/server/db/schema';

export const useTrackPageView = (
  route: keyof typeof RouteType,
  roomId?: number,
) => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    const checkReady = () => {
      if (document.readyState === 'complete') {
        startTransition(() => {
          setHasMounted(true);
        });
      } else {
        // Wait a bit more if not ready
        setTimeout(checkReady, 100);
      }
    };

    // Start checking after next tick
    setTimeout(checkReady, 0);
  }, []);

  const userId = useLocalstorageStore((state) => state.userId);
  const setUserIdLocalStorage = useLocalstorageStore(
    (state) => state.setUserId,
  );
  const setUserIdRoomState = useLocalstorageStore((state) => state.setUserId);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    try {
      // Extract source from URL
      const urlParams = new URLSearchParams(window.location.search);
      let source = urlParams.get('source');
      if (source === null) {
        source = document.referrer === '' ? null : document.referrer;
      }

      // Remove source query param from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('source');

      startTransition(() => {
        window.history.replaceState({}, '', url.toString());
      });

      addBreadcrumb('Page view tracking initiated', 'tracking', {
        route,
        roomId: roomId ?? null,
        hasSource: !!source,
      });

      sendTrackPageView({
        userId,
        route,
        roomId,
        source,
        setUserIdLocalStorage,
        setUserIdRoomState,
      });
    } catch (error) {
      captureError(
        error instanceof Error ? error : new Error('Failed to track page view'),
        {
          component: 'useTrackPageView',
          action: 'initializeTracking',
          extra: {
            route,
            roomId: roomId ?? null,
            hasUserId: !!userId,
          },
        },
        'medium',
      );
    }
  }, [
    hasMounted,
    route,
    roomId,
    userId,
    setUserIdLocalStorage,
    setUserIdRoomState,
  ]);
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

    addBreadcrumb('Sending page view tracking', 'tracking', {
      route,
      hasUserId: !!userId,
    });

    if (navigator.sendBeacon && userId && validateNanoId(userId)) {
      try {
        const beaconSent = navigator.sendBeacon(url, body);
        if (!beaconSent) {
          throw new Error('Beacon failed to send');
        }
        addBreadcrumb('Page view sent via beacon', 'tracking');
      } catch (beaconError) {
        addBreadcrumb('Beacon failed, falling back to fetch', 'tracking');
        sendViaFetch(url, body, setUserIdLocalStorage, setUserIdRoomState, {
          userId,
          route,
          roomId,
        });
      }
    } else {
      sendViaFetch(url, body, setUserIdLocalStorage, setUserIdRoomState, {
        userId,
        route,
        roomId,
      });
    }
  } catch (error) {
    captureError(
      error instanceof Error
        ? error
        : new Error('Failed to send page view tracking'),
      {
        component: 'sendTrackPageView',
        action: 'sendTracking',
        extra: {
          route,
          roomId: roomId ?? null,
          hasUserId: !!userId,
          endpoint: logEndpoint.TRACK_PAGE_VIEW,
        },
      },
      'medium',
    );

    // Legacy Sentry capture for backward compatibility
    if (error instanceof Error) {
      Sentry.captureException(error, {
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

const sendViaFetch = (
  url: string,
  body: string,
  setUserIdLocalStorage: (userId: string) => void,
  setUserIdRoomState: (userId: string) => void,
  context: {
    userId: string | null;
    route: keyof typeof RouteType;
    roomId?: number;
  },
) => {
  fetch(url, { body, method: 'POST', keepalive: true })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json() as Promise<{ userId: string }>;
    })
    .then(({ userId }) => {
      startTransition(() => {
        setUserIdRoomState(userId);
        setUserIdLocalStorage(userId);
      });
      addBreadcrumb('Page view tracking successful', 'tracking', {
        newUserId: userId,
      });
    })
    .catch((fetchError) => {
      captureError(
        fetchError instanceof Error
          ? fetchError
          : new Error('Fetch tracking failed'),
        {
          component: 'sendTrackPageView',
          action: 'fetchTracking',
          extra: {
            route: context.route,
            roomId: context.roomId ?? null,
            hasUserId: !!context.userId,
            url: url.replace(env.NEXT_PUBLIC_API_ROOT, '[API_ROOT]'), // Don't log full URL
          },
        },
        'medium',
      );
    });
};
