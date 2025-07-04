import { useEffect, useRef, useState } from 'react';
import { HoverCard, Text } from '@mantine/core';
import { type User } from 'fpp-server/src/room.entity';

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
export const UserHoverCard = ({ user, userId }: { user: User; userId: string }) => {
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
        {!user.isPresent && !!user.lastHeartbeat && (
          <Text size="xs" c="dimmed">
            Last signal: {lastHeartbeat}
          </Text>
        )}
      </HoverCard.Dropdown>
    </HoverCard>
  );
};