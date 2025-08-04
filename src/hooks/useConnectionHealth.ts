import { useEffect, useRef } from 'react';
import { ReadyState } from 'react-use-websocket';

import type { HeartbeatAction } from 'fpp-server/src/room.actions';

import { WEBSOCKET_CONSTANTS } from 'fpp/constants/websocket.constants';

import {
  addBreadcrumb,
  captureError,
  captureMessage,
} from 'fpp/utils/app-error';

import { useRoomStore } from 'fpp/store/room.store';

export const useConnectionHealth = ({
  sendMessage,
  userId,
  roomId,
}: {
  sendMessage: (message: string) => void;
  userId: string;
  roomId: number;
}): void => {
  const connectionHealthRef = useRef<NodeJS.Timeout>();
  const readyState = useRoomStore((store) => store.readyState);
  const lastPongReceived = useRoomStore((store) => store.lastPongReceived);
  const reloadAttempts = useRef(0);
  const lastReloadTime = useRef(0);
  const warningIssued = useRef(false);

  useEffect(() => {
    try {
      if (readyState === ReadyState.OPEN) {
        const checkConnectionHealth = () => {
          try {
            const timeSinceLastPong = Date.now() - lastPongReceived;
            const timeSinceLastReload = Date.now() - lastReloadTime.current;

            // Warning level - log but don't act yet
            if (
              timeSinceLastPong > WEBSOCKET_CONSTANTS.PONG_TIMEOUT_WARNING &&
              !warningIssued.current
            ) {
              addBreadcrumb('Connection health warning', 'websocket', {
                timeSinceLastPong,
                userId,
                roomId,
              });

              captureMessage(
                'Connection health warning - no pong received',
                {
                  component: 'useConnectionHealth',
                  action: 'checkConnectionHealth',
                  extra: {
                    timeSinceLastPong,
                    pongTimeoutWarning:
                      WEBSOCKET_CONSTANTS.PONG_TIMEOUT_WARNING,
                  },
                },
                'warning',
              );

              warningIssued.current = true;
              sendMessage(
                JSON.stringify({
                  userId,
                  roomId,
                  action: 'heartbeat',
                } satisfies HeartbeatAction),
              );
            }

            // Critical level - take action
            if (
              timeSinceLastPong > WEBSOCKET_CONSTANTS.PONG_TIMEOUT_CRITICAL &&
              timeSinceLastReload > WEBSOCKET_CONSTANTS.RELOAD_COOLDOWN &&
              reloadAttempts.current < 3
            ) {
              addBreadcrumb(
                'Connection health critical - forcing reload',
                'websocket',
                {
                  timeSinceLastPong,
                  timeSinceLastReload,
                  reloadAttempts: reloadAttempts.current,
                },
              );

              captureError(
                'Connection health critical - forcing reconnection',
                {
                  component: 'useConnectionHealth',
                  action: 'checkConnectionHealth',
                  extra: {
                    timeSinceLastPong,
                    timeSinceLastReload,
                    reloadAttempts: reloadAttempts.current,
                    pongTimeoutCritical:
                      WEBSOCKET_CONSTANTS.PONG_TIMEOUT_CRITICAL,
                  },
                },
                'critical',
              );

              reloadAttempts.current++;
              lastReloadTime.current = Date.now();
              window.location.reload();
            }
          } catch (error) {
            captureError(
              error instanceof Error
                ? error
                : new Error('Failed to check connection health'),
              {
                component: 'useConnectionHealth',
                action: 'checkConnectionHealth',
                extra: {
                  timeSinceLastPong: Date.now() - lastPongReceived,
                  readyState: ReadyState[readyState],
                },
              },
              'high',
            );
          }
        };

        connectionHealthRef.current = setInterval(
          checkConnectionHealth,
          WEBSOCKET_CONSTANTS.CONNECTION_HEALTH_CHECK,
        );

        addBreadcrumb('Connection health monitoring started', 'websocket');
      }

      // Reset counters when connection is established
      if (readyState === ReadyState.OPEN) {
        reloadAttempts.current = 0;
        warningIssued.current = false;
      }
    } catch (error) {
      captureError(
        error instanceof Error
          ? error
          : new Error('Failed to initialize connection health monitoring'),
        {
          component: 'useConnectionHealth',
          action: 'initialization',
          extra: {
            readyState: ReadyState[readyState],
          },
        },
        'high',
      );
    }

    return () => {
      try {
        if (connectionHealthRef.current) {
          clearInterval(connectionHealthRef.current);
          addBreadcrumb('Connection health monitoring stopped', 'websocket');
        }
      } catch (error) {
        captureError(
          error instanceof Error
            ? error
            : new Error('Failed to cleanup connection health monitoring'),
          {
            component: 'useConnectionHealth',
            action: 'cleanup',
          },
          'low',
        );
      }
    };
  }, [readyState, lastPongReceived, sendMessage, userId, roomId]);
};
