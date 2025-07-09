import { type ReactNode } from 'react';

import { Card } from '@mantine/core';

import { motion } from 'framer-motion';

const SidebarContent = ({
  childrens,
}: {
  childrens: { title: string; content: ReactNode }[];
}) => {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            when: 'beforeChildren',
            staggerChildren: 0.1,
          },
        },
      }}
      initial="hidden"
      animate="visible"
      exit="hidden"
      className="md:mt-3 mt-2 md:ml-3 ml-2 md:mr-6 mr-3 min-w-[300px]"
    >
      {childrens.map((children, index) => (
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 10 },
            visible: { opacity: 1, y: 0 },
          }}
          key={index}
        >
          <Card withBorder shadow="sm" radius="md" className="mb-4">
            <Card.Section withBorder p="xs">
              <h3 className="p-0 m-0 text-base">{children.title}</h3>
            </Card.Section>
            <Card.Section className="p-2">
              <div className="flex justify-evenly text-center">
                {children.content}
              </div>
            </Card.Section>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
};

export default SidebarContent;
