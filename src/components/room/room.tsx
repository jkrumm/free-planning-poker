import React from 'react';

import { useConnectionHealth } from 'fpp/hooks/useConnectionHealth';
import { useHeartbeat } from 'fpp/hooks/useHeartbeat';
import { useLeaveRoomHandler } from 'fpp/hooks/useLeaveRoomHandler';
import { usePresenceTracking } from 'fpp/hooks/usePresenceTracking';
import { useWebSocketRoom } from 'fpp/hooks/useWebSocketRoom';

import { ConnectionStatus } from 'fpp/components/room/connection-status';
import { Interactions } from 'fpp/components/room/interactions';
import { Table } from 'fpp/components/room/table';
import Sidebar from 'fpp/components/sidebar/sidebar';

import { Bookmark } from './bookmark';

export interface RoomProps {
  roomId: number;
  roomName: string;
  userId: string;
  username: string;
}

export const Room = ({ roomId, roomName, userId, username }: RoomProps) => {
  // Main WebSocket connection & state
  const { triggerAction, connectedAt, sendMessage } = useWebSocketRoom({
    roomId,
    userId,
    username,
  });

  // Send WebSocket heartbeats
  const { sendHeartbeat } = useHeartbeat({
    sendMessage,
    userId,
    roomId,
  });

  // Track user presence (active/away)
  usePresenceTracking({
    triggerAction,
    sendHeartbeat,
    roomId,
    userId,
  });

  // Handle user leaving the room
  useLeaveRoomHandler({
    roomId,
    userId,
    triggerAction,
  });

  // Monitor connection health
  useConnectionHealth();

  return (
    <>
      <div className="w-screen h-screen hidden items-start md:flex">
        <ConnectionStatus connectedAt={connectedAt} />
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
