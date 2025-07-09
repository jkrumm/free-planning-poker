import React from 'react';

import { useRouter } from 'next/router';

import { Avatar, Badge, Button, Group, Stack, Text } from '@mantine/core';

import {
  IconDoorExit,
  IconEye,
  IconEyeOff,
  IconUserMinus,
} from '@tabler/icons-react';
import type { Action } from 'fpp-server/src/room.actions';
import { type User } from 'fpp-server/src/room.entity';

import { executeLeave } from 'fpp/utils/room.util';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';
import { useRoomStore } from 'fpp/store/room.store';

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
  const router = useRouter();
  const userId = useLocalstorageStore((state) => state.userId);
  const roomId = useLocalstorageStore((state) => state.roomId);

  const isOwnUser = spectator.id === userId;

  if (!userId || !roomId)
    return (
      <div className="w-full text-center py-4">
        <Text size="sm" c="dimmed">
          No room selected
        </Text>
      </div>
    );

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
          {isOwnUser ? (
            // Own user actions
            <>
              <Button
                variant="light"
                color="blue"
                size="xs"
                leftSection={<IconEyeOff size={12} />}
                onClick={() => {
                  triggerAction({
                    action: 'setSpectator',
                    roomId,
                    userId,
                    targetUserId: spectator.id,
                    isSpectator: false,
                  });
                }}
              >
                Join voting
              </Button>
              <Button
                variant="light"
                color="gray"
                size="xs"
                leftSection={<IconDoorExit size={12} />}
                onClick={() => {
                  executeLeave({
                    roomId,
                    userId,
                    triggerAction,
                    router,
                  });
                }}
              >
                Leave
              </Button>
            </>
          ) : (
            // Other users actions
            <>
              <Button
                variant="light"
                color="blue"
                size="xs"
                leftSection={<IconEyeOff size={12} />}
                onClick={() => {
                  triggerAction({
                    action: 'setSpectator',
                    roomId,
                    userId,
                    targetUserId: spectator.id,
                    isSpectator: false,
                  });
                }}
              >
                Make participant
              </Button>
              <Button
                variant="light"
                color="red"
                size="xs"
                leftSection={<IconUserMinus size={12} />}
                onClick={() => {
                  triggerAction({
                    action: 'kick',
                    roomId: roomId,
                    userId: userId,
                    targetUserId: spectator.id,
                  });
                }}
              >
                Kick
              </Button>
            </>
          )}
        </Group>
      </div>
    </Group>
  );
};

export default SidebarSpectators;
