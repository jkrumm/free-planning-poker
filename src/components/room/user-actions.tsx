import React from 'react';

import { useRouter } from 'next/router';

import { Button, Group, Stack } from '@mantine/core';

import {
  IconDoorExit,
  IconEye,
  IconEyeOff,
  IconUserMinus,
} from '@tabler/icons-react';
import type { Action } from 'fpp-server/src/room.actions';
import { type User } from 'fpp-server/src/room.entity';

import { executeLeave } from 'fpp/utils/room.util';

interface UserActionsProps {
  user: User;
  userId: string;
  roomId: number;
  triggerAction: (action: Action) => void;
  onActionComplete?: () => void;
  layout?: 'horizontal' | 'vertical';
  size?: 'xs' | 'sm' | 'md';
}

export const UserActions = ({
  user,
  userId,
  roomId,
  triggerAction,
  onActionComplete,
  layout = 'horizontal',
  size = 'xs',
}: UserActionsProps) => {
  const router = useRouter();
  const isOwnUser = user.id === userId;

  const handleSpectatorToggle = () => {
    triggerAction({
      action: 'setSpectator',
      roomId,
      userId,
      targetUserId: user.id,
      isSpectator: !user.isSpectator,
    });
    onActionComplete?.();
  };

  const handleLeaveRoom = () => {
    executeLeave({
      roomId,
      userId,
      triggerAction,
      router,
    });
    onActionComplete?.();
  };

  const handleKickUser = () => {
    triggerAction({
      action: 'kick',
      roomId,
      userId,
      targetUserId: user.id,
    });
    onActionComplete?.();
  };

  const Container = layout === 'vertical' ? Stack : Group;
  const containerProps =
    layout === 'vertical'
      ? { gap: 'xs' }
      : { gap: 'xs', wrap: 'nowrap' as const };

  if (isOwnUser) {
    return (
      <Container {...containerProps}>
        <Button
          variant="light"
          color={user.isSpectator ? 'blue' : 'gray'}
          size={size}
          leftSection={
            user.isSpectator ? (
              <IconEye size={size === 'xs' ? 12 : 14} />
            ) : (
              <IconEyeOff size={size === 'xs' ? 12 : 14} />
            )
          }
          onClick={handleSpectatorToggle}
          {...(layout === 'vertical' && { fullWidth: true })}
        >
          {user.isSpectator ? 'Join voting' : 'Become spectator'}
        </Button>
        <Button
          variant="light"
          color="gray"
          size={size}
          leftSection={<IconDoorExit size={size === 'xs' ? 12 : 14} />}
          onClick={handleLeaveRoom}
          {...(layout === 'vertical' && { fullWidth: true })}
        >
          {layout === 'vertical' ? 'Leave room' : 'Leave'}
        </Button>
      </Container>
    );
  }

  return (
    <Container {...containerProps}>
      <Button
        variant="light"
        color={user.isSpectator ? 'blue' : 'gray'}
        size={size}
        leftSection={
          user.isSpectator ? (
            <IconEye size={size === 'xs' ? 12 : 14} />
          ) : (
            <IconEyeOff size={size === 'xs' ? 12 : 14} />
          )
        }
        onClick={handleSpectatorToggle}
        {...(layout === 'vertical' && { fullWidth: true })}
      >
        {user.isSpectator ? 'Make participant' : 'Make spectator'}
      </Button>
      <Button
        variant="light"
        color="red"
        size={size}
        leftSection={<IconUserMinus size={size === 'xs' ? 12 : 14} />}
        onClick={handleKickUser}
        {...(layout === 'vertical' && { fullWidth: true })}
      >
        {layout === 'vertical' ? 'Kick from room' : 'Kick'}
      </Button>
    </Container>
  );
};
