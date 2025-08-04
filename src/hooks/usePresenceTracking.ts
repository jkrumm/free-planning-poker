import { useEffect, useRef } from 'react';

import { type Action } from 'fpp-server/src/room.actions';

import { addBreadcrumb, captureError } from 'fpp/utils/app-error';

import { useRoomStore } from 'fpp/store/room.store';

interface PresenceTrackingConfig {
  triggerAction: (action: Action) => void;
  sendHeartbeat: () => void;
  roomId: number;
  userId: string;
}

export const usePresenceTracking = ({
  triggerAction,
  sendHeartbeat,
  roomId,
  userId,
}: PresenceTrackingConfig): void => {
  const visibilityHeartbeatRef = useRef<NodeJS.Timeout>();
  const setLastPongReceived = useRoomStore(
    (store) => store.setLastPongReceived,
  );

  useEffect(() => {
    const updatePresence = (isPresent: boolean) => {
      try {
        addBreadcrumb('Updating user presence', 'presence', {
          isPresent,
          userId,
          roomId,
        });

        triggerAction({
          action: 'setPresence',
          roomId,
          userId,
          isPresent,
        });
      } catch (error) {
        captureError(
          error instanceof Error
            ? error
            : new Error('Failed to update presence'),
          {
            component: 'usePresenceTracking',
            action: 'updatePresence',
            extra: {
              isPresent,
              userId,
              roomId,
            },
          },
          'medium',
        );
      }
    };

    const handleVisibilityChange = () => {
      try {
        const isVisible = !document.hidden;
        addBreadcrumb('Visibility changed', 'presence', {
          isVisible,
          hidden: document.hidden,
        });

        updatePresence(isVisible);

        if (isVisible) {
          // Clear any existing timeout and send immediate heartbeat
          if (visibilityHeartbeatRef.current) {
            clearTimeout(visibilityHeartbeatRef.current);
          }

          // Send heartbeat after a small delay to ensure tab is fully active
          visibilityHeartbeatRef.current = setTimeout(() => {
            try {
              sendHeartbeat();
              // Reset the pong timer since we're active again
              setLastPongReceived(Date.now());
            } catch (error) {
              captureError(
                error instanceof Error
                  ? error
                  : new Error('Failed to send visibility heartbeat'),
                {
                  component: 'usePresenceTracking',
                  action: 'handleVisibilityChange',
                },
                'low',
              );
            }
          }, 100);
        }
      } catch (error) {
        captureError(
          error instanceof Error
            ? error
            : new Error('Failed to handle visibility change'),
          {
            component: 'usePresenceTracking',
            action: 'handleVisibilityChange',
            extra: {
              documentHidden: document.hidden,
            },
          },
          'medium',
        );
      }
    };

    const handleFocus = () => {
      try {
        addBreadcrumb('Window focused - user is active', 'presence');
        updatePresence(true);
        sendHeartbeat();
      } catch (error) {
        captureError(
          error instanceof Error ? error : new Error('Failed to handle focus'),
          {
            component: 'usePresenceTracking',
            action: 'handleFocus',
          },
          'low',
        );
      }
    };

    const handleBlur = () => {
      try {
        addBreadcrumb('Window blurred - user is away', 'presence');
        updatePresence(false);
      } catch (error) {
        captureError(
          error instanceof Error ? error : new Error('Failed to handle blur'),
          {
            component: 'usePresenceTracking',
            action: 'handleBlur',
          },
          'low',
        );
      }
    };

    // Network change detection
    const handleOnline = () => {
      try {
        addBreadcrumb('Network came online - sending heartbeat', 'presence');
        sendHeartbeat();
      } catch (error) {
        captureError(
          error instanceof Error ? error : new Error('Failed to handle online'),
          {
            component: 'usePresenceTracking',
            action: 'handleOnline',
          },
          'low',
        );
      }
    };

    try {
      // Set initial presence based on current visibility and focus state
      const isCurrentlyActive = !document.hidden && document.hasFocus();
      updatePresence(isCurrentlyActive);

      // Add all event listeners
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);
      window.addEventListener('blur', handleBlur);
      window.addEventListener('online', handleOnline);

      addBreadcrumb('Presence tracking initialized', 'presence', {
        isCurrentlyActive,
      });
    } catch (error) {
      captureError(
        error instanceof Error
          ? error
          : new Error('Failed to initialize presence tracking'),
        {
          component: 'usePresenceTracking',
          action: 'initialization',
        },
        'high',
      );
    }

    return () => {
      try {
        document.removeEventListener(
          'visibilitychange',
          handleVisibilityChange,
        );
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('blur', handleBlur);
        window.removeEventListener('online', handleOnline);

        if (visibilityHeartbeatRef.current) {
          clearTimeout(visibilityHeartbeatRef.current);
        }
      } catch (error) {
        captureError(
          error instanceof Error
            ? error
            : new Error('Failed to cleanup presence tracking'),
          {
            component: 'usePresenceTracking',
            action: 'cleanup',
          },
          'low',
        );
      }
    };
  }, [sendHeartbeat, setLastPongReceived, triggerAction, roomId, userId]);
};
