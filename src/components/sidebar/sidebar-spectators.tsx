import React from 'react';

import { Avatar, Badge, Group, Stack, Text } from '@mantine/core';

import { IconEye } from '@tabler/icons-react';
import type { Action } from 'fpp-server/src/room.actions';
import { type User } from 'fpp-server/src/room.entity';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';
import { useRoomStore } from 'fpp/store/room.store';

import { UserActions } from 'fpp/components/room/user-actions';
import SidebarContent from 'fpp/components/sidebar/sidebar-content';

const SidebarSpectators = ({
  triggerAction,
}: {
  triggerAction: (action: Action) => void;
}) => {
  const users = useRoomStore((store) => store.users);
  const spectators = users.filter((user) => user.isSpectator);

  return (
    <SidebarContent
      childrens={[
        {
          title: 'Spectators',
          content: (
            <SpectatorsList
              spectators={spectators}
              triggerAction={triggerAction}
            />
          ),
        },
      ]}
    />
  );
};

const SpectatorsList = ({
  spectators,
  triggerAction,
}: {
  spectators: User[];
  triggerAction: (action: Action) => void;
}) => {
  if (spectators.length === 0) {
    return (
      <div className="w-full text-center py-4">
        <Text size="sm" c="dimmed">
          No spectators in this room
        </Text>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Stack gap="sm">
        {spectators.map((spectator) => (
          <SpectatorCard
            key={spectator.id}
            spectator={spectator}
            triggerAction={triggerAction}
          />
        ))}
      </Stack>
    </div>
  );
};

const SpectatorCard = ({
  spectator,
  triggerAction,
}: {
  spectator: User;
  triggerAction: (action: Action) => void;
}) => {
  const userId = useLocalstorageStore((state) => state.userId);
  const roomId = useLocalstorageStore((state) => state.roomId);

  if (!userId || !roomId) {
    return (
      <div className="w-full text-center py-4">
        <Text size="sm" c="dimmed">
          No room selected
        </Text>
      </div>
    );
  }

  return (
    <Group
      gap="sm"
      p="xs"
      wrap="nowrap"
      className="rounded-md border border-gray-600 bg-gray-800/30"
    >
      <Avatar
        size={32}
        radius="xl"
        className={`${spectator.isPresent ? 'ring-1 ring-green-500' : 'ring-1 ring-gray-500'}`}
      >
        <IconEye size={16} />
      </Avatar>

      <div className="flex-1 text-left">
        <Group align="center" wrap="nowrap" justify="space-between">
          <Text size="sm" fw={500} className="leading-tight">
            {spectator.name}
          </Text>
          <Badge
            variant="light"
            size="xs"
            color={spectator.isPresent ? 'green' : 'gray'}
          >
            {spectator.isPresent ? 'Present' : 'Away'}
          </Badge>
        </Group>

        <Group gap="xs" mt="xs" wrap="nowrap">
          <UserActions
            user={spectator}
            userId={userId}
            roomId={roomId}
            triggerAction={triggerAction}
            layout="horizontal"
            size="xs"
          />
        </Group>
      </div>
    </Group>
  );
};

export default SidebarSpectators;
