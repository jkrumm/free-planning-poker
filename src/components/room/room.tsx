import React, { useCallback, useEffect, useRef, useState } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

import { env } from 'fpp/env';

import * as Sentry from '@sentry/nextjs';
import { type Action, type HeartbeatAction } from 'fpp-server/src/room.actions';
import { RoomClient, type RoomDto } from 'fpp-server/src/room.entity';

import { logMsg } from 'fpp/constants/logging.constant';
import { WEBSOCKET_CONSTANTS } from 'fpp/constants/websocket.constants';

import { useRoomStore } from 'fpp/store/room.store';

import { ConnectionStatus } from 'fpp/components/room/connection-status';
import { Interactions } from 'fpp/components/room/interactions';
import { Table } from 'fpp/components/room/table';
import Sidebar from 'fpp/components/sidebar/sidebar';

import { Bookmark } from './bookmark';

export const Room = ({
  roomId,
  roomName,
  userId,
  username,
}: {
  roomId: number;
  roomName: string;
  userId: string;
  username: string;
}) => {
  const updateRoomState = useRoomStore((store) => store.update);
  const setConnectedAt = useRoomStore((store) => store.setConnectedAt);
  const connectedAt = useRoomStore((store) => store.connectedAt);

  const [lastPongReceived, setLastPongReceived] = useState<number>(Date.now());
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout>();
  const visibilityHeartbeatRef = useRef<NodeJS.Timeout>();
  const connectionHealthRef = useRef<NodeJS.Timeout>();

  const { sendMessage, readyState } = useWebSocket(
    `${
      env.NEXT_PUBLIC_NODE_ENV === 'production' ? 'wss' : 'ws'
    }://${env.NEXT_PUBLIC_FPP_SERVER_URL}/ws?roomId=${roomId}&userId=${userId}&username=${encodeURIComponent(username)}`,
    {
      shouldReconnect: () => true,
      reconnectAttempts: 20,
      // attemptNumber will be 0 the first time it attempts to reconnect, so this equation results in a reconnect pattern of
      // 1 second, 2 seconds, 4 seconds, 8 seconds, and then caps at 10 seconds until the maximum number of attempts is reached
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
            | { error: string };

          console.debug('onMessage', data);

          if ('error' in data) {
            // Handle specific error cases
            if (data.error === 'User not found - userId not found') {
              console.warn('User not found on server, triggering rejoin');
              triggerAction({
                action: 'rejoin',
                roomId,
                userId,
                username,
              });
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

          updateRoomState(RoomClient.fromJson(data));
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
        // Filter out trusted events that don't contain meaningful error info
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
        // Don't trigger leave action on close - the server will handle cleanup
      },
      onOpen: (event) => {
        console.debug('WebSocket connected:', event);
        setConnectedAt();
        setLastPongReceived(Date.now()); // Reset pong timer on connection
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

  // Handle user leaving the room when they actually close/navigate away
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.debug('Page unloading - user leaving room');
      // Use navigator.sendBeacon for more reliable delivery
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          `${env.NEXT_PUBLIC_NODE_ENV === 'production' ? 'https' : 'http'}://${env.NEXT_PUBLIC_FPP_SERVER_URL}/leave`,
          JSON.stringify({ roomId, userId }),
        );
      } else {
        // Fallback to WebSocket if beacon not supported
        triggerAction({
          action: 'leave',
          roomId,
          userId,
        });
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function to remove event listeners
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [roomId, userId, triggerAction]);

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

  // Page Visibility API and Window Focus - detect both tab changes and window focus
  useEffect(() => {
    const updatePresence = (isPresent: boolean) => {
      console.debug('Updating presence:', { isPresent, userId, roomId });
      triggerAction({
        action: 'setPresence',
        roomId,
        userId,
        isPresent,
      });
    };

    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      console.debug('Visibility changed:', {
        isVisible,
        hidden: document.hidden,
      });
      updatePresence(isVisible);

      if (isVisible) {
        console.debug('Tab became visible - sending immediate heartbeat');

        // Clear any existing timeout and send immediate heartbeat
        if (visibilityHeartbeatRef.current) {
          clearTimeout(visibilityHeartbeatRef.current);
        }

        // Send heartbeat after a small delay to ensure tab is fully active
        visibilityHeartbeatRef.current = setTimeout(() => {
          sendHeartbeat();
          // Reset the pong timer since we're active again
          setLastPongReceived(Date.now());
        }, 100);
      }
    };

    const handleFocus = () => {
      console.debug('Window focused - user is active');
      updatePresence(true);
      sendHeartbeat();
    };

    const handleBlur = () => {
      console.debug('Window blurred - user is away');
      updatePresence(false);
    };

    // Network change detection
    const handleOnline = () => {
      console.debug('Network came online - sending heartbeat');
      sendHeartbeat();
    };

    // Set initial presence based on current visibility and focus state
    const isCurrentlyActive = !document.hidden && document.hasFocus();
    updatePresence(isCurrentlyActive);

    // Add all event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('online', handleOnline);
      if (visibilityHeartbeatRef.current) {
        clearTimeout(visibilityHeartbeatRef.current);
      }
    };
  }, [sendHeartbeat, triggerAction, roomId, userId]);

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

  return (
    <>
      <div className="w-screen h-screen hidden items-start md:flex">
        <ConnectionStatus readyState={readyState} connectedAt={connectedAt} />
        <Bookmark userId={userId} />
        <div className="flex-1">
          <Table
            roomId={roomId}
            userId={userId}
            triggerAction={triggerAction}
          />
        </div>
        <Sidebar triggerAction={triggerAction} />
      </div>
      <Interactions
        roomId={roomId}
        roomName={roomName}
        userId={userId}
        triggerAction={triggerAction}
        readyState={readyState}
      />
    </>
  );
};
