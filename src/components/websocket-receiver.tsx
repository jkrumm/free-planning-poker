"use client";

import { configureAbly, useChannel, usePresence } from "@ably-labs/react-hooks";
import { useWsStore } from "~/store/ws-store";
import { useEffect } from "react";
import shortUUID from "short-uuid";
import { api } from "~/utils/api";
import {
  getMyPresence,
  setLocalstorageRecentRoom,
} from "~/store/local-storage";
import * as process from "process";
import { log, logPresence } from "~/utils/console-log";

export const WebsocketReceiver = ({
  room,
  username,
}: {
  room: string;
  username: string;
}) => {
  const setRoom = api.room.setRoom.useMutation();

  configureAbly({
    authUrl: `${
      process.env.NEXT_PUBLIC_API_ROOT || "http://localhost:3000/"
    }api/ably-token`,
    clientId: shortUUID().generate().toString(),
  });

  const wsChannel = useWsStore((store) => store.channel);
  const setChannel = useWsStore((store) => store.setChannel);
  const clientId = useWsStore((store) => store.clientId);

  const presences = useWsStore((store) => store.presences);

  const handleMessage = useWsStore((store) => store.handleMessage);
  const updatePresences = useWsStore((store) => store.updatePresences);

  const [channel] = useChannel(room, (message) => {
    log("RECEIVED MESSAGE", message);
    handleMessage(message);
  });

  if (!wsChannel && channel) {
    setChannel(channel);
  }

  useEffect(() => {
    setRoom.mutate({ room });
    setLocalstorageRecentRoom(room);
  }, []);

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
      log("SEND OWN PRESENCE ON ENTER", getMyPresence());
      channel.presence.update({
        ...getMyPresence(),
        presencesLength: presences.length,
      });
    }
    logPresence("RECEIVED PRESENCE", presenceUpdate);
    updatePresences(presenceUpdate);
    // everyone resends presence if presencesLength is not the same as the one it received
    const presencesLength = (
      presenceUpdate as unknown as { data: { presencesLength: number } }
    ).data.presencesLength;
    if (presencesLength && presences.length !== presencesLength) {
      channel.presence.update(getMyPresence());
    }
  });

  if (process.browser) {
    window.onbeforeunload = () => {
      channel.presence.leave({}, () => {
        log("LEFT CHANNEL", { action: "left", clientId });
        return;
      });
    };
  }

  return <div>test</div>;
};
