import { create } from "zustand";
import { combine } from "zustand/middleware";
import { v4 } from "uuid";
import Ably from "ably/promises";
import { getClientId } from "~/store/local-storage";

const initialState = {
  messages: [],
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
    },
  };
};

export const useStore = create(combine(initialState, mutations));
