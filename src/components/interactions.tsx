import { Button, Switch } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  getMyPresence,
  setMyPresence,
  setLocalstorageRoom,
  resetVote,
} from "fpp/store/local-storage";
import { useWsStore } from "fpp/store/ws-store";
import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { log } from "fpp/utils/console-log";

const fibonacci = [1, 2, 3, 5, 8, 13, 21, 34];

export const Interactions = ({
  room,
  username,
}: {
  room: string;
  username: string;
}) => {
  const router = useRouter();

  const clientId = useWsStore((store) => store.clientId);
  const channel = useWsStore((store) => store.channel);

  const spectators = useWsStore((store) => store.spectators);
  const votes = useWsStore((store) => store.votes);
  const presences = useWsStore((store) => store.presences);
  const flipped = useWsStore((store) => store.flipped);
  const autoShow = useWsStore((store) => store.autoShow);

  useEffect(() => {
    if (!channel || !clientId) return;
    const myLocalPresence = {
      username,
      voting: getMyPresence().voting,
      spectator: spectators.includes(clientId),
      presencesLength: presences.length,
    };
    log("SEND OWN PRESENCE ON INIT", myLocalPresence);
    channel.presence.update(myLocalPresence);
  }, [channel]);

  const roomRef = useRef(null);

  return (
    <>
      <div className="voting-bar">
        <Button.Group>
          {fibonacci.map((number) => (
            <Button
              disabled={(clientId && spectators.includes(clientId)) || !flipped}
              variant={
                votes.some(
                  (item) => item.clientId === clientId && item.number === number
                )
                  ? "filled"
                  : "default"
              }
              size={"lg"}
              key={number}
              onClick={() => {
                if (!channel || !clientId) return;
                setMyPresence({
                  ...getMyPresence(),
                  voting: number,
                });
                channel.presence.update({
                  username,
                  voting: number,
                  spectator: spectators.includes(clientId),
                  presencesLength: presences.length,
                });
              }}
            >
              {number}
            </Button>
          ))}
        </Button.Group>
      </div>
      <div className="settings-bar">
        <Button
          variant="outline"
          color="gray"
          size="lg"
          className="room-name"
          compact
        >
          <h2
            className="uppercase"
            ref={roomRef}
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onClick={async () => {
              if (!window.location) {
                return;
              }
              if ("clipboard" in navigator) {
                await navigator.clipboard.writeText(window.location.toString());
              } else {
                document.execCommand("copy", true, window.location.toString());
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
              setLocalstorageRoom(null);
              resetVote();
              await router.push(`/`);
            }}
          >
            Leave Room
          </Button>
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
            setMyPresence({
              username,
              voting: null,
              spectator: event.currentTarget.checked,
            });
            channel.presence.update({
              username,
              voting: null,
              spectator: event.currentTarget.checked,
              presencesLength: presences.length,
            });
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
    </>
  );
};
