import { type Logger } from "next-axiom";
import { Table } from "fpp/components/room/table";
import { Interactions } from "fpp/components/room/interactions";
import React from "react";
import { useHeartbeat } from "fpp/hooks/use-heartbeat.hook";
import { useRoomState } from "fpp/hooks/use-room-state.hook";

export const Room = ({
  roomId,
  roomReadable,
  userId,
  username,
  logger,
}: {
  roomId: number;
  roomReadable: string;
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
        roomReadable={roomReadable}
        userId={userId}
        logger={logger}
      />
    </>
  );
};
