import { type Logger } from "next-axiom";
import { useChannel } from "ably/react";
import { useRoomStateStore } from "fpp/store/room-state.store";
import {
  RoomStateClient,
  type RoomStateDto,
} from "fpp/server/room-state/room-state.entity";
import { useEffect } from "react";
import { api } from "fpp/utils/api";
import { useLocalstorageStore } from "fpp/store/local-storage.store";

export const useRoomState = ({
  roomId,
  userId,
  username,
  logger,
}: {
  roomId: number;
  userId: string;
  username: string;
  logger: Logger;
}) => {
  const isSpectator = useLocalstorageStore((store) => store.isSpectator);

  const updateRoomState = useRoomStateStore((store) => store.update);
  const setIsConnecting = useRoomStateStore((store) => store.setIsConnecting);
  const isConnecting = useRoomStateStore((store) => store.isConnecting);

  const enterRoomMutation = api.roomState.enter.useMutation();

  useEffect(() => {
    if (!isConnecting) return;
    enterRoomMutation.mutate(
      {
        roomId,
        userId,
        username,
        isSpectator,
      },
      {
        onSuccess: (roomStateJson) => {
          updateRoomState(RoomStateClient.fromJson(roomStateJson));
          setIsConnecting(false);
        },
      },
    );
  }, []);

  useChannel(`room:${roomId}`, "room-state", (message) => {
    logger.debug("RECEIVED ROOM-STATE MESSAGE", message);
    updateRoomState(RoomStateClient.fromJson(message.data as RoomStateDto));
  });
};
