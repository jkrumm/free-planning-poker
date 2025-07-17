import { type ReactNode } from 'react';

import { Button } from '@mantine/core';

import { IconEye, IconGraph, IconSettings } from '@tabler/icons-react';
import type { Action } from 'fpp-server/src/room.actions';
import { AnimatePresence, motion } from 'framer-motion';

import { useRoomStore } from 'fpp/store/room.store';
import { SidebarTabs, useSidebarStore } from 'fpp/store/sidebar.store';

import SidebarRoomAnalytics from 'fpp/components/sidebar/sidebar-room-analytics';
import SidebarSettings from 'fpp/components/sidebar/sidebar-settings';
import SidebarSpectators from 'fpp/components/sidebar/sidebar-spectators';

const buttons: {
  tab: keyof typeof SidebarTabs;
  icon: ReactNode;
  badge?: () => number;
}[] = [
  {
    tab: SidebarTabs.spectators,
    icon: <IconEye size={22} />,
    badge: () => {
      const users = useRoomStore.getState().users;
      return users.filter((user) => user.isSpectator).length;
    },
  },
  {
    tab: SidebarTabs.settings,
    icon: <IconSettings size={22} />,
  },
  {
    tab: SidebarTabs.room_analytics,
    icon: <IconGraph size={22} />,
  },
];

const Sidebar = ({
  triggerAction,
}: {
  triggerAction: (action: Action) => void;
}) => {
  const tab = useSidebarStore((state) => state.tab);
  const setTab = useSidebarStore((state) => state.setTab);

  return (
    <motion.div
      className={`flex justify-end fixed top-0 right-0 md:right-3 pr-2 md:pr-0 z-40`}
      animate={tab !== null ? 'open' : 'closed'}
      variants={{
        open: {
          width:
            typeof window !== 'undefined' && window.innerWidth < 768
              ? '100vw'
              : '460px',
        },
        closed: { width: '72px' },
      }}
    >
      <AnimatePresence>
        {tab === SidebarTabs.spectators && (
          <SidebarSpectators triggerAction={triggerAction} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {tab === SidebarTabs.settings && (
          <SidebarSettings triggerAction={triggerAction} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {tab === SidebarTabs.room_analytics && <SidebarRoomAnalytics />}
      </AnimatePresence>
      <div className="md:mt-3 mt-2 flex flex-col text-white">
        {buttons.map(({ tab: buttonTab, icon, badge }, index) => {
          const badgeCount = badge ? badge() : 0;
          const showBadge = badgeCount > 0;

          return (
            <Button
              key={index}
              size="lg"
              variant={tab === buttonTab ? 'filled' : 'default'}
              className="md:mb-2 mb-1 px-3 relative overflow-visible"
              onClick={() => {
                if (tab === buttonTab) {
                  setTab(null);
                } else if (tab) {
                  setTab(null);
                  setTimeout(() => {
                    setTab(buttonTab);
                  }, 170);
                } else {
                  setTab(buttonTab);
                }
              }}
            >
              {icon}
              {showBadge && (
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                  {badgeCount}
                </span>
              )}
            </Button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default Sidebar;
