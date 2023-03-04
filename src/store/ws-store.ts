import { create } from "zustand";
import { Types } from "ably";
import PresenceMessage = Types.PresenceMessage;

type WsStore = {
  messages: string[];
  addMessage: (message: string) => void;
  presences: string[];
  presencesMap: Map<string, string>;
  updatePresences: (presenceMessage: PresenceMessage) => void;
};

export const useWsStore = create<WsStore>((set) => ({
  messages: [],
  addMessage: (message: string) => {
    set((state) => ({ messages: [...state.messages, message] }));
  },
  presences: [],
  presencesMap: new Map(),
  updatePresences: (presenceMessage: PresenceMessage) => {
    const {
      action,
      clientId,
      data: { username },
    } = presenceMessage;
    switch (action) {
      case "enter":
        set((state) => ({
          presencesMap: state.presencesMap.set(`${clientId}`, username),
          presences: [
            ...new Set([...state.presences, clientId].filter(Boolean)),
          ],
        }));
        break;
      case "leave":
        set((state) => ({
          presences: state.presences.filter(
            (presence) => presence !== clientId
          ),
        }));
        break;
    }
  },
}));

// export const useWsStore = create<WsStore>((set) => ({
//   messages: [],
//   presences: [],
//   presencesMap: new Map(),
//   ready: false,
// };

// const mutations = (setState: any, getState: any) => {
//   const prefix = process.env.NEXT_PUBLIC_API_ROOT || "http://localhost:3000/";
//   const client = new Ably.Realtime.Promise({
//     authUrl: `${prefix}api/ably-token`,
//     clientId: getClientId(),
//   });
//
//   client.connection.on("connected", function () {
//     setState({ ready: true });
//   });
//
//   client.connection.on("failed", function () {
//     setState({ ready: false });
//   });
//
//   const channel = client.channels.get("test-ably");
//
//   channel
//       .attach()
//       .then(async () => channel.presence.enter({ username: getUsername() }));
//
//   channel.attach().then(async () => {
//     await channel.presence.subscribe((presenceMessage) => {
//       const {
//         action,
//         clientId,
//         data: { username },
//       } = presenceMessage;
//       setState({
//         presencesMap: getState().presencesMap.set(`${clientId}`, username),
//         presences: [
//           ...new Set([...getState().presences, clientId].filter(Boolean)),
//         ],
//       });
//       if (action === "leave") {
//         console.log("HERE HERE HERE", action, clientId, username);
//       }
//       console.log(action);
//       console.log(getState().presences);
//       console.log(getState().presencesMap);
//     });
//   });
//
//   channel.attach().then(async () => {
//     await channel.subscribe("chat-message", (message) => {
//       console.log(message);
//       setState({ messages: [...getState().messages, message.data.text] });
//     });
//   });
//
//   return {
//     actions: {
//       sendMessage() {
//         channel.publish({ name: "chat-message", data: { text: v4() } });
//       },
//       leaveChannel() {
//         channel.attach().then(async () => await channel.presence.leave());
//       },
//     },
//   };
// };
//
// export const useWsStore = create(combine(initialState, mutations));
// addMessage: (message: string) => {
//   set((state) => ({ messages: [...state.messages, message] }));
// },
// }));
