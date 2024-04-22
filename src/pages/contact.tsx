import React from 'react';

import { type NextPage } from 'next';

import {
  Alert,
  Button,
  Group,
  SimpleGrid,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';

import { IconAlertCircle } from '@tabler/icons-react';

import { api } from 'fpp/utils/api';
import { sendTrackEvent } from 'fpp/utils/send-track-event.util';

import { useConfigStore } from 'fpp/store/config.store';
import { useLocalstorageStore } from 'fpp/store/local-storage.store';

import { EventType, FeatureFlagType, RouteType } from 'fpp/server/db/schema';

import { useTrackPageView } from 'fpp/hooks/use-tracking.hook';

import { Hero } from 'fpp/components/layout/hero';
import { Meta } from 'fpp/components/meta';

const Contact: NextPage = () => {
  useTrackPageView(RouteType.CONTACT);

  const activeFeatureFlags = useConfigStore(
    (state) => state.activeFeatureFlags,
  );

  const username = useLocalstorageStore((state) => state.username);
  const userId = useLocalstorageStore((state) => state.userId);

  const sendMail = api.contact.sendMail.useMutation();

  const form = useForm({
    initialValues: {
      name: username ?? '',
      email: '',
      subject: '',
      message: '',
    },
    validate: {
      name: (value) => value.trim().length > 40,
      email: (value) =>
        value.trim().length !== 0 &&
        (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(value) ||
          value.trim().length > 60),
      subject: (value) => value.trim().length < 3 || value.trim().length > 100,
      message: (value) => value.trim().length > 800,
    },
  });

  return (
    <>
      <Meta title="Contact" />
      <Hero />
      <main className="flex flex-col items-center justify-center">
        <div className="container flex items-center justify-center gap-12 px-4 pb-28 pt-8">
          <form
            className="w-[800px]"
            onSubmit={form.onSubmit(() => {
              sendMail.mutate(form.values, {
                onSuccess: () => {
                  notifications.show({
                    title: 'Email sent',
                    color: 'green',
                    message:
                      'Thank you for your message, we will get back to you as soon as possible',
                  });
                },
                onError: () => {
                  notifications.show({
                    title: 'Email not sent',
                    color: 'red',
                    message: 'Something went wrong, please try again later',
                  });
                },
              });
              sendTrackEvent({
                event: EventType.CONTACT_FORM_SUBMISSION,
                userId,
              });
            })}
          >
            <SimpleGrid
              cols={{
                xs: 1,
                sm: 2,
              }}
              mt="xl"
            >
              <TextInput
                label="Name"
                placeholder="Your name"
                name="name"
                variant="filled"
                {...form.getInputProps('name')}
                disabled={sendMail.isSuccess}
              />
              <TextInput
                label="Email"
                placeholder="Your email"
                name="email"
                variant="filled"
                {...form.getInputProps('email')}
                disabled={sendMail.isSuccess}
              />
            </SimpleGrid>

            <TextInput
              label="Subject"
              placeholder="Subject"
              mt="md"
              name="subject"
              variant="filled"
              {...form.getInputProps('subject')}
              disabled={sendMail.isSuccess}
            />
            <Textarea
              mt="md"
              label="Message"
              placeholder="Your message"
              maxRows={10}
              minRows={5}
              autosize
              name="message"
              variant="filled"
              {...form.getInputProps('message')}
              disabled={sendMail.isSuccess}
            />

            {!activeFeatureFlags.includes(FeatureFlagType.CONTACT_FORM) && (
              <Alert
                icon={<IconAlertCircle size="1rem" />}
                title="Contact form disabled"
                color="orange"
                variant="outline"
                className="mx-auto my-8 w-1/2"
              >
                <Text>
                  The contact form is currently disabled by a feature flag.
                  Please try again later.
                </Text>
              </Alert>
            )}

            <Group mt="xl" justify="center">
              <Button
                type="submit"
                size="md"
                disabled={
                  sendMail.isSuccess ||
                  !activeFeatureFlags.includes(FeatureFlagType.CONTACT_FORM)
                }
              >
                Send message
              </Button>
            </Group>
          </form>
        </div>
      </main>
    </>
  );
};

export default Contact;
