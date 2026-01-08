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
import { type User } from 'fpp-server/src/room.types';

import { executeLeave } from 'fpp/utils/room.util';

import { SidebarTabs, useSidebarStore } from 'fpp/store/sidebar.store';

interface UserActionsProps {
  user: User;
  userId: string;
  roomId: number;
  triggerAction: (action: Action) => void;
  onActionComplete?: () => void;
  layout?: 'horizontal' | 'vertical';
  size?: 'xs' | 'sm' | 'md';
}

interface ButtonConfig {
  key: string;
  color: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

/**
 * Get icon size based on button size prop
 */
const getIconSize = (size: 'xs' | 'sm' | 'md'): number =>
  size === 'xs' ? 12 : 14;

/**
 * Build button configurations based on user context
 */
const buildButtonConfigs = (
  isOwnUser: boolean,
  user: User,
  layout: 'horizontal' | 'vertical',
  iconSize: number,
  handlers: {
    onSpectatorToggle: () => void;
    onLeaveRoom: () => void;
    onKickUser: () => void;
  },
): ButtonConfig[] => {
  const spectatorButton: ButtonConfig = {
    key: 'spectator',
    color: user.isSpectator ? 'blue' : 'gray',
    icon: user.isSpectator ? (
      <IconEye size={iconSize} />
    ) : (
      <IconEyeOff size={iconSize} />
    ),
    label: isOwnUser
      ? user.isSpectator
        ? 'Join voting'
        : 'Become spectator'
      : user.isSpectator
        ? 'Make participant'
        : 'Make spectator',
    onClick: handlers.onSpectatorToggle,
  };

  const secondButton: ButtonConfig = isOwnUser
    ? {
        key: 'leave',
        color: 'gray',
        icon: <IconDoorExit size={iconSize} />,
        label: layout === 'vertical' ? 'Leave room' : 'Leave',
        onClick: handlers.onLeaveRoom,
      }
    : {
        key: 'kick',
        color: 'red',
        icon: <IconUserMinus size={iconSize} />,
        label: layout === 'vertical' ? 'Kick from room' : 'Kick',
        onClick: handlers.onKickUser,
      };

  return [spectatorButton, secondButton];
};

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
  const setTab = useSidebarStore((state) => state.setTab);

  const handlers = {
    onSpectatorToggle: () => {
      triggerAction({
        action: 'setSpectator',
        roomId,
        userId,
        targetUserId: user.id,
        isSpectator: !user.isSpectator,
      });
      setTab(user.isSpectator ? null : SidebarTabs.spectators);
      onActionComplete?.();
    },
    onLeaveRoom: () => {
      executeLeave({ roomId, userId, triggerAction, router });
      onActionComplete?.();
    },
    onKickUser: () => {
      triggerAction({
        action: 'kick',
        roomId,
        userId,
        targetUserId: user.id,
      });
      onActionComplete?.();
    },
  };

  const iconSize = getIconSize(size);
  const buttons = buildButtonConfigs(
    isOwnUser,
    user,
    layout,
    iconSize,
    handlers,
  );

  const Container = layout === 'vertical' ? Stack : Group;
  const containerProps =
    layout === 'vertical'
      ? { gap: 'xs' }
      : { gap: 'xs', wrap: 'nowrap' as const };

  return (
    <Container {...containerProps}>
      {buttons.map((btn) => (
        <Button
          key={btn.key}
          variant="light"
          color={btn.color}
          size={size}
          leftSection={btn.icon}
          onClick={btn.onClick}
          {...(layout === 'vertical' && { fullWidth: true })}
        >
          {btn.label}
        </Button>
      ))}
    </Container>
  );
};
