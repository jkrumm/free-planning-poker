import { create } from "zustand";
import { combine } from "zustand/middleware";
import { v4 } from "uuid";
import Ably from "ably/promises";
import { getClientId, getUsername } from "~/store/local-storage";

const initialState = {
  messages: [],
  presences: [],
  presencesMap: new Map(),
  ready: false,
};

const mutations = (setState: any, getState: any) => {
  const prefix = process.env.API_ROOT || "http://localhost:3000/";
  const client = new Ably.Realtime.Promise({
    authUrl: `${prefix}api/ably-token`,
    clientId: getClientId(),
  });

  client.connection.on("connected", function () {
    setState({ ready: true });
  });

  client.connection.on("failed", function () {
    setState({ ready: false });
  });

  const channel = client.channels.get("test-ably");

  channel
    .attach()
    .then(async () => channel.presence.enter({ username: getUsername() }));

  channel.attach().then(async () => {
    await channel.presence.subscribe((presenceMessage) => {
      const {
        action,
        clientId,
        data: { username },
      } = presenceMessage;
      setState({
        presencesMap: getState().presencesMap.set(`${clientId}`, username),
        presences: [
          ...new Set([...getState().presences, clientId].filter(Boolean)),
        ],
      });
      if (action === "leave") {
        console.log("HERE HERE HERE", action, clientId, username);
      }
      console.log(action);
      console.log(getState().presences);
      console.log(getState().presencesMap);
    });
  });

  channel.attach().then(async () => {
    await channel.subscribe("chat-message", (message) => {
      console.log(message);
      setState({ messages: [...getState().messages, message.data.text] });
    });
  });

  return {
    actions: {
      sendMessage() {
        channel.publish({ name: "chat-message", data: { text: v4() } });
      },
      leaveChannel() {
        channel.attach().then(async () => await channel.presence.leave());
      },
    },
  };
};

export const useWsStore = create(combine(initialState, mutations));
