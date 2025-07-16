import React from 'react';

import { Button, FocusTrap, Modal, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';

import { IconUser } from '@tabler/icons-react';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';

export const UsernameModel = ({
  modelOpen,
  setModelOpen,
  room,
}: {
  modelOpen: boolean;
  setModelOpen: (modelOpen: boolean) => void;
  room: string | undefined;
}) => {
  const setUsername = useLocalstorageStore((store) => store.setUsername);

  const form = useForm({
    initialValues: { username: '' },
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
        return null;
      },
    },
    validateInputOnChange: true,
    validateInputOnBlur: true,
  });

  const handleSubmit = () => {
    if (!form.values.username) {
      return;
    }

    const cleanUsername = form.values.username.replace(/[^A-Za-z]/g, '').trim();

    setUsername(cleanUsername);
    setModelOpen(false);
  };

  return (
    <Modal
      opened={modelOpen}
      onClose={() => setModelOpen(!modelOpen)}
      withCloseButton={false}
      centered
      closeOnEscape={false}
      closeOnClickOutside={false}
      size="sm"
    >
      <div className="p-4">
        <Text size="lg" fw={500} className="mb-1">
          Join Room
        </Text>
        <Text size="sm" c="dimmed" className="mb-6">
          Enter your username to join room:{' '}
          <strong>{room?.toUpperCase() ?? ''}</strong>
        </Text>

        <FocusTrap active={true}>
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <TextInput
              {...form.getInputProps('username')}
              autoFocus
              data-autofocus
              placeholder="Enter your username"
              label="Username"
              description="3-15 characters, letters only"
              leftSection={<IconUser size={16} />}
              onChange={(e) => {
                const cleanValue = e.currentTarget.value
                  .replace(/[^A-Za-z]/g, '')
                  .trim();
                form.setFieldValue('username', cleanValue);
              }}
              className="mb-4"
            />
            <Button
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
              size="md"
              className="w-full mt-4"
              type="submit"
              disabled={!form.isValid()}
            >
              Join Room
            </Button>
          </form>
        </FocusTrap>
      </div>
    </Modal>
  );
};
