import { useEffect, useState } from 'react';

import { Button, HoverCard, Text } from '@mantine/core';

import { IconUserMinus } from '@tabler/icons-react';
import { type Action } from 'fpp-server/src/room.actions';
import { type User } from 'fpp-server/src/room.entity';

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
        {!user.isPresent && !!user.lastHeartbeat && (
          <Text size="xs" c="dimmed">
            Last signal: {lastSeenTime}
          </Text>
        )}
        {user.id !== userId && (
          <Button
            variant="light"
            color="red"
            size="xs"
            leftSection={<IconUserMinus size={14} />}
            mt="md"
            fullWidth
            onClick={() => {
              triggerAction({
                action: 'kick',
                roomId,
                userId,
                targetUserId: user.id,
              });
              setIsOpen(false);
            }}
          >
            Kick from room
          </Button>
        )}
      </HoverCard.Dropdown>
    </HoverCard>
  );
};
