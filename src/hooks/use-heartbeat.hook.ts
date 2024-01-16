import { api } from "fpp/utils/api";
import { useEffect, useRef } from "react";
import { type Logger } from "next-axiom";
import { useRoomStateStore } from "fpp/store/room-state.store";

export const useHeartbeat = ({
  roomId,
  userId,
  logger,
}: {
  roomId: number;
  userId: string;
  logger: Logger;
}) => {
  const heartbeatMutation = api.roomState.heartbeat.useMutation();
  const heartbeat = useRef(Date.now());

  const connectedAt = useRoomStateStore((store) => store.connectedAt);

  // TODO: respect own room state updates and don't send heartbeat

  useEffect(() => {
    if (!connectedAt) return;
    const interval = setInterval(() => {
      if (Date.now() - heartbeat.current > 1000 * 12) {
        const conservativeHeartbeat = Date.now();
        heartbeatMutation.mutate(
          { roomId, userId },
          {
            onSuccess: () => {
              heartbeat.current = conservativeHeartbeat;
            },
          },
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [connectedAt]);
};
