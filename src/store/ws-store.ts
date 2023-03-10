import { create } from "zustand";
import { Types } from "ably";
import { getUsername, setUsername } from "~/store/local-storage";
import { getByValue } from "~/utils/map.util";
import PresenceMessage = Types.PresenceMessage;
import Message = Types.Message;
import RealtimeChannelCallbacks = Types.RealtimeChannelCallbacks;

export type Voting = {
  clientId: string;
  number: number | null;
};

type WsStore = {
  clientId: string | null;
  setClientId: (clientId: string) => void;
  username: string | null;
  setUsername: (username: string) => void;
  channel: RealtimeChannelCallbacks | null;
  setChannel: (client: RealtimeChannelCallbacks) => void;
  autoShow: boolean;
  flipped: boolean;
  spectators: string[];
  votes: Voting[];
  presences: string[];
  presencesMap: Map<string, string>;
  myPresence: {
    username: string | null;
    voting: number | null;
    spectator: boolean;
  };
  fullReset: () => void;
  handleMessage: (message: Message) => void;
  updatePresences: (presenceMessage: PresenceMessage) => void;
};

export const useWsStore = create<WsStore>((set, get) => ({
  clientId: null,
  setClientId: (clientId) => set({ clientId }),
  username: getUsername(),
  setUsername: (username: string) => {
    setUsername(username);
    set({ username });
  },
  channel: null,
  setChannel: (channel) => {
    set({ channel });
  },
  autoShow: false,
  flipped: true,
  spectators: [],
  votes: [],
  presences: [],
  presencesMap: new Map(),
  myPresence: { username: getUsername(), voting: null, spectator: false },
  fullReset: () => {
    set({ votes: [], flipped: true, presences: [], presencesMap: new Map() });
  },
  handleMessage: (message) => {
    switch (message.name) {
      case "auto-show":
        set({ autoShow: message.data.autoShow });
        break;
      case "flip":
        set({ flipped: false });
        break;
      case "reset":
        set({ votes: [], flipped: true });
        break;
    }
  },
  updatePresences: (presenceMessage) => {
    const {
      action,
      clientId,
      data: { username, voting, spectator },
    } = presenceMessage;
    if (!get().clientId) {
      const newClientId = getByValue(get().presencesMap, username);
      set({ clientId: newClientId });
    }
    switch (action) {
      case "enter":
        set((state) => ({
          presencesMap: state.presencesMap.set(`${clientId}`, username),
          presences: [
            ...new Set([...state.presences, clientId].filter(Boolean)),
          ],
        }));
        break;
      case "update":
        set((state) => ({
          presencesMap: state.presencesMap.set(`${clientId}`, username),
          presences: [
            ...new Set([...state.presences, clientId].filter(Boolean)),
          ],
          votes: [
            ...state.votes.filter((voting) => voting.clientId !== clientId),
            {
              clientId,
              number: voting ? Number(voting) : null,
            },
          ].filter((voting) => voting.number != null),
        }));
        if (spectator) {
          set((state) => ({
            spectators: [
              ...new Set([...state.spectators, clientId].filter(Boolean)),
            ],
            votes: [
              ...state.votes.filter((voting) => voting.clientId !== clientId),
            ],
          }));
        } else {
          set((state) => ({
            spectators: [
              ...state.spectators.filter((spectator) => spectator !== clientId),
            ],
          }));
        }
        if (get().clientId === clientId) {
          set({ myPresence: { username, voting, spectator } });
        }
        break;
      case "leave":
        set((state) => ({
          presences: [
            ...state.presences.filter((presence) => presence !== clientId),
          ],
          votes: [
            ...state.votes.filter((voting) => voting.clientId !== clientId),
          ],
        }));
        break;
    }
    // if (presencesLength > get().presences.length) {
    //   notifications.show({
    //     color: "red",
    //     autoClose: 3000,
    //     withCloseButton: true,
    //     title: "Someone left the room",
    //     message: `${username} left the room`,
    //   });
    // } else if (presencesLength < get().presences.length) {
    //   notifications.show({
    //     color: "green",
    //     autoClose: 3000,
    //     withCloseButton: true,
    //     title: "Someone joined the room",
    //     message: `${username} joined the room`,
    //   });
    // }
  },
}));
