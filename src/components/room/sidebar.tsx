import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, useState } from "react";
import { IconGraph, IconHistory } from "@tabler/icons-react";
import { Button, Card, Text } from "@mantine/core";

const contentVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: "beforeChildren",
      staggerChildren: 0.1,
    },
  },
};

const sidebarTabs = {
  room_history: "room_history",
  room_analytics: "room_analytics",
  user_analytics: "user_analytics",
  error_report: "error_report",
} as const;

const SidebarContent = ({
  childrens,
}: {
  childrens: { title: string; content: ReactNode }[];
}) => {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      className="m-6 min-w-[300px]"
    >
      {childrens.map((children, index) => (
        <motion.div variants={contentVariants} key={index}>
          <Card withBorder shadow="sm" radius="md" className="mb-4">
            <Card.Section withBorder p="xs">
              <Text size="lg" weight="800">
                {children.title}
              </Text>
            </Card.Section>
            <Card.Section className="p-2">{children.content}</Card.Section>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
};

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
        {tab === sidebarTabs.room_history && (
          <SidebarContent
            childrens={[
              {
                title: "Room History",
                content: "TODO",
              },
              {
                title: "Room History",
                content: "TODO",
              },
              {
                title: "Room History",
                content: "TODO",
              },
              {
                title: "Room History",
                content: "TODO",
              },
              {
                title: "Room History",
                content: "TODO",
              },
            ]}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {tab === sidebarTabs.room_analytics && (
          <SidebarContent
            childrens={[
              {
                title: "Room Analytics",
                content: "TODO",
              },
              {
                title: "Room Analytics",
                content: "TODO",
              },
              {
                title: "Room Analytics",
                content: "TODO",
              },
              {
                title: "Room Analytics",
                content: "TODO",
              },
              {
                title: "Room Analytics",
                content: "TODO",
              },
            ]}
          />
        )}
      </AnimatePresence>
      <div className="m-6 ml-0 flex flex-col  text-white">
        <Button
          size="lg"
          variant={tab === sidebarTabs.room_history ? "filled" : "default"}
          className="mb-4 px-3"
          onClick={() => {
            if (tab === sidebarTabs.room_history) {
              // void sidebarOpenControl.start("closed");
              // setSidebarOpen(false);
              setTab(null);
              setTimeout(() => {
                setOpen(false);
              }, 500);
            } else if (tab) {
              setTab(null);
              setTimeout(() => {
                setTab(sidebarTabs.room_history);
              }, 500);
            } else {
              // void sidebarOpenControl.start("open");
              // setSidebarOpen(true);
              setOpen(true);
              setTab(sidebarTabs.room_history);
            }
          }}
        >
          <IconHistory size={22} />
        </Button>
        <Button
          size="lg"
          variant={tab === sidebarTabs.room_analytics ? "filled" : "default"}
          className="px-3"
          onClick={() => {
            if (tab === sidebarTabs.room_analytics) {
              // void sidebarOpenControl.start("closed");
              // setSidebarOpen(false);
              setTab(null);
              setTimeout(() => {
                setOpen(false);
              }, 500);
            } else if (tab) {
              setTab(null);
              setTimeout(() => {
                setTab(sidebarTabs.room_analytics);
              }, 500);
            } else {
              // setSidebarOpen(true);
              // void sidebarOpenControl.start("open");
              setOpen(true);
              setTab(sidebarTabs.room_analytics);
            }
          }}
        >
          <IconGraph size={22} />
        </Button>
      </div>
    </motion.div>
  );
};

export default Sidebar;
