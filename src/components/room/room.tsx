import React, { useCallback, useEffect } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

import { env } from 'fpp/env';

import * as Sentry from '@sentry/nextjs';
import { type Action, type HeartbeatAction } from 'fpp-server/src/room.actions';
import { RoomClient, type RoomDto } from 'fpp-server/src/room.entity';

import { logMsg } from 'fpp/constants/logging.constant';

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
      heartbeat: {
        message: JSON.stringify({
          userId,
          roomId,
          action: 'heartbeat',
        } satisfies HeartbeatAction),
        returnMessage: 'pong',
        timeout: 60000, // 1 minute, if no response is received, the connection will be closed
        interval: 15000, // every 15 seconds, a ping message will be sent
      },
      onMessage: (message: MessageEvent<string>) => {
        if (!message.data) {
          return;
        }

        if (message.data === 'pong') {
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

    const handlePageHide = () => {
      // Handle cases where beforeunload doesn't fire (mobile Safari, etc.)
      triggerAction({
        action: 'leave',
        roomId,
        userId,
      });
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    // Cleanup function to remove event listeners
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [roomId, userId, triggerAction]);

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
      />
    </>
  );
};
