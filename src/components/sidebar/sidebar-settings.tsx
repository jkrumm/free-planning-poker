import React from 'react';

import {
  Button,
  Divider,
  Switch,
  Text,
  TextInput,
  rem,
  useMantineTheme,
} from '@mantine/core';
import { useForm } from '@mantine/form';

import { IconBell, IconVolume } from '@tabler/icons-react';
import type { Action } from 'fpp-server/src/room.actions';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';
import { useRoomStore } from 'fpp/store/room.store';

import { UserActions } from 'fpp/components/room/user-actions';
import SidebarContent from 'fpp/components/sidebar/sidebar-content';

const SidebarSettings = ({
  triggerAction,
}: {
  triggerAction: (action: Action) => void;
}) => {
  return (
    <SidebarContent
      childrens={[
        {
          title: 'User Settings',
          content: <UserSettings triggerAction={triggerAction} />,
        },
      ]}
    />
  );
};

const UserSettings = ({
  triggerAction,
}: {
  triggerAction: (action: Action) => void;
}) => {
  const theme = useMantineTheme();

  // User localstorage state
  const isPlaySound = useLocalstorageStore((store) => store.isPlaySound);
  const setIsPlaySound = useLocalstorageStore((store) => store.setIsPlaySound);
  const username = useLocalstorageStore((store) => store.username);
  const setUsername = useLocalstorageStore((store) => store.setUsername);
  const isNotificationsEnabled = useLocalstorageStore(
    (store) => store.isNotificationsEnabled,
  );
  const setIsNotificationsEnabled = useLocalstorageStore(
    (store) => store.setIsNotificationsEnabled,
  );

  // Room state
  const userId = useLocalstorageStore((state) => state.userId);
  const roomId = useLocalstorageStore((state) => state.roomId);
  const users = useRoomStore((store) => store.users);
  const currentUser = users.find((user) => user.id === userId);

  const form = useForm({
    initialValues: { username: username ?? '' },
    validate: {
      username: (value) =>
        value?.replace(/[^A-Za-z]/g, '').length < 3 ||
        value?.replace(/[^A-Za-z]/g, '').length > 15
          ? 'Username must be between 3 and 15 characters'
          : null,
    },
  });

  const changeUsername = () => {
    if (!roomId || !userId || username === form.values.username) {
      return;
    }

    triggerAction({
      action: 'changeUsername',
      userId,
      roomId,
      username: form.values.username,
    });

    setUsername(form.values.username);
  };

  return (
    <div className="text-left w-full">
      <form onSubmit={form.onSubmit(changeUsername)} className="my-2">
        <TextInput
          {...form.getInputProps('username')}
          onChange={(e) => {
            form.setFieldValue(
              'username',
              e.currentTarget.value.trim().replace(/[^A-Za-z]/g, ''),
            );
          }}
        />
        <Button variant="default" type="submit" className="mt-2">
          Change Username
        </Button>
      </form>

      <Switch
        checked={isPlaySound}
        onChange={() => setIsPlaySound(!isPlaySound)}
        color="teal"
        size="md"
        className="mt-6 mb-2"
        label={
          <Text className="mt-[1px]" size="sm">
            Play Sounds
          </Text>
        }
        thumbIcon={
          isPlaySound ? (
            <IconVolume
              style={{ width: rem(12), height: rem(12) }}
              color={theme.colors.teal[6]}
              stroke={3}
            />
          ) : (
            <IconVolume
              style={{ width: rem(12), height: rem(12) }}
              color={theme.colors.red[6]}
              stroke={3}
            />
          )
        }
      />

      <Switch
        checked={isNotificationsEnabled}
        onChange={() => setIsNotificationsEnabled(!isNotificationsEnabled)}
        color="teal"
        size="md"
        className="mt-5 mb-2"
        label={
          <Text className="mt-[1px]" size="sm">
            Show Notifications
          </Text>
        }
        thumbIcon={
          isNotificationsEnabled ? (
            <IconBell
              style={{ width: rem(12), height: rem(12) }}
              color={theme.colors.teal[6]}
              stroke={3}
            />
          ) : (
            <IconBell
              style={{ width: rem(12), height: rem(12) }}
              color={theme.colors.red[6]}
              stroke={3}
            />
          )
        }
      />

      {/* Room Actions */}
      {currentUser && userId && roomId && (
        <>
          <Divider my="md" />
          <Text size="sm" fw={500} mb="sm">
            Room Actions
          </Text>
          <UserActions
            user={currentUser}
            userId={userId}
            roomId={roomId}
            triggerAction={triggerAction}
            layout="vertical"
            size="sm"
          />
        </>
      )}
    </div>
  );
};

export default SidebarSettings;
