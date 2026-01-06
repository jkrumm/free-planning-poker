import { useCallback, useEffect, useRef } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

import { useRouter } from 'next/router';

import { env } from 'fpp/env';

import { type Action } from 'fpp-server/src/room.actions';
import { RoomClient, type RoomDto } from 'fpp-server/src/room.types';

import {
  addBreadcrumb,
  captureError,
  captureMessage,
} from 'fpp/utils/app-error';
import { executeKick, executeRoomNameChange } from 'fpp/utils/room.util';

import { useRoomStore } from 'fpp/store/room.store';

// Add this interface near the top
interface QueuedAction {
  action: Action;
  timestamp: number;
}

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

  const triggerActionRef = useRef<((action: Action) => void) | null>(null);

  // Add these state variables in the useWebSocketRoom function
  const actionQueueRef = useRef<QueuedAction[]>([]);
  const ACTION_QUEUE_TIMEOUT = 5000; // 5 seconds

  const { sendMessage, readyState } = useWebSocket(
    buildWebSocketUrl(roomId, userId, username),
    {
      shouldReconnect: () => true,
      reconnectAttempts: 20,
      reconnectInterval: (attemptNumber) =>
        Math.min(Math.pow(2, attemptNumber) * 1000, 10000),

      onMessage: (message: MessageEvent<string>) => {
        if (!message.data) return;

        if (message.data === 'pong') {
          setLastPongReceived(Date.now());
          addBreadcrumb('Heartbeat pong received', 'websocket');
          return;
        }

        try {
          const data = JSON.parse(String(message.data)) as
            | RoomDto
            | { error: string }
            | { type: 'kicked'; message: string }
            | { type: 'roomNameChanged'; roomName: string };

          addBreadcrumb('WebSocket message received', 'websocket', {
            type: 'type' in data ? data.type : 'room_update',
          });

          // Handle kick notification
          if ('type' in data && data.type === 'kicked') {
            addBreadcrumb('User kicked from room', 'room', {
              reason: data.message,
            });
            executeKick('kick_notification', router);
            return;
          }

          // Handle roomNameChanged notification
          if ('type' in data && data.type === 'roomNameChanged') {
            addBreadcrumb('Room name changed', 'room', {
              newName: data.roomName,
            });
            executeRoomNameChange({ newRoomName: data.roomName, router });
            return;
          }

          if ('error' in data) {
            if (data.error === 'User not found - userId not found') {
              addBreadcrumb('User not found, attempting rejoin', 'websocket');
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

            captureError(
              'Server error received',
              {
                component: 'useWebSocketRoom',
                action: 'onMessage',
                extra: { serverError: data.error },
              },
              'medium',
            );
            return;
          }

          updateRoomState(RoomClient.fromJson(data));
        } catch (e) {
          captureError(
            e instanceof Error
              ? e
              : new Error('Failed to parse WebSocket message'),
            {
              component: 'useWebSocketRoom',
              action: 'onMessage',
              extra: {
                rawMessage: message.data.slice(0, 500), // Truncate long messages
                messageLength: message.data?.length,
              },
            },
            'medium',
          );
        }
      },

      onError: (event) => {
        // Filter out trusted events that are just connection state changes
        if (Object.keys(event).length === 1 && event.isTrusted) {
          return;
        }

        addBreadcrumb('WebSocket error occurred', 'websocket', {
          eventKeys: Object.keys(event).join(', '),
        });

        captureError(
          'WebSocket error occurred',
          {
            component: 'useWebSocketRoom',
            action: 'onError',
            extra: {
              eventType: event.type || 'unknown',
              readyState: ReadyState[readyState],
              hasUrl: !!buildWebSocketUrl(roomId, userId, username),
            },
          },
          'high',
        );
      },

      onClose: (event) => {
        addBreadcrumb('WebSocket disconnected', 'websocket', {
          code: event.code,
          reason: event.reason || 'No reason provided',
          wasClean: event.wasClean,
        });

        if (!event.wasClean) {
          if (event.code === 1006) {
            // 1006 is very common - just log as info, not warning
            addBreadcrumb(
              'WebSocket closed abnormally (network/timeout)',
              'websocket',
              {
                code: event.code,
                message:
                  'Common network disconnection - will reconnect automatically',
              },
            );
          } else {
            // Other unexpected close codes are more concerning
            captureMessage(
              'WebSocket closed unexpectedly',
              {
                component: 'useWebSocketRoom',
                action: 'onClose',
                extra: {
                  code: event.code,
                  reason: event.reason || 'No reason provided',
                },
              },
              'warning',
            );
          }
        }
      },

      onOpen: () => {
        addBreadcrumb('WebSocket connected successfully', 'websocket');
        setConnectedAt();
        setLastPongReceived(Date.now());
      },

      onReconnectStop: (numAttempts) => {
        // Don't capture to Sentry - this is expected after 20 retries (~190 seconds)
        // User likely closed laptop, lost network, or intentionally left
        addBreadcrumb('WebSocket reconnection exhausted', 'websocket', {
          attempts: numAttempts,
          message:
            'All retry attempts exhausted - expected after prolonged network loss',
        });
      },
    },
  );

  // Sync readyState to store whenever it changes
  useEffect(() => {
    setReadyState(readyState);
    addBreadcrumb('WebSocket state changed', 'websocket', {
      state: ReadyState[readyState],
    });
  }, [readyState, setReadyState]);

  const triggerAction = useCallback(
    (action: Action) => {
      try {
        if (readyState === ReadyState.OPEN) {
          const message = JSON.stringify(action);
          sendMessage(message);
          addBreadcrumb('WebSocket action sent', 'websocket', {
            action: action.action,
          });
        } else if (
          readyState === ReadyState.CONNECTING ||
          readyState === ReadyState.CLOSED ||
          readyState === ReadyState.CLOSING ||
          readyState === ReadyState.UNINSTANTIATED
        ) {
          // Handle different action types with specific logic
          switch (action.action) {
            case 'setPresence':
              // Remove any existing presence actions to keep only the latest state
              actionQueueRef.current = actionQueueRef.current.filter(
                (queuedAction) => queuedAction.action.action !== 'setPresence',
              );
              break;

            case 'leave':
              // Leave actions are less critical when connection is already down
              // The server will clean up stale connections, and beforeunload uses beacon fallback
              addBreadcrumb(
                'Leave action skipped - connection not ready',
                'websocket',
                {
                  readyState: ReadyState[readyState],
                },
              );
              return; // Don't queue leave actions

            case 'heartbeat':
              // Don't queue heartbeats when not connected - they're only useful when connected
              addBreadcrumb(
                'Heartbeat skipped - connection not ready',
                'websocket',
                {
                  readyState: ReadyState[readyState],
                },
              );
              return;

            case 'rejoin':
              // Rejoin actions are only meaningful when we have a connection attempt
              if (readyState !== ReadyState.CONNECTING) {
                addBreadcrumb(
                  'Rejoin action skipped - not connecting',
                  'websocket',
                  {
                    readyState: ReadyState[readyState],
                  },
                );
                return;
              }
              break;

            default:
              // Handle any future action types
              break;
          }

          const queuedAction: QueuedAction = {
            action,
            timestamp: Date.now(),
          };

          actionQueueRef.current.push(queuedAction);

          addBreadcrumb(
            'WebSocket action queued - connection not ready',
            'websocket',
            {
              action: action.action,
              readyState: ReadyState[readyState],
              queueLength: actionQueueRef.current.length,
            },
          );
        }
      } catch (error) {
        captureError(
          error instanceof Error
            ? error
            : new Error('Failed to send WebSocket action'),
          {
            component: 'useWebSocketRoom',
            action: 'triggerAction',
            extra: {
              actionType: action.action,
              readyState: ReadyState[readyState],
            },
          },
          'medium',
        );
      }
    },
    [readyState, sendMessage],
  );

  useEffect(() => {
    if (readyState === ReadyState.OPEN && actionQueueRef.current.length > 0) {
      const now = Date.now();
      const validActions = actionQueueRef.current.filter(
        (queuedAction) => now - queuedAction.timestamp < ACTION_QUEUE_TIMEOUT,
      );

      validActions.forEach(({ action }) => {
        try {
          const message = JSON.stringify(action);
          sendMessage(message);
          addBreadcrumb('Queued WebSocket action sent', 'websocket', {
            action: action.action,
          });
        } catch (error) {
          captureError(
            error instanceof Error
              ? error
              : new Error('Failed to send queued WebSocket action'),
            {
              component: 'useWebSocketRoom',
              action: 'processQueuedActions',
              extra: {
                actionType: action.action,
              },
            },
            'medium',
          );
        }
      });

      if (validActions.length > 0) {
        addBreadcrumb('Processed queued actions', 'websocket', {
          processedCount: validActions.length,
          expiredCount: actionQueueRef.current.length - validActions.length,
        });
      }

      actionQueueRef.current = [];
    }
  }, [readyState, sendMessage]);

  // eslint-disable-next-line react-hooks/refs -- Valid pattern: Keeping ref current for callback in action queue processing
  triggerActionRef.current = triggerAction;

  return { triggerAction, connectedAt, sendMessage };
};
