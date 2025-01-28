'use client';

import React, { startTransition, useEffect, useState } from 'react';

import { useRouter } from 'next/router';

import { Button, Group, TextInput, Title, Tooltip } from '@mantine/core';
import { useForm } from '@mantine/form';

import { IconArrowBadgeRightFilled } from '@tabler/icons-react';

import { api } from 'fpp/utils/api';
import { generateRoomNumber } from 'fpp/utils/room-number.util';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';

import { RoomEvent } from 'fpp/server/db/schema';

import { FlipWords } from './flip-words';

const IndexForm = () => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const router = useRouter();

  const roomName = useLocalstorageStore((state) => state.roomName);
  const setRoomReadable = useLocalstorageStore((state) => state.setRoomName);
  const setRoomEvent = useLocalstorageStore((state) => state.setRoomEvent);

  const getOpenRoomNumberQuery = api.room.getOpenRoomNumber.useQuery();

  let openRoomNumber = generateRoomNumber();

  if (getOpenRoomNumberQuery.isSuccess && getOpenRoomNumberQuery.data) {
    openRoomNumber = getOpenRoomNumberQuery.data;
  }

  useEffect(() => {
    if (!hasMounted) {
      return;
    }
    startTransition(() => {
      if (!roomName || roomName === 'null' || roomName === 'undefined') {
        setRoomReadable(null);
      } else {
        router
          .push(`/room/${roomName}`)
          .then(() => ({}))
          .catch(() => ({}));
      }
    });
  }, [hasMounted, roomName]);

  const form = useForm({
    initialValues: {
      room: '',
    },
    validate: {
      room: (value) =>
        value.replace(/[^A-Za-z0-9]/g, '').length < 3 ||
        value.replace(/[^A-Za-z0-9]/g, '').length > 15,
    },
  });

  useEffect(() => {
    startTransition(() => {
      const roomValue = form.values.room
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase();
      form.setFieldValue('room', roomValue);
    });
  }, [form.values.room]);

  const words = ['fast', 'easily', 'for free', 'privatly'];

  return (
    <>
      <div
        className="mb-10 text-center opacity-0 animate-fadeInUp"
        style={{ animationDelay: `200ms` }}
      >
        <Title order={2}>
          Estimate your Story Points{' '}
          <FlipWords words={words} duration={5000} className="w-[95px]" />
        </Title>
        <Title order={3} className="mt-5 font-normal opacity-70">
          Say goodbye to complicated planning poker tools and estimate in
          seconds with this user-friendly app.
          <br />
          No signups, open source and privacy focused.
        </Title>
      </div>
      <Group
        className="mb-8 hidden md:flex opacity-0 animate-fadeInUp"
        style={{ animationDelay: `400ms` }}
      >
        <Button
          color="#1971C2"
          size="xl"
          className={`left-0 mx-auto my-8 block w-[300px]`}
          type="button"
          role="button"
          aria-label="Start Planning"
          onClick={() => {
            setRoomReadable(String(openRoomNumber));
            setRoomEvent(RoomEvent.ENTERED_RANDOM_ROOM);
            router
              .push(`/room/${openRoomNumber}`)
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
              <Tooltip
                label="Create or enter a room with the name of your choice"
                position="top"
                events={{ hover: true, focus: true, touch: true }}
                offset={37}
                color="gray"
              >
                <Group className="relative w-[300px] flex-nowrap" gap="0">
                  <TextInput
                    placeholder="Join room"
                    className={`absolute my-4 w-[300px] rounded-md border-[2px] border-solid border-[#1971C2]`}
                    size="xl"
                    {...form.getInputProps('room')}
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
              </Tooltip>
            </div>
          </div>
        </form>
      </Group>
    </>
  );
};

export default IndexForm;
