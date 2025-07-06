import { useEffect, useRef } from 'react';
import { ReadyState } from 'react-use-websocket';

import { WEBSOCKET_CONSTANTS } from 'fpp/constants/websocket.constants';

import { useRoomStore } from 'fpp/store/room.store';

export const useConnectionHealth = (): void => {
  const connectionHealthRef = useRef<NodeJS.Timeout>();
  const readyState = useRoomStore((store) => store.readyState);
  const lastPongReceived = useRoomStore((store) => store.lastPongReceived);

  // Connection health monitoring - detect stale connections
  useEffect(() => {
    if (readyState === ReadyState.OPEN) {
      const checkConnectionHealth = () => {
        const timeSinceLastPong = Date.now() - lastPongReceived;

        if (timeSinceLastPong > WEBSOCKET_CONSTANTS.PONG_TIMEOUT) {
          // Connection appears stale
          console.warn('Connection appears stale - forcing reconnection');
          // Force a reconnection by reloading (simple but effective)
          window.location.reload();
        }
      };

      connectionHealthRef.current = setInterval(
        checkConnectionHealth,
        WEBSOCKET_CONSTANTS.CONNECTION_HEALTH_CHECK,
      );
    }

    return () => {
      if (connectionHealthRef.current) {
        clearInterval(connectionHealthRef.current);
      }
    };
  }, [readyState, lastPongReceived]);
};
