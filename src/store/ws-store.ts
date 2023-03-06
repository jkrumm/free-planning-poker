import { create } from "zustand";
import { Types } from "ably";
import PresenceMessage = Types.PresenceMessage;
import Message = Types.Message;

export type Voting = {
  clientId: string;
  number: number | null;
};

type WsStore = {
  messages: string[];
  autoShow: boolean;
  flipped: boolean;
  spectators: string[];
  votes: Voting[];
  presences: string[];
  presencesMap: Map<string, string>;
  fullReset: () => void;
  handleMessage: (message: Message) => void;
  updatePresences: (presenceMessage: PresenceMessage) => void;
};

export const useWsStore = create<WsStore>((set, get) => ({
  messages: [],
  autoShow: false,
  flipped: true,
  spectators: [],
  votes: [],
  presences: [],
  presencesMap: new Map(),
  fullReset: () => {
    set({ votes: [], flipped: true, presences: [], presencesMap: new Map() });
  },
  handleMessage: (message: Message) => {
    switch (message.name) {
      case "test-message":
        set((state) => ({ messages: [...state.messages, message.data.text] }));
        break;
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
