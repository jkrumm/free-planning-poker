import { create } from "zustand";

type WsStore = {
  messages: string[];
  addMessage: (message: string) => void;
};

export const useWsStore = create<WsStore>((set) => ({
  messages: [],
  addMessage: (message: string) => {
    set((state) => ({ messages: [...state.messages, message] }));
  },
}));
