import { Button, Switch } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useRef } from "react";
import { useRouter } from "next/router";
import { fibonacciSequence } from "fpp/constants/fibonacci.constant";
import { type Logger } from "next-axiom";
import { logMsg, roomEvent } from "fpp/constants/logging.constant";
import { RouteType } from "fpp/server/db/schema";
import { useRoomStateStore } from "fpp/store/room-state.store";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import { api } from "fpp/utils/api";

export const Interactions = ({
  roomId,
  roomReadable,
  userId,
  logger,
}: {
  roomId: number;
  roomReadable: string;
  userId: string;
  logger: Logger;
}) => {
  const router = useRouter();

  const setRoomId = useLocalstorageStore((store) => store.setRoomId);
  const setRoomReadable = useLocalstorageStore(
    (store) => store.setRoomReadable,
  );

  // User state
  const estimation = useRoomStateStore((store) => store.estimation);
  const estimateMutation = api.roomState.estimate.useMutation();
  const isSpectator = useRoomStateStore((store) => store.isSpectator);
  const setIsSpectator = useLocalstorageStore((store) => store.setIsSpectator);
  const spectatorMutation = api.roomState.spectator.useMutation();
  const leaveMutation = api.roomState.leave.useMutation();

  // Room state
  const isFlipped = useRoomStateStore((store) => store.isFlipped);
  const resetMutation = api.roomState.reset.useMutation();
  const isAutoFlip = useRoomStateStore((store) => store.isAutoFlip);
  const autoFlipMutation = api.roomState.autoFlip.useMutation();
  const resetRoomState = useRoomStateStore((store) => store.reset);

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
              className="uppercase"
              ref={roomRef}
              onClick={() => {
                if (!window.location) {
                  return;
                }
                if ("clipboard" in navigator) {
                  navigator.clipboard
                    .writeText(window.location.toString())
                    .then(() => ({}))
                    .catch(() => ({}));
                } else {
                  document.execCommand(
                    "copy",
                    true,
                    window.location.toString(),
                  );
                }
                notifications.show({
                  color: "green",
                  autoClose: 3000,
                  withCloseButton: true,
                  title: "Room url copied to clipboard",
                  message: "Share it with your team!",
                });
              }}
            >
              {/^\d+$/.test(roomReadable) &&
              roomReadable.length === 6 &&
              Number.isInteger(roomReadable)
                ? roomReadable.slice(0, 3) + " " + roomReadable.slice(3)
                : roomReadable.toUpperCase()}
            </h2>
          </Button>
          <div>
            <Button
              variant={isFlipped ? "filled" : "default"}
              className={"mr-5"}
              onClick={() => {
                resetMutation.mutate({
                  roomId,
                  userId,
                });
              }}
            >
              {isFlipped ? "New Round" : "Reset"}
            </Button>
            <Button
              variant={"default"}
              onClick={() => {
                logger.info(logMsg.TRACK_ROOM_EVENT, {
                  event: roomEvent.LEAVE_ROOM,
                  roomId,
                  userId,
                  route: RouteType.ROOM,
                });
                setRoomId(null);
                setRoomReadable(null);
                leaveMutation.mutate({
                  roomId,
                  userId,
                });
                resetRoomState();
                router
                  .push(`/`)
                  .then(() => ({}))
                  .catch(() => ({}));
              }}
            >
              Leave Room
            </Button>
          </div>
        </div>
        <div className="voting-bar">
          <Button.Group className="w-full">
            {fibonacciSequence.map((number) => (
              <Button
                disabled={isSpectator || isFlipped}
                variant={estimation === number ? "filled" : "default"}
                size={"lg"}
                fullWidth
                key={number}
                onClick={() => {
                  estimateMutation.mutate({
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
        <Switch
          className="mb-2 cursor-pointer"
          disabled={isFlipped}
          label="Spectator"
          checked={isSpectator}
          onChange={(event) => {
            setIsSpectator(event.currentTarget.checked);
            spectatorMutation.mutate({
              roomId,
              userId,
              isSpectator: event.currentTarget.checked,
            });
          }}
        />
        <Switch
          label="Auto Flip"
          className="cursor-pointer"
          checked={isAutoFlip}
          onChange={(event) => {
            autoFlipMutation.mutate({
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
