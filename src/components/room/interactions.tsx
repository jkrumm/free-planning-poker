import { useRef } from 'react';
import { ReadyState } from 'react-use-websocket';

import { useRouter } from 'next/router';

import { Button, Switch } from '@mantine/core';
import { notifications } from '@mantine/notifications';

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
  const isAutoFlip = useRoomStore((store) => store.isAutoFlip);

  // Connection
  const readyState = useRoomStore((store) => store.readyState);
  const isConnected = readyState === ReadyState.OPEN;

  const roomRef = useRef(null);

  return (
    <div className="interactions">
      <div className="left">
        <div className="settings-bar">
          <Button
            variant="outline"
            color="gray"
            size="lg"
            className="room-name"
          >
            <h2
              className="uppercase mb-0"
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
          <div>
            <Button
              className="mr-3"
              disabled={!isConnected}
              variant={
                status === RoomStateStatus.flipped ? 'filled' : 'default'
              }
              onClick={() => {
                triggerAction({
                  action: 'reset',
                  roomId,
                  userId,
                });
              }}
            >
              {status === RoomStateStatus.flipped ? 'New Round' : 'Reset'}
            </Button>
            <Button
              variant="default"
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
          </div>
        </div>
        <div className="voting-bar">
          <Button.Group className="w-full">
            {fibonacciSequence.map((number) => (
              <Button
                disabled={
                  !isConnected ||
                  isSpectator ||
                  status === RoomStateStatus.flipped
                }
                variant={estimation === number ? 'filled' : 'default'}
                size={'lg'}
                fullWidth
                key={number}
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
      <div className="switch-bar">
        <Counter />
        <Switch
          className="mb-2 cursor-pointer"
          disabled={!isConnected || status === RoomStateStatus.flipped}
          label="Spectator"
          checked={isSpectator}
          onChange={(event) => {
            triggerAction({
              action: 'setSpectator',
              roomId,
              userId,
              targetUserId: userId,
              isSpectator: event.currentTarget.checked,
            });
          }}
        />
        <Switch
          label="Auto Show"
          className="cursor-pointer"
          checked={isAutoFlip}
          disabled={true}
          onChange={(event) => {
            triggerAction({
              action: 'setAutoFlip',
              roomId,
              userId,
              isAutoFlip: event.currentTarget.checked,
            });
          }}
        />
      </div>
    </div>
  );
};
