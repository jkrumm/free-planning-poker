import { useEffect, useState } from 'react';

import { HoverCard, Text } from '@mantine/core';

import { type Action } from 'fpp-server/src/room.actions';
import { type User } from 'fpp-server/src/room.entity';

import { UserActions } from 'fpp/components/room/user-actions';

// Simplified function to format time since last heartbeat
const formatTimeSince = (lastHeartbeat: number | undefined): string => {
  if (!lastHeartbeat) return 'Unknown';

  const diffInSeconds = Math.floor((Date.now() - lastHeartbeat) / 1000);

  if (diffInSeconds < 60) {
    return diffInSeconds <= 5 ? 'just now' : `${diffInSeconds} seconds ago`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  return diffInMinutes === 1 ? '1 minute ago' : `${diffInMinutes} minutes ago`;
};

export const UserHoverCard = ({
  user,
  userId,
  roomId,
  triggerAction,
}: {
  user: User;
  userId: string;
  roomId: number;
  triggerAction: (action: Action) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [lastSeenTime, setLastSeenTime] = useState<string>(
    formatTimeSince(user.lastHeartbeat),
  );

  // Update the last seen time every second when the hover card is open
  useEffect(() => {
    if (!isOpen || user.isPresent) return;

    const intervalId = setInterval(() => {
      setLastSeenTime(formatTimeSince(user.lastHeartbeat));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isOpen, user.isPresent, user.lastHeartbeat]);

  const isOwnUser = user.id === userId;

  return (
    <HoverCard
      width={200}
      shadow="md"
      openDelay={300}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
    >
      <HoverCard.Target>
        <div className="flex items-center justify-around gap-1.5 cursor-pointer max-w-full">
          <span className={isOwnUser ? 'font-bold' : ''}>{user.name}</span>
        </div>
      </HoverCard.Target>
      <HoverCard.Dropdown>
        <Text size="sm" fw={500} mb="xs">
          {user.name}
        </Text>
        <Text size="xs" mb={user.isPresent ? 0 : 'xs'}>
          {user.isPresent ? '🟢 Currently present' : '🟠 Away from room'}
        </Text>
        {!user.isPresent && !!user.lastHeartbeat && (
          <Text size="xs" c="dimmed">
            Last signal: {lastSeenTime}
          </Text>
        )}

        <div className="mt-4">
          <UserActions
            user={user}
            userId={userId}
            roomId={roomId}
            triggerAction={triggerAction}
            onActionComplete={() => setIsOpen(false)}
            layout="vertical"
            size="xs"
          />
        </div>
      </HoverCard.Dropdown>
    </HoverCard>
  );
};
