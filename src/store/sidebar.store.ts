import { create } from 'zustand';

export const SidebarTabs = {
  settings: 'settings',
  room_analytics: 'room_analytics',
} as const;

type SidebarStore = {
  tab: null | keyof typeof SidebarTabs;
  setTab: (tab: null | keyof typeof SidebarTabs) => void;
};

export const useSidebarStore = create<SidebarStore>((set, get) => ({
  tab: null,
  setTab: (tab) => set({ tab }),
}));
