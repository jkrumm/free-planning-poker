import { Button, Switch } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { type PresenceUpdate, useWsStore } from "fpp/store/ws.store";
import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import { fibonacciSequence } from "fpp/constants/fibonacci.constant";
import { type Logger } from "next-axiom";
import { logMsg, roomEvent } from "fpp/constants/logging.constant";
import { RouteType } from "fpp/server/db/schema";

export const Interactions = ({
  room,
  username,
  logger,
}: {
  room: string;
  username: string;
  logger: Logger;
}) => {
  const router = useRouter();

  const clientId = useWsStore((store) => store.clientId);
  const channel = useWsStore((store) => store.channel);

  const visitorId = useLocalstorageStore((state) => state.visitorId);
  const voting = useLocalstorageStore((store) => store.voting);
  const setVoting = useLocalstorageStore((store) => store.setVoting);
  const setSpectator = useLocalstorageStore((store) => store.setSpectator);
  const setRoom = useLocalstorageStore((store) => store.setRoom);

  const votes = useWsStore((store) => store.votes);
  const spectators = useWsStore((store) => store.spectators);
  const presences = useWsStore((store) => store.presences);
  const flipped = useWsStore((store) => store.flipped);
  const autoShow = useWsStore((store) => store.autoShow);

  useEffect(() => {
    if (!channel || !clientId) return;
    const presenceUpdate: PresenceUpdate = {
      username,
      voting,
      spectator: spectators.includes(clientId),
      presencesLength: presences.length,
    };
    logger.debug("SEND OWN PRESENCE ON INIT", presenceUpdate);
    channel.presence.update(presenceUpdate);
  }, [channel]);

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
              onKeyPress={() => ({})}
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              onClick={async () => {
                if (!window.location) {
                  return;
                }
                if ("clipboard" in navigator) {
                  await navigator.clipboard.writeText(
                    window.location.toString(),
                  );
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
              {room}
            </h2>
          </Button>
          <div>
            <Button
              variant={flipped ? "default" : "filled"}
              disabled={flipped}
              className={"mr-5"}
              onClick={() => {
                if (!channel) return;
                channel.publish("reset", {});
              }}
            >
              New Round
            </Button>
            <Button
              variant={"default"}
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              onClick={async () => {
                logger.info(logMsg.TRACK_ROOM_EVENT, {
                  event: roomEvent.LEAVE_ROOM,
                  room,
                  visitorId,
                  route: RouteType.ROOM,
                });
                setRoom(null);
                setVoting(null);
                await router.push(`/`);
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
                disabled={
                  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                  (clientId && spectators.includes(clientId)) || !flipped
                }
                variant={
                  votes.some(
                    (item) =>
                      item.clientId === clientId && item.number === number,
                  )
                    ? "filled"
                    : "default"
                }
                size={"lg"}
                fullWidth
                key={number}
                onClick={() => {
                  if (!channel || !clientId) return;
                  setVoting(number);
                  const presenceUpdate: PresenceUpdate = {
                    username,
                    voting: number,
                    spectator: spectators.includes(clientId),
                    presencesLength: presences.length,
                  };
                  channel.presence.update(presenceUpdate);
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
          disabled={!flipped}
          label="Spectator"
          checked={clientId ? spectators.includes(clientId) : false}
          onChange={(event) => {
            if (!channel) return;
            setSpectator(event.currentTarget.checked);
            setVoting(null);
            const presenceUpdate: Partial<PresenceUpdate> = {
              username,
              voting: null,
              spectator: event.currentTarget.checked,
              presencesLength: presences.length,
            };
            channel.presence.update(presenceUpdate);
          }}
        />
        <Switch
          label="Auto Show"
          disabled={true}
          className="cursor-pointer"
          checked={autoShow}
          onChange={(event) => {
            if (!channel) return;
            channel.publish("auto-show", {
              autoShow: event.currentTarget.checked,
            });
          }}
        />
      </div>
    </div>
  );
};
