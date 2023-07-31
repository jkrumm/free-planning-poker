import { create } from "zustand";
import { Types } from "ably";
import { getByValue } from "fpp/utils/map.util";
import PresenceMessage = Types.PresenceMessage;
import Message = Types.Message;
import RealtimeChannelCallbacks = Types.RealtimeChannelCallbacks;
import { resetVote } from "fpp/store/local-storage";

export type Voting = {
  clientId: string;
  number: number | null;
};

export interface PresenceUpdate {
  username: string;
  voting: number | null;
  spectator: boolean;
  presencesLength: number | undefined;
}

type WsStore = {
  clientId: string | null;
  setClientId: (clientId: string) => void;
  channel: RealtimeChannelCallbacks | null;
  setChannel: (client: RealtimeChannelCallbacks) => void;
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
  clientId: null,
  setClientId: (clientId) => set({ clientId }),
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
  fullReset: () => {
    set({ votes: [], flipped: true, presences: [], presencesMap: new Map() });
  },
  handleMessage: (message: Types.Message) => {
    switch (message.name) {
      case "auto-show":
        set({
          autoShow: (message.data as { autoShow: boolean }).autoShow || false,
        });
        break;
      case "flip":
        set({ flipped: false });
        resetVote();
        break;
      case "reset":
        set({ votes: [], flipped: true });
        resetVote();
        break;
    }
  },
  updatePresences: (presenceMessage) => {
    const {
      action,
      clientId,
      data: { username, voting, spectator },
    } = presenceMessage as {
      action: Types.PresenceAction;
      clientId: string;
      data: PresenceUpdate;
    };
    if (!get().clientId) {
      const newClientId = getByValue(get().presencesMap, username);
      set({ clientId: newClientId });
    }
    switch (action) {
      case "enter":
        set((state) => ({
          presencesMap: state.presencesMap.set(clientId, username),
          presences: [
            ...new Set([...state.presences, clientId].filter(Boolean)),
          ],
        }));
        break;
      case "update":
        set((state) => ({
          presencesMap: state.presencesMap.set(clientId, username),
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
