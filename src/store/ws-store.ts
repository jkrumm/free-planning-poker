import { create } from "zustand";
import { Types } from "ably";
import PresenceMessage = Types.PresenceMessage;

type Voting = {
  clientId: string;
  number: number;
};

type WsStore = {
  messages: string[];
  addMessage: (message: string) => void;
  votes: Voting[];
  presences: string[];
  presencesMap: Map<string, string>;
  updatePresences: (presenceMessage: PresenceMessage) => void;
};

export const useWsStore = create<WsStore>((set) => ({
  messages: [],
  addMessage: (message: string) => {
    set((state) => ({ messages: [...state.messages, message] }));
  },
  votes: [],
  presences: [],
  presencesMap: new Map(),
  updatePresences: (presenceMessage: PresenceMessage) => {
    const {
      action,
      clientId,
      data: { username, voting },
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
              number: Number(voting),
            },
          ],
        }));
        break;
      case "leave":
        set((state) => ({
          presences: state.presences.filter(
            (presence) => presence !== clientId
          ),
          votes: state.votes.filter((voting) => voting.clientId !== clientId),
        }));
        break;
    }
  },
}));
