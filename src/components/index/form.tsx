'use client';

import React, { startTransition, useEffect, useState } from 'react';

import { useRouter } from 'next/router';

import { Button, Group, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { useForm } from '@mantine/form';

import { IconArrowBadgeRightFilled } from '@tabler/icons-react';
import { motion, useSpring, useTransform } from 'framer-motion';

import { api } from 'fpp/utils/api';
import { addBreadcrumb, captureError } from 'fpp/utils/app-error';
import { generateRoomNumber } from 'fpp/utils/room-number.util';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';

import { RoomEvent } from 'fpp/server/db/schema';

import { useHasMounted } from 'fpp/hooks/use-has-mounted.hook';

import { FlipWords } from './flip-words';

const FALLBACK_USER_COUNT = 10000;
const FALLBACK_ESTIMATION_COUNT = 70000;

const IndexForm = () => {
  const hasMounted = useHasMounted();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const checkReady = () => {
        if (
          typeof document !== 'undefined' &&
          document.readyState === 'complete'
        ) {
          startTransition(() => {
            setIsHydrated(true);
          });
        } else {
          setTimeout(checkReady, 100);
        }
      };

      setTimeout(checkReady, 0);
    } catch (error) {
      captureError(
        error instanceof Error
          ? error
          : new Error('Failed to initialize IndexForm'),
        {
          component: 'IndexForm',
          action: 'useEffect',
        },
        'medium',
      );
    }
  }, []);

  const router = useRouter();

  const roomName = useLocalstorageStore((state) => state.roomName);
  const setRoomReadable = useLocalstorageStore((state) => state.setRoomName);
  const setRoomEvent = useLocalstorageStore((state) => state.setRoomEvent);

  const getOpenRoomNumberQuery = api.room.getOpenRoomNumber.useQuery();

  let openRoomNumber = generateRoomNumber();

  if (getOpenRoomNumberQuery.isSuccess && getOpenRoomNumberQuery.data) {
    openRoomNumber = getOpenRoomNumberQuery.data;
  } else if (getOpenRoomNumberQuery.isError) {
    captureError(
      getOpenRoomNumberQuery.error || 'Failed to get open room number',
      {
        component: 'IndexForm',
        action: 'getOpenRoomNumber',
        extra: {
          fallbackRoomNumber: openRoomNumber,
        },
      },
      'low',
    );
  }

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    try {
      startTransition(() => {
        if (!roomName || roomName === 'null' || roomName === 'undefined') {
          setRoomReadable(null);
        } else {
          addBreadcrumb('Navigating to existing room', 'navigation', {
            roomName,
          });
          router
            .push(`/room/${roomName}`)
            .then(() => {
              addBreadcrumb('Navigation to room successful', 'navigation');
            })
            .catch((error) => {
              captureError(
                error instanceof Error ? error : new Error('Navigation failed'),
                {
                  component: 'IndexForm',
                  action: 'navigateToRoom',
                  extra: { roomName },
                },
                'medium',
              );
            });
        }
      });
    } catch (error) {
      captureError(
        error instanceof Error
          ? error
          : new Error('Failed to handle room navigation'),
        {
          component: 'IndexForm',
          action: 'handleRoomNavigation',
          extra: { roomName, hasMounted },
        },
        'medium',
      );
    }
  }, [hasMounted, roomName, router, setRoomReadable]);

  const form = useForm({
    initialValues: {
      room: '',
    },
    validate: {
      room: (value) => {
        const cleanValue = value.replace(/[^A-Za-z0-9]/g, '');
        return cleanValue.length < 3 || cleanValue.length > 15;
      },
    },
  });

  useEffect(() => {
    try {
      startTransition(() => {
        const roomValue = form.values.room
          .replace(/[^A-Za-z0-9]/g, '')
          .toUpperCase();
        form.setFieldValue('room', roomValue);
      });
    } catch (error) {
      captureError(
        error instanceof Error
          ? error
          : new Error('Failed to format room input'),
        {
          component: 'IndexForm',
          action: 'formatRoomInput',
          extra: {
            originalValue: form.values.room,
          },
        },
        'low',
      );
    }
  }, [form.values.room]);

  const words = ['fast', 'for free', 'privatly', 'easily', 'realtime'];

  const { data: analytics, error: analyticsError } =
    api.landingpage.getAnalytics.useQuery(undefined, {
      enabled: isHydrated,
      refetchOnWindowFocus: false,
    });

  useEffect(() => {
    if (analyticsError) {
      captureError(
        analyticsError,
        {
          component: 'IndexForm',
          action: 'landingPageAnalytics',
        },
        'low',
      );
    }
  }, [analyticsError]);

  const handleStartPlanning = () => {
    try {
      setRoomReadable(String(openRoomNumber));
      setRoomEvent(RoomEvent.ENTERED_RANDOM_ROOM);
      addBreadcrumb('Starting random room', 'navigation', {
        roomNumber: openRoomNumber,
      });
      router
        .push(`/room/${openRoomNumber}`)
        .then(() => {
          addBreadcrumb('Navigation to random room successful', 'navigation');
        })
        .catch((error) => {
          captureError(
            error instanceof Error
              ? error
              : new Error('Failed to navigate to random room'),
            {
              component: 'IndexForm',
              action: 'handleStartPlanning',
              extra: { roomNumber: openRoomNumber },
            },
            'medium',
          );
        });
    } catch (error) {
      captureError(
        error instanceof Error ? error : new Error('Failed to start planning'),
        {
          component: 'IndexForm',
          action: 'handleStartPlanning',
          extra: { roomNumber: openRoomNumber },
        },
        'medium',
      );
    }
  };

  const handleJoinRoom = () => {
    try {
      const roomValue = form.values.room.toLowerCase();
      setRoomReadable(roomValue);
      setRoomEvent(RoomEvent.ENTERED_ROOM_DIRECTLY);
      addBreadcrumb('Joining specific room', 'navigation', {
        roomName: roomValue,
      });
      router
        .push(`/room/${roomValue}`)
        .then(() => {
          addBreadcrumb('Navigation to specific room successful', 'navigation');
        })
        .catch((error) => {
          captureError(
            error instanceof Error
              ? error
              : new Error('Failed to navigate to specific room'),
            {
              component: 'IndexForm',
              action: 'handleJoinRoom',
              extra: { roomName: roomValue },
            },
            'medium',
          );
        });
    } catch (error) {
      captureError(
        error instanceof Error ? error : new Error('Failed to join room'),
        {
          component: 'IndexForm',
          action: 'handleJoinRoom',
          extra: { formRoom: form.values.room },
        },
        'medium',
      );
    }
  };

  useEffect(() => {
    if (hasMounted && isHydrated) {
      addBreadcrumb('IndexForm fully loaded', 'component', { openRoomNumber });
    }
  }, [hasMounted, isHydrated, openRoomNumber]);

  return (
    <>
      <div className="mb-14 text-center">
        <Title order={2} className="mb-4">
          Estimate your Story Points{' '}
          <FlipWords words={words} duration={5000} className="w-[105px]" />
        </Title>
        <Title order={3} className="font-normal opacity-70">
          Say goodbye to complicated planning poker tools and estimate in
          seconds with this user-friendly app.
          <br />
          No signups, open source and privacy focused.
        </Title>
      </div>
      <Group className="mb-16 md:flex">
        <Button
          color="#1971C2"
          size="xl"
          className={`left-0 mx-auto block w-[300px] animate-shimmer bg-[linear-gradient(110deg,#2e2e2e,45%,#272727,55%,#2e2e2e)] transition-colors bg-[length:200%_100%] border-[1px] border-solid border-[#424242] text-[20px]`}
          type="button"
          role="button"
          aria-label="Start Planning"
          onClick={handleStartPlanning}
        >
          Start Planning
        </Button>
        <form className="pl-8" onSubmit={form.onSubmit(handleJoinRoom)}>
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
                    className={`join-room-input absolute my-4 w-[300px] rounded-md border-[0px] border-solid border-[#272727] text-[20px]`}
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
      <div className="mb-3 text-center">
        <Title order={4} className="mb-0">
          Loved by Agile Teams Worldwide
        </Title>
        <div className="grid grid-cols-2 gap-6">
          <div className="p-4">
            <Text fz="sm" tt="uppercase" fw={700} c="dimmed">
              USERS
            </Text>
            <Text fz="lg" fw={500} className="mono">
              <AnimatedNumber
                value={analytics?.user_count ?? FALLBACK_USER_COUNT}
                delay={800}
              />
            </Text>
          </div>
          <div className="p-4">
            <Text fz="sm" tt="uppercase" fw={700} c="dimmed">
              ESTIMATIONS
            </Text>
            <Text fz="lg" fw={500} className="mono">
              <AnimatedNumber
                value={analytics?.estimation_count ?? FALLBACK_ESTIMATION_COUNT}
                delay={800}
              />
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
    try {
      const timeout = setTimeout(() => {
        startTransition(() => {
          spring.set(value);
        });
      }, delay);

      return () => clearTimeout(timeout);
    } catch (error) {
      captureError(
        error instanceof Error ? error : new Error('Failed to animate number'),
        {
          component: 'AnimatedNumber',
          action: 'useEffect',
          extra: { value, delay },
        },
        'low',
      );
    }
  }, [spring, value, delay]);

  return <motion.span>{display}</motion.span>;
}

export default IndexForm;
