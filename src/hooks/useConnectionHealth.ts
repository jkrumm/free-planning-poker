import { useEffect, useRef } from 'react';
import { ReadyState } from 'react-use-websocket';

import type { HeartbeatAction } from 'fpp-server/src/room.actions';

import { WEBSOCKET_CONSTANTS } from 'fpp/constants/websocket.constants';

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
    if (readyState === ReadyState.OPEN) {
      const checkConnectionHealth = () => {
        const timeSinceLastPong = Date.now() - lastPongReceived;
        const timeSinceLastReload = Date.now() - lastReloadTime.current;

        // Warning level - log but don't act yet
        if (
          timeSinceLastPong > WEBSOCKET_CONSTANTS.PONG_TIMEOUT_WARNING &&
          !warningIssued.current
        ) {
          console.warn(
            'Connection health warning - no pong received for',
            timeSinceLastPong,
            'ms',
          );
          warningIssued.current = true;
          console.debug('Sending manual heartbeat from useConnectionHealth');
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
          console.error('Connection health critical - forcing reconnection', {
            timeSinceLastPong,
            timeSinceLastReload,
            reloadAttempts: reloadAttempts.current,
          });

          reloadAttempts.current++;
          lastReloadTime.current = Date.now();
          window.location.reload();
        }
      };

      connectionHealthRef.current = setInterval(
        checkConnectionHealth,
        WEBSOCKET_CONSTANTS.CONNECTION_HEALTH_CHECK,
      );
    }

    // Reset counters when connection is established
    if (readyState === ReadyState.OPEN) {
      reloadAttempts.current = 0;
      warningIssued.current = false;
    }

    return () => {
      if (connectionHealthRef.current) {
        clearInterval(connectionHealthRef.current);
      }
    };
  }, [readyState, lastPongReceived, sendMessage, userId, roomId]);
};
