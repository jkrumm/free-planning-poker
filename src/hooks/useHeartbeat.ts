import { useCallback, useEffect, useRef } from 'react';
import { ReadyState } from 'react-use-websocket';

import { type HeartbeatAction } from 'fpp-server/src/room.actions';

import { WEBSOCKET_CONSTANTS } from 'fpp/constants/websocket.constants';

import { useRoomStore } from 'fpp/store/room.store';

interface HeartbeatConfig {
  sendMessage: (message: string) => void;
  userId: string;
  roomId: number;
}

export const useHeartbeat = ({
  sendMessage,
  userId,
  roomId,
}: HeartbeatConfig): { sendHeartbeat: () => void } => {
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout>();
  const readyState = useRoomStore((store) => store.readyState);

  // Manual heartbeat function
  const sendHeartbeat = useCallback(() => {
    if (readyState === ReadyState.OPEN) {
      console.debug('Sending manual heartbeat');
      sendMessage(
        JSON.stringify({
          userId,
          roomId,
          action: 'heartbeat',
        } satisfies HeartbeatAction),
      );
    }
  }, [readyState, sendMessage, userId, roomId]);

  // Primary heartbeat system - uses setTimeout for better reliability
  const scheduleNextHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }

    if (readyState === ReadyState.OPEN) {
      heartbeatTimeoutRef.current = setTimeout(() => {
        sendHeartbeat();
        scheduleNextHeartbeat(); // Schedule the next one
      }, WEBSOCKET_CONSTANTS.HEARTBEAT_INTERVAL);
    }
  }, [readyState, sendHeartbeat]);

  // Start/stop heartbeat based on connection state
  useEffect(() => {
    if (readyState === ReadyState.OPEN) {
      // Send immediate heartbeat on connection
      sendHeartbeat();
      // Start the heartbeat schedule
      scheduleNextHeartbeat();
    } else {
      // Clear heartbeat when not connected
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }
    }

    return () => {
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }
    };
  }, [readyState, scheduleNextHeartbeat, sendHeartbeat]);

  return { sendHeartbeat };
};
