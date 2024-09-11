import { type ReactNode } from 'react';

import { Button } from '@mantine/core';

import { IconGraph, IconSettings } from '@tabler/icons-react';
import type { Action } from 'fpp-server/src/room.actions';
import { AnimatePresence, motion } from 'framer-motion';

import { SidebarTabs, useSidebarStore } from 'fpp/store/sidebar.store';

import SidebarRoomAnalytics from 'fpp/components/sidebar/sidebar-room-analytics';
import SidebarSettings from 'fpp/components/sidebar/sidebar-settings';

const buttons: {
  tab: keyof typeof SidebarTabs;
  icon: ReactNode;
}[] = [
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
      className={`flex justify-end`}
      animate={tab !== null ? 'open' : 'closed'}
      variants={{
        open: { width: '460px' },
        closed: { width: '72px' },
      }}
    >
      <AnimatePresence>
        {tab === SidebarTabs.settings && (
          <SidebarSettings triggerAction={triggerAction} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {tab === SidebarTabs.room_analytics && <SidebarRoomAnalytics />}
      </AnimatePresence>
      <div className="m-6 ml-0 flex flex-col  text-white">
        {buttons.map(({ tab: buttonTab, icon }, index) => (
          <Button
            size="lg"
            key={index}
            variant={tab === buttonTab ? 'filled' : 'default'}
            className="mb-4 px-3"
            onClick={() => {
              if (tab === buttonTab) {
                setTab(null);
              } else if (tab) {
                setTab(null);
                setTimeout(() => {
                  setTab(buttonTab);
                }, 500);
              } else {
                setTab(buttonTab);
              }
            }}
          >
            {icon}
          </Button>
        ))}
      </div>
    </motion.div>
  );
};

export default Sidebar;
