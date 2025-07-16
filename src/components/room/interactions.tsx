import { ReadyState } from 'react-use-websocket';

import { useRouter } from 'next/router';

import { Button, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';

import { IconCopy, IconEdit, IconEye } from '@tabler/icons-react';
import { type Action } from 'fpp-server/src/room.actions';
import { RoomStateStatus } from 'fpp-server/src/room.entity';

import { fibonacciSequence } from 'fpp/constants/fibonacci.constant';

import { isValidMediumint } from 'fpp/utils/number.utils';
import { executeLeave } from 'fpp/utils/room.util';
import { sendTrackEvent } from 'fpp/utils/send-track-event.util';

import { useRoomStore } from 'fpp/store/room.store';

import { EventType } from 'fpp/server/db/schema';

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

  // User state
  const estimation = useRoomStore((store) => store.estimation);
  const isSpectator = useRoomStore((store) => store.isSpectator);

  // Room
  const status = useRoomStore((store) => store.status);

  // Connection
  const readyState = useRoomStore((store) => store.readyState);
  const isConnected = readyState === ReadyState.OPEN;

  const handleCopyUrl = () => {
    if (!window.location) {
      return;
    }
    if ('clipboard' in navigator) {
      navigator.clipboard
        .writeText(window.location.toString())
        .then(() => ({}))
        .catch(() => ({}));
    } else {
      document.execCommand('copy', true, window.location.toString());
    }
    notifications.show({
      color: 'green',
      autoClose: 3000,
      withCloseButton: true,
      title: 'Room URL copied to clipboard',
      message: 'Share it with your team!',
    });
    sendTrackEvent({
      event: EventType.COPIED_ROOM_LINK,
      userId,
    });
  };

  const handleEditRoomName = () => {
    console.log('Edit room name clicked');
  };

  return (
    <div className="fixed bottom-0 left-0 w-screen flex justify-center h-[160px] sm:h-[170px] border-t md:border-0 border-[#424242] bg-[#242424]">
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
            <Button
              variant="subtle"
              color="gray"
              size="lg"
              className="room-name-button"
              onClick={handleCopyUrl}
            >
              <h2 className="room-name-text">
                {isValidMediumint(roomName) && roomName.length === 6
                  ? roomName.slice(0, 3) + ' ' + roomName.slice(3)
                  : roomName.toUpperCase()}
              </h2>
            </Button>
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
              onClick={() => {
                triggerAction({
                  action: 'setSpectator',
                  roomId,
                  userId,
                  targetUserId: userId,
                  isSpectator: !isSpectator,
                });
              }}
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
              onClick={() => {
                triggerAction({
                  action: 'reset',
                  roomId,
                  userId,
                });
              }}
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
                onClick={() => {
                  triggerAction({
                    action: 'estimate',
                    roomId,
                    userId,
                    estimation: estimation === number ? null : number,
                  });
                }}
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
