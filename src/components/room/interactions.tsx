import { useState } from 'react';
import { ReadyState } from 'react-use-websocket';

import { useRouter } from 'next/router';

import { Button, Group, Tooltip } from '@mantine/core';

import { IconCopy, IconEdit, IconEye } from '@tabler/icons-react';
import { type Action } from 'fpp-server/src/room.actions';
import { RoomStateStatus } from 'fpp-server/src/room.types';

import { fibonacciSequence } from 'fpp/constants/fibonacci.constant';

import { addBreadcrumb, captureError } from 'fpp/utils/app-error';
import { copyToClipboard } from 'fpp/utils/copy-top-clipboard.util';
import { isValidMediumint } from 'fpp/utils/number.utils';
import { executeLeave } from 'fpp/utils/room.util';

import { useRoomStore } from 'fpp/store/room.store';
import { SidebarTabs, useSidebarStore } from 'fpp/store/sidebar.store';

import Counter from 'fpp/components/room/counter';

export const Interactions = ({
  roomId,
  roomName,
  userId,
  triggerAction,
}: {
  roomId: number;
  roomName: string;
  userId: string;
  triggerAction: (action: Action) => void;
}) => {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);

  // User state
  const estimation = useRoomStore((store) => store.estimation);
  const isSpectator = useRoomStore((store) => store.isSpectator);

  // Room
  const status = useRoomStore((store) => store.status);
  const userCount = useRoomStore((store) => store.userCount);

  // Sidebar
  const setTab = useSidebarStore((state) => state.setTab);

  // Connection
  const readyState = useRoomStore((store) => store.readyState);
  const isConnected = readyState === ReadyState.OPEN;

  const handleCopyUrl = () => {
    try {
      if (!window.location) {
        captureError(
          'Window location not available',
          {
            component: 'Interactions',
            action: 'handleCopyUrl',
            extra: { roomId, userId },
          },
          'low',
        );
        return;
      }
      copyToClipboard(window.location.toString(), userId);
      addBreadcrumb('Room URL copied to clipboard', 'room', {
        roomId,
        roomName,
      });
    } catch (error) {
      captureError(
        error instanceof Error ? error : new Error('Failed to copy room URL'),
        {
          component: 'Interactions',
          action: 'handleCopyUrl',
          extra: { roomId, userId },
        },
        'medium',
      );
    }
  };

  const handleEditRoomName = () => {
    try {
      setTab(SidebarTabs.settings);
      addBreadcrumb('Room name edit requested', 'room', {
        roomId,
        roomName,
      });
    } catch (error) {
      captureError(
        error instanceof Error
          ? error
          : new Error('Failed to open room settings'),
        {
          component: 'Interactions',
          action: 'handleEditRoomName',
          extra: { roomId, userId },
        },
        'medium',
      );
    }
  };

  const handleSpectatorToggle = () => {
    try {
      triggerAction({
        action: 'setSpectator',
        roomId,
        userId,
        targetUserId: userId,
        isSpectator: !isSpectator,
      });
      setTab(isSpectator ? null : SidebarTabs.spectators);
      addBreadcrumb('Spectator mode toggled', 'room', {
        newSpectatorState: !isSpectator,
        roomId,
      });
    } catch (error) {
      captureError(
        error instanceof Error
          ? error
          : new Error('Failed to toggle spectator mode'),
        {
          component: 'Interactions',
          action: 'handleSpectatorToggle',
          extra: {
            roomId,
            userId,
            currentSpectatorState: isSpectator,
          },
        },
        'medium',
      );
    }
  };

  const handleReset = () => {
    try {
      triggerAction({
        action: 'reset',
        roomId,
        userId,
      });
      addBreadcrumb('Room reset requested', 'room', {
        roomId,
        status,
      });
    } catch (error) {
      captureError(
        error instanceof Error ? error : new Error('Failed to reset room'),
        {
          component: 'Interactions',
          action: 'handleReset',
          extra: { roomId, userId, status },
        },
        'medium',
      );
    }
  };

  const handleLeave = () => {
    try {
      executeLeave({
        roomId,
        userId,
        triggerAction,
        router,
      });
      addBreadcrumb('Room leave requested', 'room', {
        roomId,
      });
    } catch (error) {
      captureError(
        error instanceof Error ? error : new Error('Failed to leave room'),
        {
          component: 'Interactions',
          action: 'handleLeave',
          extra: { roomId, userId },
        },
        'high', // High priority as it affects navigation
      );
    }
  };

  const handleEstimate = (number: number) => {
    try {
      const newEstimation = estimation === number ? null : number;
      triggerAction({
        action: 'estimate',
        roomId,
        userId,
        estimation: newEstimation,
      });
      addBreadcrumb('Estimation submitted', 'room', {
        estimation: newEstimation,
        roomId,
      });
    } catch (error) {
      captureError(
        error instanceof Error
          ? error
          : new Error('Failed to submit estimation'),
        {
          component: 'Interactions',
          action: 'handleEstimate',
          extra: {
            roomId,
            userId,
            estimation: number,
            currentEstimation: estimation,
          },
        },
        'medium',
      );
    }
  };

  const shouldShowTooltip = userCount === 1 || isHovered;

  addBreadcrumb('Interactions component rendered', 'room', {
    roomId,
    isConnected,
    isSpectator,
    status,
    userCount,
  });

  return (
    <div className="fixed bottom-0 left-0 w-screen flex justify-center h-[160px] sm:h-[170px] border-t md:border-0 border-[#424242] bg-[#242424] z-10">
      <div className="w-full max-w-xl p-2 sm:p-4 flex flex-col space-y-2">
        {/* Room Name - Top Row */}
        <div className="flex justify-start">
          <Group gap={0} className="room-name-group">
            <Button
              variant="subtle"
              color="gray"
              size="lg"
              className="room-action-button"
              onClick={handleEditRoomName}
            >
              <IconEdit size={16} />
            </Button>
            <Button
              variant="subtle"
              color="gray"
              size="lg"
              className="room-action-button"
              onClick={handleCopyUrl}
            >
              <IconCopy size={16} />
            </Button>
            <Tooltip
              label="Click the room name to copy the URL and share it with your colleagues"
              position="top"
              opened={shouldShowTooltip}
              withArrow
              multiline
              w={270}
              events={{ hover: true, focus: false, touch: false }}
              zIndex={30}
            >
              <Button
                variant="subtle"
                color="gray"
                size="lg"
                className="room-name-button"
                onClick={handleCopyUrl}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onFocus={() => setIsHovered(true)}
                onBlur={() => setIsHovered(false)}
              >
                <h2 className="room-name-text">
                  {isValidMediumint(roomName) && roomName.length === 6
                    ? roomName.slice(0, 3) + ' ' + roomName.slice(3)
                    : roomName.toUpperCase()}
                </h2>
              </Button>
            </Tooltip>
          </Group>
        </div>

        {/* Action Buttons and Counter - Middle Row */}
        <div className="flex items-center justify-between">
          <Button.Group>
            <Button
              disabled={!isConnected || status === RoomStateStatus.flipped}
              variant={isSpectator ? 'filled' : 'default'}
              leftSection={<IconEye size={16} />}
              size="sm"
              className="text-xs sm:text-sm"
              onClick={handleSpectatorToggle}
            >
              Spectator
            </Button>
            <Button
              disabled={!isConnected}
              variant={
                status === RoomStateStatus.flipped ? 'filled' : 'default'
              }
              size="sm"
              className="text-xs sm:text-sm"
              onClick={handleReset}
            >
              {status === RoomStateStatus.flipped ? (
                <>
                  <span className="hidden sm:inline">New Round</span>
                  <span className="sm:hidden">New</span>
                </>
              ) : (
                'Reset'
              )}
            </Button>
            <Button
              variant="default"
              size="sm"
              className="text-xs sm:text-sm"
              onClick={handleLeave}
            >
              Leave
            </Button>
          </Button.Group>
          <Counter />
        </div>

        {/* Estimation Buttons - Bottom Row */}
        <div className="w-full">
          <Button.Group className="w-full flex">
            {fibonacciSequence.map((number) => (
              <Button
                disabled={
                  !isConnected ||
                  isSpectator ||
                  status === RoomStateStatus.flipped
                }
                variant={estimation === number ? 'filled' : 'default'}
                size="lg"
                fullWidth
                key={number}
                className="flex-1 text-sm sm:text-base p-0"
                onClick={() => handleEstimate(number)}
              >
                {number}
              </Button>
            ))}
          </Button.Group>
        </div>
      </div>
    </div>
  );
};
