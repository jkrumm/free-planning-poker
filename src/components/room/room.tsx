import React from 'react';
import useWebSocket from 'react-use-websocket';

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
    }://${env.NEXT_PUBLIC_FPP_SERVER_URL}/ws?roomId=${roomId}&userId=${userId}&username=${username}`,
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
        timeout: 3 * 60000, // 3 minutes, if no response is received, the connection will be closed
        interval: 30000, // every 30 second, a ping message will be sent
      },
      onMessage: (message: MessageEvent<string>) => {
        if (message.data === 'pong') {
          return;
        }

        try {
          const data = JSON.parse(String(message.data)) as
            | RoomDto
            | { error: string };

          console.debug('onMessage', data);

          if ('error' in data) {
            console.error('Error:', data.error);
            Sentry.captureException(new Error(logMsg.INCOMING_MESSAGE), {
              extra: {
                message: data,
                roomId,
              },
              tags: {
                endpoint: logMsg.INCOMING_MESSAGE,
              },
            });
            return;
          }

          updateRoomState(
            RoomClient.fromJson(JSON.parse(String(message.data)) as RoomDto),
          );
        } catch (e) {
          console.error('Error onMessage:', e);
          console.debug('onMessage', message);
          Sentry.captureException(e, {
            extra: {
              message: message,
              roomId,
            },
            tags: {
              endpoint: logMsg.INCOMING_MESSAGE,
            },
          });
        }
      },
      onError: (event) => {
        console.error('onError', event);
        Sentry.captureException(new Error(logMsg.INCOMING_ERROR), {
          extra: {
            message: event,
            roomId,
          },
          tags: {
            endpoint: logMsg.INCOMING_ERROR,
          },
        });
      },
      onClose: (event) => {
        console.warn('onClose', event);
      },
      onOpen: (event) => {
        console.debug('onOpen', event);
        setConnectedAt();
      },
    },
  );

  const triggerAction = (action: Action) => {
    sendMessage(JSON.stringify(action));
  };

  window.addEventListener('beforeunload', () => {
    triggerAction({
      action: 'leave',
      roomId,
      userId,
    });
  });

  return (
    <>
      <div className="w-screen h-screen hidden items-start md:flex">
        <ConnectionStatus readyState={readyState} connectedAt={connectedAt} />
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
