'use client';

import React, { startTransition, useEffect, useState } from 'react';

import { useRouter } from 'next/router';

import { env } from 'fpp/env';

import { Button, Group, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { useForm } from '@mantine/form';

import { IconArrowBadgeRightFilled } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { motion, useSpring, useTransform } from 'framer-motion';

import { api } from 'fpp/utils/api';
import { generateRoomNumber } from 'fpp/utils/room-number.util';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';

import { RoomEvent } from 'fpp/server/db/schema';

import { FlipWords } from './flip-words';

interface LandingPageAnalytics {
  estimation_count: number;
  user_count: number;
}

// Button code
// <button className="inline-flex h-12 animate-shimmer items-center justify-center rounded-md border border-slate-800 bg-[linear-gradient(110deg,#000103,45%,#1e2631,55%,#000103)] bg-[length:200%_100%] px-6 font-medium text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50">
//   Shimmer
// </button>

const fetchAnalytics = async (): Promise<LandingPageAnalytics> => {
  const response = await fetch(
    `${env.NEXT_PUBLIC_API_ROOT}api/landingpage-analytics`,
  );
  if (!response.ok) {
    throw new Error('Failed to fetch analytics');
  }
  return (await response.json()) as LandingPageAnalytics;
};

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

  const words = ['fast', 'for free', 'privatly', 'easily'];

  const { data: analytics } = useQuery({
    queryKey: ['landingPageAnalytics'],
    queryFn: fetchAnalytics,
    initialData: {
      estimation_count: 17000,
      user_count: 3400,
    },
  });

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
          className={`left-0 mx-auto my-8 block w-[300px] animate-shimmer bg-[#1971C2] bg-[linear-gradient(110deg,#1971C2,45%,#228be6,55%,#1971C2)] transition-colors bg-[length:200%_100%]`}
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
      <div
        className="mb-6 text-center opacity-0 animate-fadeInUp"
        style={{ animationDelay: `600ms` }}
      >
        <Title order={4} className="text-neutral-300">
          Loved by Agile Teams Worldwide
        </Title>
        <div className="grid grid-cols-2 gap-6">
          <div className="p-4">
            <Text fz="sm" tt="uppercase" fw={700} c="dimmed">
              USERS
            </Text>
            <Text fz="lg" fw={500}>
              <AnimatedNumber value={analytics.user_count} delay={800} />
            </Text>
          </div>
          <div className="p-4">
            <Text fz="sm" tt="uppercase" fw={700} c="dimmed">
              ESTIMATIONS
            </Text>
            <Text fz="lg" fw={500}>
              <AnimatedNumber value={analytics.estimation_count} delay={800} />
            </Text>
          </div>
        </div>
      </div>
    </>
  );
};

export function AnimatedNumber({
  value,
  delay = 0,
}: {
  value: number;
  delay?: number;
}) {
  const spring = useSpring(value, { mass: 0.8, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) =>
    Math.round(current).toLocaleString(),
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      spring.set(value);
    }, delay);

    return () => clearTimeout(timeout);
  }, [spring, value, delay]);

  return <motion.span>{display}</motion.span>;
}

export default IndexForm;
