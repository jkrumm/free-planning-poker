import { useCallback, useEffect, useRef } from 'react';
import { ReadyState } from 'react-use-websocket';

import { type HeartbeatAction } from 'fpp-server/src/room.actions';

import { WEBSOCKET_CONSTANTS } from 'fpp/constants/websocket.constants';

import { addBreadcrumb, captureError } from 'fpp/utils/app-error';

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
    try {
      if (readyState === ReadyState.OPEN) {
        const heartbeatMessage = JSON.stringify({
          userId,
          roomId,
          action: 'heartbeat',
        } satisfies HeartbeatAction);

        sendMessage(heartbeatMessage);
        addBreadcrumb('Manual heartbeat sent', 'websocket', {
          userId,
          roomId,
        });
      }
    } catch (error) {
      captureError(
        error instanceof Error ? error : new Error('Failed to send heartbeat'),
        {
          component: 'useHeartbeat',
          action: 'sendHeartbeat',
          extra: {
            readyState: ReadyState[readyState],
          },
        },
        'medium',
      );
    }
  }, [readyState, sendMessage, userId, roomId]);

  // Primary heartbeat system - uses setTimeout for better reliability
  const scheduleNextHeartbeat = useCallback(() => {
    try {
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }

      if (readyState === ReadyState.OPEN) {
        heartbeatTimeoutRef.current = setTimeout(() => {
          sendHeartbeat();
          scheduleNextHeartbeat(); // Schedule the next one
        }, WEBSOCKET_CONSTANTS.HEARTBEAT_INTERVAL);
      }
    } catch (error) {
      captureError(
        error instanceof Error
          ? error
          : new Error('Failed to schedule heartbeat'),
        {
          component: 'useHeartbeat',
          action: 'scheduleNextHeartbeat',
          extra: {
            readyState: ReadyState[readyState],
            heartbeatInterval: WEBSOCKET_CONSTANTS.HEARTBEAT_INTERVAL,
          },
        },
        'medium',
      );
    }
  }, [readyState, sendHeartbeat]);

  // Start/stop heartbeat based on connection state
  useEffect(() => {
    try {
      if (readyState === ReadyState.OPEN) {
        // Send immediate heartbeat on connection
        sendHeartbeat();
        // Start the heartbeat schedule
        scheduleNextHeartbeat();

        addBreadcrumb('Heartbeat system started', 'websocket');
      } else {
        // Clear heartbeat when not connected
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
        }
      }
    } catch (error) {
      captureError(
        error instanceof Error
          ? error
          : new Error('Failed to manage heartbeat system'),
        {
          component: 'useHeartbeat',
          action: 'useEffect',
          extra: {
            readyState: ReadyState[readyState],
          },
        },
        'medium',
      );
    }

    return () => {
      try {
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
        }
      } catch (error) {
        captureError(
          error instanceof Error
            ? error
            : new Error('Failed to cleanup heartbeat system'),
          {
            component: 'useHeartbeat',
            action: 'cleanup',
          },
          'low',
        );
      }
    };
  }, [readyState, scheduleNextHeartbeat, sendHeartbeat]);

  return { sendHeartbeat };
};
