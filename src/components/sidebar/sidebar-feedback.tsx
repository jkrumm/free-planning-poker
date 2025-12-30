import React, { useEffect, useState } from 'react';

import { Button, Group, Text, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';

import * as Sentry from '@sentry/nextjs';

import {
  addBreadcrumb,
  captureError,
  captureMessage,
} from 'fpp/utils/app-error';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';
import { useRoomStore } from 'fpp/store/room.store';

import SidebarContent from 'fpp/components/sidebar/sidebar-content';

const SidebarFeedback = () => {
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Get data from localStorage
  const username = useLocalstorageStore((state) => state.username);
  const userId = useLocalstorageStore((state) => state.userId);
  const lastSubmissionTime = useLocalstorageStore(
    (state) => state.lastFeedbackSubmission,
  );
  const canSubmit = useLocalstorageStore((state) => state.canSubmitFeedback());
  const setLastFeedbackSubmission = useLocalstorageStore(
    (state) => state.setLastFeedbackSubmission,
  );

  // Get room state
  const roomState = useRoomStore.getState();
  const roomStateJson = JSON.stringify(roomState);

  // Check if user can submit feedback (rate limiting)
  useEffect(() => {
    addBreadcrumb('Feedback form initialized', 'feedback', {
      canSubmit,
      hasLastSubmission: !!lastSubmissionTime,
    });
  }, [lastSubmissionTime, canSubmit]);

  const form = useForm({
    initialValues: {
      email: '',
      message: '',
    },
    validate: {
      email: (value) =>
        value.trim().length !== 0 &&
        !/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(value)
          ? 'Invalid email'
          : null,
      message: (value) =>
        value.trim().length < 15
          ? 'Message must be at least 15 characters'
          : value.trim().length > 500
            ? 'Message must be at most 500 characters'
            : null,
    },
    validateInputOnChange: true,
    validateInputOnBlur: true,
  });

  const handleSubmit = () => {
    if (!canSubmit) {
      captureMessage(
        'Feedback submission blocked by rate limiting',
        {
          component: 'SidebarFeedback',
          action: 'handleSubmit',
          extra: {
            userId: userId ?? 'unknown',
            lastSubmissionTime: lastSubmissionTime ?? 0,
            timeRemaining: lastSubmissionTime
              ? Math.max(0, 30000 - (Date.now() - lastSubmissionTime))
              : 0,
          },
        },
        'info',
      );
      return;
    }

    try {
      setIsPending(true);

      addBreadcrumb('Submitting feedback', 'feedback', {
        hasEmail: !!form.values.email.trim(),
        messageLength: form.values.message.length,
      });

      // Capture feedback with Sentry
      Sentry.captureFeedback(
        {
          name: username ?? 'Anonymous',
          email: form.values.email ?? undefined,
          message: form.values.message,
        },
        {
          captureContext: {
            tags: {
              userId: userId ?? 'unknown',
            },
            extra: {
              roomState: roomStateJson,
            },
          },
        },
      );

      // Store submission time in localStorage
      const now = Date.now();
      setLastFeedbackSubmission(now);

      // Simulate a delay for better UX
      setTimeout(() => {
        try {
          setIsPending(false);
          setIsSuccess(true);

          notifications.show({
            title: 'Feedback sent',
            color: 'green',
            message: 'Thank you for your feedback!',
          });

          addBreadcrumb('Feedback submitted successfully', 'feedback', {
            submissionTime: now,
          });

          // Reset form after successful submission
          form.reset();

          // Reset success state after 3 seconds
          setTimeout(() => {
            setIsSuccess(false);
          }, 3000);
        } catch (error) {
          captureError(
            error instanceof Error
              ? error
              : new Error('Failed to complete feedback submission'),
            {
              component: 'SidebarFeedback',
              action: 'handleSubmitCompletion',
              extra: {
                userId: userId ?? 'unknown',
              },
            },
            'medium',
          );
          setIsPending(false);
        }
      }, 1000);
    } catch (error) {
      captureError(
        error instanceof Error ? error : new Error('Failed to submit feedback'),
        {
          component: 'SidebarFeedback',
          action: 'handleSubmit',
          extra: {
            userId: userId ?? 'unknown',
            hasEmail: !!form.values.email.trim(),
            messageLength: form.values.message.length,
          },
        },
        'high',
      );
      setIsPending(false);
    }
  };

  return (
    <SidebarContent
      childrens={[
        {
          title: 'Submit Feedback',
          content: (
            <div className="text-left w-full">
              <form onSubmit={form.onSubmit(handleSubmit)}>
                <Text size="sm" className="mb-2">
                  Found a bug or have feedback? Let us know!
                </Text>

                <TextInput
                  label={
                    <>
                      Email <span style={{ opacity: 0.6 }}>(optional)</span>
                    </>
                  }
                  placeholder="Your email"
                  name="email"
                  variant="filled"
                  mt="md"
                  {...form.getInputProps('email')}
                  disabled={isPending || isSuccess || !canSubmit}
                />

                <Textarea
                  mt="md"
                  label="Message"
                  placeholder="Describe the issue or provide feedback"
                  maxRows={8}
                  minRows={4}
                  autosize
                  name="message"
                  variant="filled"
                  {...form.getInputProps('message')}
                  disabled={isPending || isSuccess || !canSubmit}
                />

                <Group mt="md" justify="center">
                  <Button
                    type="submit"
                    size="md"
                    disabled={
                      !form.isValid() || isPending || isSuccess || !canSubmit
                    }
                    variant="outline"
                    color="gray"
                    loading={isPending}
                  >
                    Submit Feedback
                  </Button>
                </Group>

                {!canSubmit && lastSubmissionTime && (
                  <Text size="xs" c="dimmed" mt="xs" ta="center">
                    You can submit feedback again in{' '}
                    {Math.ceil(
                      (30000 - (Date.now() - lastSubmissionTime)) / 1000,
                    )}{' '}
                    seconds.
                  </Text>
                )}
              </form>
            </div>
          ),
        },
      ]}
    />
  );
};

export default SidebarFeedback;
