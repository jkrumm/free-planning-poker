import { create } from "zustand";
import { combine } from "zustand/middleware";
import Ably from "ably/promises";
import { v4 } from "uuid";

// type Store = {
//   messages: string[];
//   ready: boolean;
//   sendMessage: (message: string) => void;
// };

const initialState = {
  messages: [],
  ready: false,
};

const mutations = (setState: any, getState: any) => {
  // configureAbly({ authUrl: "http://localhost:3000/api/ably-token" });
  const client = new Ably.Realtime.Promise({
    authUrl: "http://localhost:3000/api/ably-token",
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
