"use client";

import { configureAbly, useChannel, usePresence } from "@ably-labs/react-hooks";
import { useWsStore } from "~/store/ws-store";
import { useEffect } from "react";
import shortUUID from "short-uuid";
import { Types } from "ably";
import PresenceMessage = Types.PresenceMessage;

const logPresence = (msg: string, presenceUpdate: PresenceMessage) => {
  console.log(msg, {
    action: presenceUpdate.action,
    clientId: presenceUpdate.clientId,
    username: presenceUpdate.data.username,
    voting: presenceUpdate.data.voting,
    spectator: presenceUpdate.data.spectator,
  });
};

export const WebsocketReceiver = ({
  room,
  username,
}: {
  room: string;
  username: string;
}) => {
  configureAbly({
    authUrl: `${
      process.env.NEXT_PUBLIC_API_ROOT || "http://localhost:3000/"
    }api/ably-token`,
    clientId: shortUUID().generate().toString(),
  });

  const wsChannel = useWsStore((store) => store.channel);
  const setChannel = useWsStore((store) => store.setChannel);
  const clientId = useWsStore((store) => store.clientId);

  const myPresence = useWsStore((store) => store.myPresence);

  const handleMessage = useWsStore((store) => store.handleMessage);
  const updatePresences = useWsStore((store) => store.updatePresences);

  const [channel] = useChannel(room, (message) => {
    console.debug(
      "RECEIVED MESSAGE",
      { name: message.name, clientId: message.clientId },
      message.data
    );
    handleMessage(message);
  });

  if (!wsChannel && channel) {
    setChannel(channel);
  }

  useEffect(() => {
    channel.presence.get((err, presenceUpdates) => {
      if (!presenceUpdates?.length) {
        return;
      }
      presenceUpdates.forEach((presenceUpdate) => {
        logPresence("FETCHED PRESENCE", presenceUpdate);
        updatePresences(presenceUpdate);
      });
    });
  }, [clientId]);

  usePresence(room, { username }, (presenceUpdate) => {
    if (presenceUpdate.action === "enter") {
      console.debug("SEND OWN PRESENCE", myPresence);
      channel.presence.update(myPresence);
    }
    logPresence("RECEIVED PRESENCE", presenceUpdate);
    updatePresences(presenceUpdate);
  });

  if (process.browser) {
    window.onbeforeunload = () => {
      channel.presence.leave({}, () => {
        console.debug("LEFT CHANNEL", { action: "left", clientId });
        return;
      });
    };
  }

  return <div>test</div>;
};
