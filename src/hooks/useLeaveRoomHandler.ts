import { useEffect } from 'react';

import { env } from 'fpp/env';

/**
 * React hook that sends a beacon on beforeunload to notify the server user is leaving
 */
export const useLeaveRoomHandler = (): void => {
  useEffect(() => {
    const listener = (_event: BeforeUnloadEvent) => {
      // Read from localStorage directly - most reliable
      const roomId = localStorage.getItem('roomId');
      const userId = localStorage.getItem('userId');

      if (!roomId || !userId) {
        return;
      }

      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({ roomId, userId })], {
          type: 'application/json',
        });
        const url = `${env.NEXT_PUBLIC_NODE_ENV === 'production' ? 'https' : 'http'}://${env.NEXT_PUBLIC_FPP_SERVER_URL}/leave`;
        navigator.sendBeacon(url, blob);
      }
    };

    window.addEventListener('beforeunload', listener);
    return () => {
      window.removeEventListener('beforeunload', listener);
    };
  }, []);
};
