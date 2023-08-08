import { Types } from "ably";
import { type PresenceUpdate } from "fpp/store/ws.store";
import { env } from "fpp/env.mjs";
import PresenceMessage = Types.PresenceMessage;

export const log = (msg: string, data: object) => {
  if (env.NEXT_PUBLIC_NODE_ENV === "development") {
    console.debug(msg, data);
  }
};

export const logPresence = (msg: string, presenceUpdate: PresenceMessage) => {
  if (env.NEXT_PUBLIC_NODE_ENV === "development") {
    const {
      action,
      data: { username, voting, spectator, presencesLength },
    } = presenceUpdate as {
      action: Types.PresenceAction;
      clientId: string;
      data: PresenceUpdate;
    };
    console.debug(msg, {
      action,
      username,
      voting,
      spectator,
      presenceLength: presencesLength ?? "undefined",
    });
  }
};
