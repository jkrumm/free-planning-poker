import { useCallback, useEffect, useRef } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

import { useRouter } from 'next/router';

import { env } from 'fpp/env';

import * as Sentry from '@sentry/nextjs';
import { type Action } from 'fpp-server/src/room.actions';
import { RoomClient, type RoomDto } from 'fpp-server/src/room.entity';

import { logMsg } from 'fpp/constants/logging.constant';

import { executeKick } from 'fpp/utils/room.util';

import { useRoomStore } from 'fpp/store/room.store';

export interface WebSocketRoomConfig {
  roomId: number;
  userId: string;
  username: string;
}

export interface WebSocketRoomResult {
  triggerAction: (action: Action) => void;
  connectedAt: number | null;
  sendMessage: (message: string) => void;
}

const buildWebSocketUrl = (
  roomId: number,
  userId: string,
  username: string,
): string => {
  const protocol = env.NEXT_PUBLIC_NODE_ENV === 'production' ? 'wss' : 'ws';
  const encodedUsername = encodeURIComponent(username);
  return `${protocol}://${env.NEXT_PUBLIC_FPP_SERVER_URL}/ws?roomId=${roomId}&userId=${userId}&username=${encodedUsername}`;
};

export const useWebSocketRoom = ({
  roomId,
  userId,
  username,
}: WebSocketRoomConfig): WebSocketRoomResult => {
  const router = useRouter();
  const updateRoomState = useRoomStore((store) => store.update);
  const setConnectedAt = useRoomStore((store) => store.setConnectedAt);
  const connectedAt = useRoomStore((store) => store.connectedAt);
  const setLastPongReceived = useRoomStore(
    (store) => store.setLastPongReceived,
  );
  const setReadyState = useRoomStore((store) => store.setReadyState);

  // Use ref to store the current triggerAction function
  const triggerActionRef = useRef<((action: Action) => void) | null>(null);

  const { sendMessage, readyState } = useWebSocket(
    buildWebSocketUrl(roomId, userId, username),
    {
      shouldReconnect: () => true,
      reconnectAttempts: 20,
      reconnectInterval: (attemptNumber) =>
        Math.min(Math.pow(2, attemptNumber) * 1000, 10000),

      onMessage: (message: MessageEvent<string>) => {
        if (!message.data) {
          return;
        }

        if (message.data === 'pong') {
          setLastPongReceived(Date.now());
          console.debug('Heartbeat pong received');
          return;
        }

        try {
          const data = JSON.parse(String(message.data)) as
            | RoomDto
            | { error: string }
            | { type: 'kicked'; message: string };

          console.debug('onMessage', data);

          // Handle kick notification
          if ('type' in data && data.type === 'kicked') {
            executeKick('kick_notification', router);
            return;
          }

          if ('error' in data) {
            // Handle specific error cases
            if (data.error === 'User not found - userId not found') {
              console.warn('User not found on server, triggering rejoin');

              // Use the ref to call triggerAction safely
              if (triggerActionRef.current) {
                triggerActionRef.current({
                  action: 'rejoin',
                  roomId,
                  userId,
                  username,
                });
              }
              return;
            }

            console.error('Server error:', data.error);
            Sentry.captureException(new Error(logMsg.INCOMING_MESSAGE), {
              extra: {
                message: JSON.stringify(data),
                roomId,
                userId,
              },
              tags: {
                endpoint: logMsg.INCOMING_MESSAGE,
              },
            });
            return;
          }

          updateRoomState(RoomClient.fromJson(data as RoomDto));
        } catch (e) {
          console.error('Error parsing message:', e);
          console.debug('Raw message:', message.data);
          Sentry.captureException(e, {
            extra: {
              message: message.data,
              roomId,
              userId,
            },
            tags: {
              endpoint: logMsg.INCOMING_MESSAGE,
            },
          });
        }
      },
      onError: (event) => {
        if (Object.keys(event).length === 1 && event.isTrusted) {
          return;
        }
        console.error('WebSocket error:', event);
        Sentry.captureException(new Error(logMsg.INCOMING_ERROR), {
          extra: {
            message: JSON.stringify(event),
            roomId,
            userId,
          },
          tags: {
            endpoint: logMsg.INCOMING_ERROR,
          },
        });
      },
      onClose: (event) => {
        console.warn('WebSocket closed:', {
          code: event.code,
          reason: event.reason,
        });
      },
      onOpen: (event) => {
        console.debug('WebSocket connected:', event);
        setConnectedAt();
        setLastPongReceived(Date.now());
      },
      onReconnectStop: (numAttempts) => {
        console.error(
          'WebSocket reconnection failed after',
          numAttempts,
          'attempts',
        );
      },
    },
  );

  // Sync readyState to store whenever it changes
  useEffect(() => {
    setReadyState(readyState);
  }, [readyState, setReadyState]);

  // Action trigger function
  const triggerAction = useCallback(
    (action: Action) => {
      // Only send if connection is open
      if (readyState === ReadyState.OPEN) {
        sendMessage(JSON.stringify(action));
      } else {
        console.warn('Cannot send action - WebSocket not connected:', action);
      }
    },
    [sendMessage, readyState],
  );

  // Update the ref whenever triggerAction changes
  useEffect(() => {
    triggerActionRef.current = triggerAction;
  }, [triggerAction]);

  return {
    triggerAction,
    connectedAt,
    sendMessage,
  };
};
