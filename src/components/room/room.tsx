import React from 'react';

import { type Logger } from 'next-axiom';

import { useHeartbeat } from 'fpp/hooks/use-heartbeat.hook';
import { useRoomState } from 'fpp/hooks/use-room-state.hook';

import { Interactions } from 'fpp/components/room/interactions';
import { Table } from 'fpp/components/room/table';

export const Room = ({
  roomId,
  roomName,
  userId,
  username,
  logger,
}: {
  roomId: number;
  roomName: string;
  userId: string;
  username: string;
  logger: Logger;
}) => {
  // Listen to room state updates
  useRoomState({
    roomId,
    userId,
    username,
    logger,
  });

  // Send heartbeats every 10 seconds
  useHeartbeat({
    roomId,
    userId,
    logger,
  });

  return (
    <>
      <Table roomId={roomId} userId={userId} logger={logger} />
      <Interactions
        roomId={roomId}
        roomName={roomName}
        userId={userId}
        logger={logger}
      />
    </>
  );
};