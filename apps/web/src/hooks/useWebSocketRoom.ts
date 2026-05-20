import { useCallback, useEffect, useRef } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

import { useRouter } from 'next/router';

import { env } from 'fpp/env';

import { type Action } from '@fpp/shared';
import { RoomClient, type RoomDto } from '@fpp/shared';
import { EVENT } from '@fpp/shared/telemetry';
import { context, propagation } from '@opentelemetry/api';

import { log, recordError, recordEvent } from 'fpp/utils/app-error';
import { executeKick, executeRoomNameChange } from 'fpp/utils/room.util';

import { useRoomStore } from 'fpp/store/room.store';

// Add this interface near the top
interface QueuedAction {
  action: Action;
  timestamp: number;
}

// Serialize an Action with the current W3C trace context inlined as a
// `_traceparent` field. WebSocket frames have no headers, so we ride the
// trace context inside the payload. The server extracts it and starts a
// child span — that's what gives us "browser click → server WS handler"
// in a single HyperDX trace. No active span = no field added.
const serializeWithTraceContext = (action: Action): string => {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  if (!carrier.traceparent) return JSON.stringify(action);
  return JSON.stringify({ ...action, _traceparent: carrier.traceparent });
};

export interface WebSocketRoomConfig {
  roomId: number;
  userId: string;
  username: string;
  onInvalidUsername?: () => void;
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
  // Match the page's protocol: an https page (prod or local-via-Caddy) must
  // upgrade to wss, otherwise the browser blocks the ws:// as mixed content.
  // Falls back to NODE_ENV for SSR where window is undefined.
  const protocol =
    typeof window !== 'undefined'
      ? window.location.protocol === 'https:'
        ? 'wss'
        : 'ws'
      : env.NEXT_PUBLIC_NODE_ENV === 'production'
        ? 'wss'
        : 'ws';
  const encodedUsername = encodeURIComponent(username);
  return `${protocol}://${env.NEXT_PUBLIC_FPP_SERVER_URL}/ws?roomId=${roomId}&userId=${userId}&username=${encodedUsername}`;
};

export const useWebSocketRoom = ({
  roomId,
  userId,
  username,
  onInvalidUsername,
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
        //NOSONAR - Message dispatcher pattern requires type discrimination
        if (!message.data) return;

        if (message.data === 'pong') {
          setLastPongReceived(Date.now());
          return;
        }

        try {
          const data = JSON.parse(String(message.data)) as
            | RoomDto
            | { error: string }
            | { type: 'kicked'; message: string }
            | { type: 'roomNameChanged'; roomName: string };

          // Handle kick notification
          if ('type' in data && data.type === 'kicked') {
            executeKick('kick_notification', router);
            return;
          }

          // Handle roomNameChanged notification
          if ('type' in data && data.type === 'roomNameChanged') {
            executeRoomNameChange({ newRoomName: data.roomName, router });
            return;
          }

          if ('error' in data) {
            if (data.error === 'User not found - userId not found') {
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

            recordError(
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
          recordError(
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

        recordError(
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
        // Handle code 1008 (policy violation) - usually invalid username
        if (event.code === 1008) {
          const reason = event.reason || '';
          const isUsernameError =
            reason.includes('username') ||
            reason.includes('Username') ||
            reason.includes('letters');

          if (isUsernameError) {
            // Notify parent component to clear username and show modal
            if (onInvalidUsername) {
              onInvalidUsername();
            }

            // Don't capture as an error - this is expected for users with old usernames
            return;
          }
        }

        if (!event.wasClean) {
          if (event.code === 1006 || event.code === 1001) {
            // 1006 (abnormal closure) and 1001 (going away) are very common
            // 1001 occurs during CloudFlare proxy restarts - expected behavior
          } else {
            // Other unexpected close codes are more concerning. The server
            // emits the authoritative ws.disconnected event; this is just
            // client-side operator narration.
            log.warn('WebSocket closed unexpectedly', {
              component: 'useWebSocketRoom',
              action: 'onClose',
              extra: {
                code: event.code,
                reason: event.reason || 'No reason provided',
              },
            });
          }
        }
      },

      onOpen: () => {
        setConnectedAt();
        setLastPongReceived(Date.now());
      },

      onReconnectStop: () => {
        // Not an error — expected after 20 retries (~190s): laptop closed,
        // network lost, or the user left. A client-only event the server can't
        // observe (it never sees the browser give up). user/room come from the
        // facade's userContext.
        recordEvent(EVENT.WS_RECONNECT_EXHAUSTED);
      },
    },
  );

  // Sync readyState to store whenever it changes
  useEffect(() => {
    setReadyState(readyState);
  }, [readyState, setReadyState]);

  const triggerAction = useCallback(
    (action: Action) => {
      try {
        if (readyState === ReadyState.OPEN) {
          const message = serializeWithTraceContext(action);
          sendMessage(message);
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
              return; // Don't queue leave actions

            case 'heartbeat':
              // Don't queue heartbeats when not connected - they're only useful when connected
              return;

            case 'rejoin':
              // Rejoin actions are only meaningful when we have a connection attempt
              if (readyState !== ReadyState.CONNECTING) {
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
        }
      } catch (error) {
        recordError(
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
          // Use the current active context — by the time a queued action
          // flushes, the user is on a fresh interaction, so injecting *now*
          // attaches the message to that new browser span. Better than a
          // stale traceparent captured at queue time.
          const message = serializeWithTraceContext(action);
          sendMessage(message);
        } catch (error) {
          recordError(
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
        // Queue drained after the socket came back → the reconnect completed.
        // Client-only signal (the server just sees fresh actions arrive).
        recordEvent(EVENT.WS_RECONNECTED);
      }

      actionQueueRef.current = [];
    }
  }, [readyState, sendMessage]);

  // eslint-disable-next-line react-hooks/refs -- Valid pattern: Keeping ref current for callback in action queue processing
  triggerActionRef.current = triggerAction;

  return { triggerAction, connectedAt, sendMessage };
};
