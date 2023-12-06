"use client";

import { useForm } from "@mantine/form";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import React, { useEffect } from "react";
import { Button, Group, TextInput } from "@mantine/core";
import { IconArrowBadgeRightFilled } from "@tabler/icons-react";
import { useRouter } from "next/router";
import { type Logger } from "next-axiom";
import { logMsg, roomEvent } from "fpp/constants/logging.constant";

const IndexForm = ({ logger }: { logger: Logger }) => {
  const router = useRouter();

  const visitorId = useLocalstorageStore((state) => state.visitorId);

  const room = useLocalstorageStore((state) => state.room);
  const setRoom = useLocalstorageStore((state) => state.setRoom);

  useEffect(() => {
    if (!room || room === "null" || room === "undefined") {
      setRoom(null);
    } else {
      router
        .push(`/room/${room}`)
        .then(() => ({}))
        .catch(() => ({}));
    }
  }, [room]);

  const form = useForm({
    initialValues: {
      room: "",
    },
    validate: {
      room: (value) =>
        value.replace(/[^A-Za-z0-9]/g, "").length < 3 ||
        value.replace(/[^A-Za-z0-9]/g, "").length > 15,
    },
  });

  useEffect(() => {
    const roomValue = form.values.room
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
    form.setFieldValue("room", roomValue);
  }, [form.values.room]);

  return (
    <Group className="mb-16 hidden md:flex">
      <Button
        color="#1971C2"
        size="xl"
        className={`left-0 mx-auto my-8 block w-[300px]`}
        type="button"
        role="button"
        aria-label="Start Planning"
        onClick={() => {
          const randomRoom = String(
            Math.floor(Math.random() * (999999 - 100000) + 100000), //NOSONAR
          );
          console.log("randomRoom", randomRoom);
          setRoom(randomRoom);
          logger.info(logMsg.TRACK_ROOM_EVENT, {
            visitorId,
            room: randomRoom,
            event: roomEvent.ENTER_RANDOM_ROOM,
          });
          router
            .push(`/room/${randomRoom}`)
            .then(() => ({}))
            .catch(() => ({}));
        }}
      >
        Start Planning
      </Button>
      <form
        className="pl-8"
        onSubmit={form.onSubmit(() => {
          const roomValue = form.values.room.toLowerCase();
          setRoom(roomValue);
          logger.info(logMsg.TRACK_ROOM_EVENT, {
            visitorId,
            room: roomValue,
            event: roomEvent.ENTER_NEW_ROOM,
          });
          router
            .push(`/room/${roomValue}`)
            .then(() => ({}))
            .catch(() => ({}));
        })}
      >
        <div className="mx-auto">
          <div className="w-full">
            <Group className="relative w-[300px] flex-nowrap" gap="0">
              <TextInput
                placeholder="Join room"
                className={`absolute my-6 w-[300px] rounded-md border-[2px] border-solid border-[#1971C2]`}
                size="xl"
                {...form.getInputProps("room")}
              />
              <Button
                role="button"
                aria-label="Join room"
                size="xl"
                className={`only-right-rounded absolute right-0 mr-[3px] h-[58px] px-4`}
                type="submit"
                disabled={!form.isValid()}
              >
                <IconArrowBadgeRightFilled size={35} spacing={0} />
              </Button>
            </Group>
          </div>
        </div>
      </form>
    </Group>
  );
};

export default IndexForm;
