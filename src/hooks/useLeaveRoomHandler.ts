import { useEffect } from 'react';

import { env } from 'fpp/env';

import { type Action } from 'fpp-server/src/room.actions';

interface LeaveRoomConfig {
  roomId: number;
  userId: string;
  triggerAction: (action: Action) => void;
}

export const useLeaveRoomHandler = ({
  roomId,
  userId,
  triggerAction,
}: LeaveRoomConfig): void => {
  // Handle user leaving the room when they actually close/navigate away
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.debug('Page unloading - user leaving room');
      // Use navigator.sendBeacon for more reliable delivery
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          `${env.NEXT_PUBLIC_NODE_ENV === 'production' ? 'https' : 'http'}://${env.NEXT_PUBLIC_FPP_SERVER_URL}/leave`,
          JSON.stringify({ roomId, userId }),
        );
      } else {
        // Fallback to WebSocket if beacon not supported
        triggerAction({
          action: 'leave',
          roomId,
          userId,
        });
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function to remove event listeners
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [roomId, userId, triggerAction]);
};
