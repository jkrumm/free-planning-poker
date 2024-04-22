import React from 'react';

// import { type Logger } from 'next-axiom';
import { useHeartbeat } from 'fpp/hooks/use-heartbeat.hook';
import { useRoomState } from 'fpp/hooks/use-room-state.hook';

import { Interactions } from 'fpp/components/room/interactions';
import { Table } from 'fpp/components/room/table';
import Sidebar from 'fpp/components/sidebar/sidebar';

export const Room = ({
  roomId,
  roomName,
  userId,
  username,
  // logger,
}: {
  roomId: number;
  roomName: string;
  userId: string;
  username: string;
  // logger: Logger;
}) => {
  // Listen to room state updates
  useRoomState({
    roomId,
    userId,
    username,
    // logger,
  });

  // Send heartbeats every 10 seconds
  useHeartbeat({
    roomId,
    userId,
    // logger,
  });

  return (
    <>
      <div className="w-screen h-screen hidden items-start md:flex">
        <div className="flex-1">
          {/*<Table roomId={roomId} userId={userId} logger={logger} />*/}
          <Table roomId={roomId} userId={userId} />
        </div>
        <Sidebar />
      </div>
      <Interactions
        roomId={roomId}
        roomName={roomName}
        userId={userId}
        // logger={logger}
      />
    </>
  );
};
