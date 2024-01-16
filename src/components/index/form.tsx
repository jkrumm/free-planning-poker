"use client";

import { useForm } from "@mantine/form";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import React, { useEffect } from "react";
import { Button, Group, TextInput } from "@mantine/core";
import { IconArrowBadgeRightFilled } from "@tabler/icons-react";
import { useRouter } from "next/router";
import { api } from "fpp/utils/api";
import { RoomEvent } from "fpp/server/db/schema";

const IndexForm = () => {
  const router = useRouter();

  const roomReadable = useLocalstorageStore((state) => state.roomReadable);
  const setRoomReadable = useLocalstorageStore((state) => state.setRoomName);
  const setRoomEvent = useLocalstorageStore((state) => state.setRoomEvent);

  const { data: randomRoomNumber } = api.room.getOpenRoomNumber.useQuery();

  useEffect(() => {
    if (
      !roomReadable ||
      roomReadable === "null" ||
      roomReadable === "undefined"
    ) {
      setRoomReadable(null);
    } else {
      router
        .push(`/room/${roomReadable}`)
        .then(() => ({}))
        .catch(() => ({}));
    }
  }, [roomReadable]);

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

  // let secondRender = false;
  useEffect(() => {
    // secondRender = true;
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
          if (!randomRoomNumber) {
            console.error("No random room number found");
          }
          setRoomReadable(String(randomRoomNumber));
          setRoomEvent(RoomEvent.ENTERED_RANDOM_ROOM);
          router
            .push(`/room/${randomRoomNumber}`)
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
          setRoomReadable(roomValue);
          setRoomEvent(RoomEvent.ENTERED_ROOM_DIRECTLY);
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
