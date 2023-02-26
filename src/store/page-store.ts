import { create } from "zustand";
import { getUsername, setUsername } from "~/store/local-storage";

type PageStore = {
  username: string | null;
  setUsername: (username: string) => void;
};

export const usePageStore = create<PageStore>((set) => ({
  username: getUsername(),
  setUsername: (username: string) => {
    setUsername(username);
    set({ username });
  },
}));
