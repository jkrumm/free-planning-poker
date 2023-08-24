import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, useState } from "react";
import { IconGraph, IconHistory } from "@tabler/icons-react";
import { Button } from "@mantine/core";
import SidebarRoomHistory from "fpp/components/room/sidebar/sidebar-room-history";
import SidebarRoomAnalytics from "fpp/components/room/sidebar/sidebar-room-analytics";

const sidebarTabs = {
  room_history: "room_history",
  room_analytics: "room_analytics",
  user_analytics: "user_analytics",
  error_report: "error_report",
} as const;

const buttons: {
  tab: keyof typeof sidebarTabs;
  icon: ReactNode;
}[] = [
  {
    tab: sidebarTabs.room_history,
    icon: <IconHistory size={22} />,
  },
  {
    tab: sidebarTabs.room_analytics,
    icon: <IconGraph size={22} />,
  },
];

const Sidebar = () => {
  const [tab, setTab] = useState<null | keyof typeof sidebarTabs>(null);
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      className={`flex justify-end`}
      animate={open ? "open" : "closed"}
      variants={{
        open: { width: "460px" },
        closed: { width: "72px" },
      }}
    >
      <AnimatePresence>
        {tab === sidebarTabs.room_history && <SidebarRoomHistory />}
      </AnimatePresence>
      <AnimatePresence>
        {tab === sidebarTabs.room_analytics && <SidebarRoomAnalytics />}
      </AnimatePresence>
      <div className="m-6 ml-0 flex flex-col  text-white">
        {buttons.map(({ tab: buttonTab, icon }, index) => (
          <Button
            size="lg"
            key={index}
            variant={tab === buttonTab ? "filled" : "default"}
            className="mb-4 px-3"
            onClick={() => {
              if (tab === buttonTab) {
                setTab(null);
                setTimeout(() => {
                  setOpen(false);
                }, 500);
              } else if (tab) {
                setTab(null);
                setTimeout(() => {
                  setTab(buttonTab);
                }, 500);
              } else {
                setOpen(true);
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
