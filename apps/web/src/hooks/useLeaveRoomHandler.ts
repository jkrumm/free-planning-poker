import { useEffect } from 'react';

import { env } from 'fpp/env';

/**
 * React hook that sends a beacon on beforeunload to notify the server user is leaving
 */
export const useLeaveRoomHandler = (): void => {
  useEffect(() => {
    const listener = (_event: BeforeUnloadEvent) => {
      // Read from localStorage directly - most reliable
      const roomIdStr = localStorage.getItem('roomId');
      const userId = localStorage.getItem('userId');

      if (!roomIdStr || !userId) {
        return;
      }

      // Parse roomId as number to match server validation schema
      const roomId = Number(roomIdStr);
      if (isNaN(roomId)) {
        return; // Invalid roomId
      }

      if (navigator.sendBeacon) {
        // `text/plain` keeps this a CORS "simple request" (no preflight) —
        // sendBeacon cannot wait for a preflight response anyway, so an
        // `application/json` Blob against the cross-origin fpp-server was
        // silently dropped as an OPTIONS 404. The server parses the JSON
        // body itself regardless of the text/plain content type.
        const blob = new Blob([JSON.stringify({ roomId, userId })], {
          type: 'text/plain',
        });
        // Match page protocol so https-served local dev (via Caddy) uses
        // https://fpp-server.test/leave instead of mixed-content http://.
        const scheme = window.location.protocol === 'https:' ? 'https' : 'http';
        const url = `${scheme}://${env.NEXT_PUBLIC_FPP_SERVER_URL}/leave`;
        navigator.sendBeacon(url, blob);
      }
    };

    window.addEventListener('beforeunload', listener);
    return () => {
      window.removeEventListener('beforeunload', listener);
    };
  }, []);
};
