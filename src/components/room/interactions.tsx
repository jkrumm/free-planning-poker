import { useRef } from 'react';
import { ReadyState } from 'react-use-websocket';

import { useRouter } from 'next/router';

import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';

import { IconEye } from '@tabler/icons-react';
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

  const roomRef = useRef(null);

  return (
    <div className="interactions w-full max-w-xl mx-auto px-2 sm:px-4 border-t md:border-0 border-[#424242] bg-[#242424]">
      <div className="left w-full space-y-2">
        {/* Room Name - Top Row */}
        <div className="room-name-bar">
          <Button
            variant="outline"
            color="gray"
            size="lg"
            className="room-name w-auto max-h-8 py-0 mt-1"
          >
            <h2
              className="uppercase m-0 text-sm sm:text-base"
              ref={roomRef}
              onKeyDown={() => ({})}
              onClick={() => {
                if (!window.location) {
                  return;
                }
                if ('clipboard' in navigator) {
                  navigator.clipboard
                    .writeText(window.location.toString())
                    .then(() => ({}))
                    .catch(() => ({}));
                } else {
                  document.execCommand(
                    'copy',
                    true,
                    window.location.toString(),
                  );
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
              }}
            >
              {isValidMediumint(roomName) && roomName.length === 6
                ? roomName.slice(0, 3) + ' ' + roomName.slice(3)
                : roomName.toUpperCase()}
            </h2>
          </Button>
        </div>

        {/* Action Buttons and Counter - Middle Row */}
        <div className="action-bar">
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
        </div>

        {/* Estimation Buttons - Bottom Row */}
        <div className="voting-bar">
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
