"use client";

import { configureAbly, useChannel, usePresence } from "@ably-labs/react-hooks";
import { type PresenceUpdate, useWsStore } from "fpp/store/ws.store";
import { useEffect } from "react";
import shortUUID from "short-uuid";
import { api } from "fpp/utils/api";
import * as process from "process";
import { log, logPresence } from "fpp/utils/console-log";
import { useLocalstorageStore } from "fpp/store/local-storage.store";

export const WebsocketReceiver = ({
  room,
  username,
}: {
  room: string;
  username: string;
}) => {
  const setRoomMutation = api.room.setRoom.useMutation();

  configureAbly({
    authUrl: `${
      process.env.NEXT_PUBLIC_API_ROOT ?? "http://localhost:3000/"
    }api/ably-token`,
    clientId: shortUUID().generate().toString(),
  });

  const voting = useLocalstorageStore((store) => store.voting);
  const setVoting = useLocalstorageStore((store) => store.setVoting);
  const spectator = useLocalstorageStore((store) => store.spectator);
  const setRoom = useLocalstorageStore((store) => store.setRoom);
  const setRecentRoom = useLocalstorageStore((store) => store.setRecentRoom);

  const wsChannel = useWsStore((store) => store.channel);
  const setChannel = useWsStore((store) => store.setChannel);
  const clientId = useWsStore((store) => store.clientId);

  const presences = useWsStore((store) => store.presences);

  const handleMessage = useWsStore((store) => store.handleMessage);
  const updatePresences = useWsStore((store) => store.updatePresences);

  const [channel] = useChannel(room, (message) => {
    log("RECEIVED MESSAGE", message);
    if (["flip", "reset"].includes(message.name)) {
      setVoting(null);
    }
    handleMessage(message);
  });

  if (!wsChannel && channel) {
    setChannel(channel);
  }

  useEffect(() => {
    setRoomMutation.mutate({ room });
    setRoom(room);
    setRecentRoom(room);
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
    const presenceUpdateBody: PresenceUpdate = {
      username,
      voting,
      spectator,
      presencesLength: presences.length,
    };
    if (presenceUpdate.action === "enter") {
      log("SEND OWN PRESENCE ON ENTER", { username, voting, spectator });
      channel.presence.update(presenceUpdateBody);
    }
    logPresence("RECEIVED PRESENCE", presenceUpdate);
    updatePresences(presenceUpdate);
    // everyone resends presence if presencesLength is not the same as the one it received
    const presencesLength = (
      presenceUpdate.data as unknown as {
        data: { presencesLength: number | undefined } | undefined;
      }
    )?.data?.presencesLength;
    if (presencesLength && presences.length !== presencesLength) {
      channel.presence.update(presenceUpdateBody);
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
