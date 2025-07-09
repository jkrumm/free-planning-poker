import React from 'react';

import { useConnectionHealth } from 'fpp/hooks/useConnectionHealth';
import { useHeartbeat } from 'fpp/hooks/useHeartbeat';
import { useLeaveRoomHandler } from 'fpp/hooks/useLeaveRoomHandler';
import { usePresenceTracking } from 'fpp/hooks/usePresenceTracking';
import { useViewMode } from 'fpp/hooks/useViewMode';
import { useWebSocketRoom } from 'fpp/hooks/useWebSocketRoom';

import { CardList } from 'fpp/components/room/card-list';
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

  // Determine view mode
  const viewMode = useViewMode();

  return (
    <>
      <div className="w-screen h-screen flex">
        <div className="flex-1">
          <div className="flex-1 items-start flex">
            <ConnectionStatus connectedAt={connectedAt} />
            <Bookmark userId={userId} />
          </div>
          {viewMode === 'cardList' ? (
            <CardList
              roomId={roomId}
              userId={userId}
              triggerAction={triggerAction}
            />
          ) : (
            <Table
              roomId={roomId}
              userId={userId}
              triggerAction={triggerAction}
            />
          )}
        </div>
        <div>
          <Sidebar triggerAction={triggerAction} />
        </div>
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
