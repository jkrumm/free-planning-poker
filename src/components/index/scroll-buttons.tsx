"use client";

import { Button } from "@mantine/core";
import {
  IconArrowBadgeDownFilled,
  IconArrowBadgeUpFilled,
} from "@tabler/icons-react";
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";

const ScrollButtons = ({ inView }: { inView: boolean }) => {
  return (
    <>
      <AnimatePresence mode="wait">
        {inView ? (
          <motion.div
            key="up"
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: "auto",
              opacity: 1,
              transition: {
                duration: 0.5,
                type: "spring",
                opacity: {
                  delay: 0.025,
                },
                height: {
                  delay: 0,
                },
              },
            }}
            exit={{ height: 0, opacity: 0 }}
          >
            <Link
              href="/"
              className="scroll-to-top"
              onClick={() => {
                window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
              }}
            >
              <Button size="lg" color="gray" px={8} role="scroll-to-top">
                <IconArrowBadgeUpFilled size={35} spacing={0} />
              </Button>
            </Link>
          </motion.div>
        ) : (
          <motion.div
            key="down"
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: "auto",
              opacity: 1,
              transition: {
                duration: 0.5,
                type: "spring",
                opacity: {
                  delay: 0.025,
                },
              },
            }}
            exit={{ height: 0, opacity: 0 }}
          >
            <Link
              href="/#master-the-art-of-planning-poker"
              className="fixed-article-link"
            >
              <Button
                rightIcon={<IconArrowBadgeDownFilled size={35} spacing={0} />}
                size="lg"
                color="gray"
                role="understand-planning-poker"
              >
                Understand Planning Poker{" "}
              </Button>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ScrollButtons;
