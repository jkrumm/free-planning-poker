import React, { useEffect } from 'react';

import {
  Button,
  Group,
  Switch,
  Text,
  TextInput,
  rem,
  useMantineTheme,
} from '@mantine/core';
import { useForm } from '@mantine/form';

import { IconBell, IconCards, IconVolume } from '@tabler/icons-react';
import type { Action } from 'fpp-server/src/room.actions';

import { api } from 'fpp/utils/api';
import { addBreadcrumb, captureError } from 'fpp/utils/app-error';

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
        {
          title: 'Room Settings',
          content: <RoomSettings triggerAction={triggerAction} />,
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
  const preferCardView = useLocalstorageStore((store) => store.preferCardView);
  const setPreferCardView = useLocalstorageStore(
    (store) => store.setPreferCardView,
  );

  // Room state
  const userId = useLocalstorageStore((state) => state.userId);
  const roomId = useLocalstorageStore((state) => state.roomId);
  const users = useRoomStore((store) => store.users);
  const currentUser = users.find((user) => user.id === userId);

  const form = useForm({
    initialValues: { username: username ?? '' },
    validate: {
      username: (value) => {
        const cleanValue = (value ? value : '')
          .replace(/[^A-Za-z]/g, '')
          .trim();
        if (cleanValue.length < 3) {
          return 'Username must be at least 3 characters';
        }
        if (cleanValue.length > 15) {
          return 'Username must be at most 15 characters';
        }
        if (cleanValue === username) {
          return 'Username did not change';
        }
        return null;
      },
    },
    validateInputOnChange: true,
    validateInputOnBlur: true,
  });

  const handleSubmit = () => {
    if (!form.values.username || !roomId || !userId) {
      return;
    }

    const cleanUsername = form.values.username.replace(/[^A-Za-z]/g, '').trim();

    if (cleanUsername === username) {
      form.setFieldError('username', 'Username did not change');
      return;
    }

    triggerAction({
      action: 'changeUsername',
      userId,
      roomId,
      username: cleanUsername,
    });

    setUsername(cleanUsername);
    form.setFieldValue('username', cleanUsername);
    form.setFieldError('username', null);
  };

  return (
    <div className="text-left w-full">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <div className="mb-4">
          <Text size="sm" fw={500} className="mb-1">
            Username
          </Text>
          <Text size="xs" c="dimmed" className="mb-2">
            3-15 characters, letters only
          </Text>
          <Group
            gap={0}
            wrap="nowrap"
            align="flex-start"
            className="inline-input-group"
          >
            <TextInput
              {...form.getInputProps('username')}
              placeholder="Enter new username"
              onChange={(e) => {
                const cleanValue = e.currentTarget.value
                  .replace(/[^A-Za-z]/g, '')
                  .trim();
                form.setFieldValue('username', cleanValue);
              }}
            />
            <Button
              variant="default"
              type="submit"
              size="sm"
              disabled={!form.isValid()}
            >
              Change
            </Button>
          </Group>
        </div>
      </form>

      <Switch
        checked={preferCardView}
        onChange={() => setPreferCardView(!preferCardView)}
        color="teal"
        size="md"
        className="mt-5"
        label={
          <Text className="mt-[1px]" size="sm">
            Prefer Card View
          </Text>
        }
        thumbIcon={
          preferCardView ? (
            <IconCards
              style={{ width: rem(12), height: rem(12) }}
              color={theme.colors.teal[6]}
              stroke={3}
            />
          ) : (
            <IconCards
              style={{ width: rem(12), height: rem(12) }}
              color={theme.colors.red[6]}
              stroke={3}
            />
          )
        }
      />

      <Switch
        checked={isPlaySound}
        onChange={() => setIsPlaySound(!isPlaySound)}
        color="teal"
        size="md"
        className="mt-3"
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
        className="mt-3 mb-5"
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

const RoomSettings = ({
  triggerAction,
}: {
  triggerAction: (action: Action) => void;
}) => {
  const userId = useLocalstorageStore((state) => state.userId);
  const roomId = useLocalstorageStore((state) => state.roomId);
  const roomName = useLocalstorageStore((state) => state.roomName);

  // Replace the existing updateRoomNameMutation with:
  const updateRoomNameMutation = api.room.updateRoomName.useMutation({
    onSuccess: (data) => {
      try {
        form.setFieldValue('roomName', data.roomName);
        form.setFieldError('roomName', null);

        addBreadcrumb('Room name updated successfully', 'room', {
          newRoomName: data.roomName,
          userId,
          roomId,
        });

        if (userId && roomId && data.roomName) {
          triggerAction({
            action: 'changeRoomName',
            userId,
            roomId,
            roomName: data.roomName,
          });
        }
      } catch (error) {
        captureError(
          error instanceof Error
            ? error
            : new Error('Failed to handle room name update success'),
          {
            component: 'SidebarSettings',
            action: 'updateRoomNameSuccess',
            extra: { newRoomName: data.roomName },
          },
          'medium',
        );
      }
    },
    onError: (error) => {
      captureError(
        error,
        {
          component: 'SidebarSettings',
          action: 'updateRoomName',
          extra: {
            roomName: form.values.roomName,
            userId,
            roomId,
          },
        },
        'high',
      );

      form.setFieldError('roomName', error.message);
    },
  });

  const form = useForm({
    initialValues: { roomName: roomName ?? '' },
    validate: {
      roomName: (value) => {
        const cleanValue = (value ? value : '')
          .replace(/[^A-Za-z0-9]/g, '')
          .toLowerCase();
        if (cleanValue.length < 3) {
          return 'Room name must be at least 3 characters';
        }
        if (cleanValue.length > 15) {
          return 'Room name must be at most 15 characters';
        }
        if (cleanValue === roomName) {
          return 'Room name did not change';
        }
        return null;
      },
    },
    validateInputOnChange: true,
    validateInputOnBlur: true,
  });

  // Clear backend errors when user starts typing
  useEffect(() => {
    const handleFieldChange = () => {
      if (form.errors.roomName && updateRoomNameMutation.isError) {
        form.setFieldError('roomName', null);
      }
    };

    handleFieldChange();
  }, [form.values.roomName]);

  // Also add error handling to the handleSubmit functions:
  const handleSubmit = () => {
    try {
      if (!form.values.roomName || !userId || !roomId) {
        return;
      }

      const cleanRoomName = form.values.roomName
        .replace(/[^A-Za-z0-9]/g, '')
        .toLowerCase();

      addBreadcrumb('Attempting to update room name', 'room', {
        oldRoomName: roomName,
        newRoomName: cleanRoomName,
      });

      updateRoomNameMutation.mutate({
        userId,
        roomId,
        newRoomName: cleanRoomName,
      });
    } catch (error) {
      captureError(
        error instanceof Error
          ? error
          : new Error('Failed to submit room name update'),
        {
          component: 'SidebarSettings',
          action: 'handleSubmit',
          extra: { roomName: form.values.roomName },
        },
        'medium',
      );
    }
  };

  return (
    <div className="text-left w-full">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Text size="sm" fw={500} className="mb-1">
          Room Name
        </Text>
        <Text size="xs" c="dimmed" className="mb-2">
          3-15 characters, letters and numbers only
        </Text>
        <Group
          gap={0}
          wrap="nowrap"
          align="flex-start"
          className="inline-input-group"
        >
          <TextInput
            {...form.getInputProps('roomName')}
            placeholder="Enter new room name"
            onChange={(e) => {
              const cleanValue = e.currentTarget.value
                .replace(/[^A-Za-z0-9]/g, '')
                .toLowerCase();
              form.setFieldValue('roomName', cleanValue);

              if (form.errors.roomName && updateRoomNameMutation.isError) {
                form.setFieldError('roomName', null);
              }
            }}
            disabled={updateRoomNameMutation.isPending}
          />
          <Button
            variant="default"
            type="submit"
            size="sm"
            loading={updateRoomNameMutation.isPending}
            disabled={!form.isValid() || updateRoomNameMutation.isPending}
          >
            Change
          </Button>
        </Group>
      </form>
    </div>
  );
};

export default SidebarSettings;
