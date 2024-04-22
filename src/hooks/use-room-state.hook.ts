import { useEffect } from 'react';

import { useChannel } from 'ably/react';

import { api } from 'fpp/utils/api';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';
import { useRoomStateStore } from 'fpp/store/room-state.store';

import {
  RoomStateClient,
  type RoomStateDto,
} from 'fpp/server/room-state/room-state.entity';

export const useRoomState = ({
  roomId,
  userId,
  username,
  // logger,
}: {
  roomId: number;
  userId: string;
  username: string;
  // logger: Logger;
}) => {
  const isSpectator = useLocalstorageStore((store) => store.isSpectator);

  const updateRoomState = useRoomStateStore((store) => store.update);
  const setConnectedAt = useRoomStateStore((store) => store.setConnectedAt);
  const connectedAt = useRoomStateStore((store) => store.connectedAt);

  const enterRoomMutation = api.roomState.enter.useMutation();

  useEffect(() => {
    if (connectedAt) return;
    enterRoomMutation.mutate(
      {
        roomId,
        userId,
        username,
        isSpectator,
      },
      {
        onSuccess: (roomStateDto) => {
          updateRoomState(RoomStateClient.fromJson(roomStateDto));
          setConnectedAt();
        },
      },
    );
  }, []);

  useChannel(`room:${roomId}`, 'room-state', (message) => {
    // logger.debug('RECEIVED ROOM-STATE MESSAGE', message);
    updateRoomState(RoomStateClient.fromJson(message.data as RoomStateDto));
  });
};
