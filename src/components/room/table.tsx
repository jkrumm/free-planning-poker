'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Button, HoverCard, Text } from '@mantine/core';

import { type Action } from 'fpp-server/src/room.actions';
import { RoomStateStatus, type User } from 'fpp-server/src/room.entity';

import {
  getAverageFromUsers,
  getStackedEstimationsFromUsers,
} from 'fpp/utils/room.util';

import { useRoomStore } from 'fpp/store/room.store';

// Helper function to format time since last heartbeat
const formatTimeSince = (lastHeartbeat: number): string => {
  const now = Date.now();
  const diffInSeconds = Math.floor((now - lastHeartbeat) / 1000);

  if (diffInSeconds < 60) {
    return diffInSeconds <= 5 ? 'just now' : `${diffInSeconds} seconds ago`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes === 1) {
    return '1 minute ago';
  }
  return `${diffInMinutes} minutes ago`;
};

// Custom hook for live time updates
const useLastSeenTime = (
  lastHeartbeat: number | undefined,
  isOpen: boolean,
) => {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (isOpen && lastHeartbeat) {
      // Update immediately
      setCurrentTime(Date.now());

      // Update every second while hover card is open
      intervalRef.current = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
    } else {
      // Clear interval when closed
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isOpen, lastHeartbeat]);

  if (!lastHeartbeat) return 'Unknown';

  const diffInSeconds = Math.floor((currentTime - lastHeartbeat) / 1000);

  if (diffInSeconds < 60) {
    return diffInSeconds <= 5 ? 'just now' : `${diffInSeconds} seconds ago`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes === 1) {
    return '1 minute ago';
  }
  return `${diffInMinutes} minutes ago`;
};

// User HoverCard component
const UserHoverCard = ({ user, userId }: { user: User; userId: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const lastHeartbeat = useLastSeenTime(
    user.lastHeartbeat,
    isOpen && !user.isPresent,
  );

  return (
    <HoverCard
      width={200}
      shadow="md"
      openDelay={300}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
    >
      <HoverCard.Target>
        <div className="flex items-center justify-center gap-1.5 cursor-pointer">
          <div
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              user.isPresent ? 'bg-green-500' : 'bg-orange-500'
            }`}
          />
          <span className={user.id === userId ? 'font-bold' : ''}>
            {user.name}
          </span>
        </div>
      </HoverCard.Target>
      <HoverCard.Dropdown>
        <Text size="sm" fw={500} mb="xs">
          {user.name}
        </Text>
        <Text size="xs" mb={user.isPresent ? 0 : 'xs'}>
          {user.isPresent ? '🟢 Currently active' : '🟠 Away from room'}
        </Text>
        {!user.isPresent && user.lastHeartbeat && (
          <Text size="xs" c="dimmed">
            Last signal: {lastHeartbeat}
          </Text>
        )}
      </HoverCard.Dropdown>
    </HoverCard>
  );
};

export const Table = ({
  roomId,
  userId,
  triggerAction,
}: {
  roomId: number;
  userId: string;
  triggerAction: (action: Action) => void;
}) => {
  const users = useRoomStore((store) => store.users);
  const status = useRoomStore((store) => store.status);

  return (
    <div className="table">
      <div className="card-place">
        {(function () {
          switch (status) {
            case RoomStateStatus.flipped:
              return (
                <StackedEstimations
                  users={users}
                  triggerAction={triggerAction}
                />
              );
            case RoomStateStatus.flippable:
              return (
                <ShowVotesButton
                  roomId={roomId}
                  userId={userId}
                  triggerAction={triggerAction}
                />
              );
            case RoomStateStatus.estimating:
            default:
              return <div className="vote">VOTE</div>;
          }
        })()}
      </div>

      <div className="players">
        {users.map((user, index) => (
          <div key={index} className={`player player-${index + 1}`}>
            <div className={`avatar bg-gray-800 ${user.status}`} />
            <div className={`name ${user.id === userId && 'font-bold'}`}>
              <UserHoverCard user={user} userId={userId} />
            </div>
            <div
              className={`card players ${status === RoomStateStatus.flipped && 'flipped'} ${
                user.status
              }`}
            >
              {user.estimation}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function StackedEstimations({
  users,
  triggerAction,
}: {
  users: User[];
  triggerAction: (action: Action) => void;
}) {
  return (
    <>
      {getStackedEstimationsFromUsers(users, triggerAction).map(
        (item, index) => (
          <div key={index} className={`card-wrapper amount-${item.amount}`}>
            {(function () {
              const cards = [];
              for (let i = 0; i < item.amount; i++) {
                cards.push(
                  <div className="card" key={i}>
                    {item.number}
                  </div>,
                );
              }
              return cards;
            })()}
          </div>
        ),
      )}
      <div className="average">{getAverageFromUsers(users, triggerAction)}</div>
    </>
  );
}

function ShowVotesButton({
  roomId,
  userId,
  triggerAction,
}: {
  roomId: number;
  userId: string;
  triggerAction: (action: Action) => void;
}) {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <Button
        size="lg"
        className="center"
        onClick={() => {
          triggerAction({
            action: 'flip',
            roomId,
            userId,
          });
        }}
      >
        Show Votes
      </Button>
    </div>
  );
}
