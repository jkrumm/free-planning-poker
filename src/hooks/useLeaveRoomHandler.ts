import { useEffect } from 'react';

import { env } from 'fpp/env';

import { type Action } from 'fpp-server/src/room.actions';

import { addBreadcrumb, captureError } from 'fpp/utils/app-error';

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
      try {
        addBreadcrumb('Page unloading - user leaving room', 'room', {
          roomId,
          userId,
        });

        // Use navigator.sendBeacon for more reliable delivery
        if (navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify({ roomId, userId })], {
            type: 'application/json',
          });
          const success = navigator.sendBeacon(
            `${env.NEXT_PUBLIC_NODE_ENV === 'production' ? 'https' : 'http'}://${env.NEXT_PUBLIC_FPP_SERVER_URL}/leave`,
            blob,
          );

          if (!success) {
            // Fallback to WebSocket if beacon fails
            triggerAction({
              action: 'leave',
              roomId,
              userId,
            });
          }
        } else {
          // Fallback to WebSocket if beacon not supported
          triggerAction({
            action: 'leave',
            roomId,
            userId,
          });
        }
      } catch (error) {
        captureError(
          error instanceof Error
            ? error
            : new Error('Failed to handle page unload'),
          {
            component: 'useLeaveRoomHandler',
            action: 'handleBeforeUnload',
            extra: {
              hasBeacon: String(!!navigator.sendBeacon),
              roomId,
              userId,
            },
          },
          'medium',
        );

        // Still try WebSocket as final fallback
        try {
          triggerAction({
            action: 'leave',
            roomId,
            userId,
          });
        } catch (fallbackError) {
          // Silent fail for cleanup attempt
        }
      }
    };

    try {
      // Add event listeners
      window.addEventListener('beforeunload', handleBeforeUnload);
      addBreadcrumb('Leave room handler initialized', 'room');
    } catch (error) {
      captureError(
        error instanceof Error
          ? error
          : new Error('Failed to initialize leave room handler'),
        {
          component: 'useLeaveRoomHandler',
          action: 'initialization',
        },
        'high',
      );
    }

    // Cleanup function to remove event listeners
    return () => {
      try {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      } catch (error) {
        captureError(
          error instanceof Error
            ? error
            : new Error('Failed to cleanup leave room handler'),
          {
            component: 'useLeaveRoomHandler',
            action: 'cleanup',
          },
          'low',
        );
      }
    };
  }, [roomId, userId, triggerAction]);
};
