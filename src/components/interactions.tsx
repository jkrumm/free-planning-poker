import { Button, Switch } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { setLocalstorageRoom } from "~/store/local-storage";
import { useWsStore } from "~/store/ws-store";
import { useRef } from "react";
import { useRouter } from "next/router";

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
  const flipped = useWsStore((store) => store.flipped);
  const autoShow = useWsStore((store) => store.autoShow);

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
                channel.presence.update({
                  username,
                  voting: number,
                  spectator: spectators.includes(clientId),
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
            onClick={async () => {
              setLocalstorageRoom(null);
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
            channel.presence.update({
              username,
              voting: null,
              spectator: event.currentTarget.checked,
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
