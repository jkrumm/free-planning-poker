import { Types } from "ably";
import { type PresenceUpdate } from "fpp/store/ws.store";
import PresenceMessage = Types.PresenceMessage;

export const log = (msg: string, data: object) => {
  if (process.env.NODE_ENV === "development") {
    console.debug(msg, data);
  }
};

export const logPresence = (msg: string, presenceUpdate: PresenceMessage) => {
  if (process.env.NODE_ENV === "development") {
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
