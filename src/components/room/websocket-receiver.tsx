"use client";

import { useChannel, usePresence } from "@ably-labs/react-hooks";
import { type PresenceUpdate, useWsStore } from "fpp/store/ws.store";
import { useEffect } from "react";
import * as process from "process";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import { sendTrackEstimation } from "fpp/utils/send-track-estimation.util";
import { type Logger } from "next-axiom";
import { Types } from "ably";
import PresenceMessage = Types.PresenceMessage;

export const WebsocketReceiver = ({
  roomId,
  username,
  logger,
}: {
  roomId: number;
  username: string;
  logger: Logger;
}) => {
  const voting = useLocalstorageStore((store) => store.voting);
  const setVoting = useLocalstorageStore((store) => store.setVoting);
  const spectator = useLocalstorageStore((store) => store.spectator);
  const userId = useLocalstorageStore((store) => store.userId);

  const wsChannel = useWsStore((store) => store.channel);
  const setChannel = useWsStore((store) => store.setChannel);
  const clientId = useWsStore((store) => store.clientId);

  const presences = useWsStore((store) => store.presences);

  const handleMessage = useWsStore((store) => store.handleMessage);
  const updatePresences = useWsStore((store) => store.updatePresences);

  const [channel] = useChannel(`room:${roomId}`, (message) => {
    logger.debug("RECEIVED MESSAGE", message);
    if (message.name === "flip") {
      const localVoting = localStorage.getItem("vote");
      const localSpectator = localStorage.getItem("spectator");
      sendTrackEstimation({
        userId,
        roomId,
        estimation: localVoting ? parseInt(localVoting) : null,
        spectator: localSpectator === "true",
        logger,
      });
    }
    if (["flip", "reset"].includes(message.name)) {
      setVoting(null);
    }
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
        logger.debug("FETCHED PRESENCE", {
          userId,
          action: presenceUpdate.action,
          username,
          voting,
          spectator,
          // presenceLength: presenceUpdate.presencesLength,
        });
        updatePresences(presenceUpdate);
      });
    });
  }, [clientId]);

  usePresence(`room:${roomId}`, { username }, (presenceUpdate) => {
    const presenceUpdateBody: PresenceUpdate = {
      username,
      voting,
      spectator,
      presencesLength: presences.length,
    };
    if (presenceUpdate.action === "enter") {
      logger.debug("SEND OWN PRESENCE ON ENTER", {
        username,
        voting,
        spectator,
      });
      channel.presence.update(presenceUpdateBody);
    }
    logger.debug("RECEIVED PRESENCE", {
      userId,
      action: presenceUpdate.action,
      username,
      voting,
      spectator,
      // presenceLength: presenceUpdate.presencesLength,
    });
    updatePresences(presenceUpdate as PresenceMessage);
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
        logger.debug("LEFT CHANNEL", { action: "left", clientId });
        return;
      });
    };
  }

  return <div>test</div>;
};
