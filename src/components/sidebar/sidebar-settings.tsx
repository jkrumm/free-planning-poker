import React from 'react';

import {
  Button,
  Switch,
  Text,
  TextInput,
  rem,
  useMantineTheme,
} from '@mantine/core';
import { useForm } from '@mantine/form';

import { IconBell, IconVolume } from '@tabler/icons-react';

import { api } from 'fpp/utils/api';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';

import SidebarContent from 'fpp/components/sidebar/sidebar-content';

const SidebarSettings = () => {
  return (
    <SidebarContent
      childrens={[
        {
          title: 'User Settings',
          content: <UserSettings />,
        },
      ]}
    />
  );
};

const UserSettings = () => {
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

  const changeUsernameMutation = api.roomState.changeUsername.useMutation();

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

    changeUsernameMutation.mutate(
      {
        roomId,
        userId,
        username: form.values.username,
      },
      {
        onSuccess: () => {
          setUsername(form.values.username);
        },
      },
    );
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
    </div>
  );
};

export default SidebarSettings;
