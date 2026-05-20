import { startTransition, useEffect, useState } from 'react';

import { env } from 'fpp/env';

import { type RouteType } from '@fpp/db';

import { logEndpoint } from 'fpp/constants/logging.constant';

import { recordError } from 'fpp/utils/app-error';
import { validateNanoId } from 'fpp/utils/validate-nano-id.util';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';

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
      // Extract source from URL (support both ?source= and ?utm_source=)
      const urlParams = new URLSearchParams(window.location.search);
      let source = urlParams.get('source') ?? urlParams.get('utm_source');
      source ??= document.referrer === '' ? null : document.referrer;

      // Remove source query params from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('source');
      url.searchParams.delete('utm_source');

      startTransition(() => {
        window.history.replaceState({}, '', url.toString());
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
      recordError(
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

    if (navigator.sendBeacon && userId && validateNanoId(userId)) {
      try {
        const blob = new Blob([body], { type: 'application/json' });
        const beaconSent = navigator.sendBeacon(url, blob);
        if (!beaconSent) {
          throw new Error('Beacon failed to send');
        }
      } catch {
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
    recordError(
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
      // Handle rate limiting or WAF blocks gracefully - don't capture as errors
      if (res.status === 403 || res.status === 429) {
        return null;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json() as Promise<{ userId: string }>;
    })
    .then((data) => {
      // Skip if rate limited (returned null from previous .then())
      if (!data) return;

      startTransition(() => {
        setUserIdRoomState(data.userId);
        setUserIdLocalStorage(data.userId);
      });
    })
    .catch((fetchError) => {
      recordError(
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
