import { Types } from "ably";
import PresenceMessage = Types.PresenceMessage;

export const log = (msg: string, data: object) => {
  if (process.env.NODE_ENV === "development") {
    console.debug(msg, data);
  }
};

export const logPresence = (msg: string, presenceUpdate: PresenceMessage) => {
  if (process.env.NODE_ENV === "development") {
    console.debug(msg, {
      action: presenceUpdate.action,
      // clientId: presenceUpdate.clientId,
      username: presenceUpdate.data.username,
      voting: presenceUpdate.data.voting,
      spectator: presenceUpdate.data.spectator,
      presenceLength: presenceUpdate.data.presencesLength,
    });
  }
};
