import React, { useState } from 'react';

import { env } from 'fpp/env';

import { Button, Text, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';

import { FEEDBACK_LIMITS } from '@fpp/shared';

import { recordError } from 'fpp/utils/app-error';

import SidebarContent from 'fpp/components/sidebar/sidebar-content';

type Status =
  { kind: 'idle' } | { kind: 'sent' } | { kind: 'error'; message: string };

const SidebarFeedback = () => {
  return (
    <SidebarContent
      childrens={[
        {
          title: 'Feedback',
          content: <FeedbackForm />,
        },
      ]}
    />
  );
};

const FeedbackForm = () => {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [isSending, setIsSending] = useState(false);

  const form = useForm({
    initialValues: { title: '', text: '' },
    validate: {
      title: (value) =>
        value.trim().length === 0
          ? 'Tell us what is wrong or missing'
          : value.length > FEEDBACK_LIMITS.TITLE_MAX
            ? `At most ${FEEDBACK_LIMITS.TITLE_MAX} characters`
            : null,
      text: (value) =>
        value.length > FEEDBACK_LIMITS.TEXT_MAX
          ? `At most ${FEEDBACK_LIMITS.TEXT_MAX} characters`
          : null,
    },
  });

  const handleSubmit = async (values: { title: string; text: string }) => {
    setIsSending(true);
    setStatus({ kind: 'idle' });
    try {
      // Match page protocol so https-served local dev (via Caddy) works.
      const scheme = window.location.protocol === 'https:' ? 'https' : 'http';
      const response = await fetch(
        `${scheme}://${env.NEXT_PUBLIC_FPP_SERVER_URL}/feedback`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: values.title.trim(),
            ...(values.text.trim() && { text: values.text.trim() }),
            version: env.NEXT_PUBLIC_APP_VERSION,
            route: window.location.pathname.slice(0, FEEDBACK_LIMITS.ROUTE_MAX),
          }),
        },
      );
      if (response.status === 429) {
        setStatus({
          kind: 'error',
          message: 'Too many submissions. Please try again later.',
        });
        return;
      }
      if (!response.ok) {
        throw new Error(`Feedback request failed (${response.status})`);
      }
      form.reset();
      setStatus({ kind: 'sent' });
    } catch (error) {
      recordError(error as Error, {
        component: 'FeedbackForm',
        action: 'submit',
      });
      setStatus({
        kind: 'error',
        message: 'Could not send your feedback. Please try again later.',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form
      className="text-left w-full"
      onSubmit={form.onSubmit(handleSubmit)}
      noValidate
    >
      <Text size="sm" className="mb-2">
        Found a bug or have an idea? Tell us. You can also open an issue on{' '}
        <a
          href="https://github.com/jkrumm/free-planning-poker/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        .
      </Text>
      <TextInput
        label="What happened?"
        placeholder="One line summary"
        maxLength={FEEDBACK_LIMITS.TITLE_MAX}
        {...form.getInputProps('title')}
      />
      <Textarea
        mt="xs"
        label="Details (optional)"
        autosize
        minRows={3}
        maxRows={8}
        maxLength={FEEDBACK_LIMITS.TEXT_MAX}
        {...form.getInputProps('text')}
      />
      <Button type="submit" mt="sm" fullWidth loading={isSending}>
        Send feedback
      </Button>
      {status.kind === 'sent' && (
        <Text size="sm" c="green" mt="xs" role="status">
          Thanks, your feedback was sent.
        </Text>
      )}
      {status.kind === 'error' && (
        <Text size="sm" c="red" mt="xs" role="alert">
          {status.message}
        </Text>
      )}
    </form>
  );
};

export default SidebarFeedback;
