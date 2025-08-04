import { useState } from 'react';

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
import { addBreadcrumb, captureError } from 'fpp/utils/app-error';
import { sendTrackEvent } from 'fpp/utils/send-track-event.util';

import { useConfigStore } from 'fpp/store/config.store';
import { useLocalstorageStore } from 'fpp/store/local-storage.store';

import { EventType, FeatureFlagType, RouteType } from 'fpp/server/db/schema';

import { useTrackPageView } from 'fpp/hooks/use-tracking.hook';

import Footer from 'fpp/components/layout/footer';
import { Hero } from 'fpp/components/layout/hero';
import Navbar from 'fpp/components/layout/navbar';
import { Meta } from 'fpp/components/meta';

const Contact: NextPage = () => {
  const [hasInitialized, setHasInitialized] = useState(false);

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
      name: (value) => {
        try {
          return value.trim().length > 50;
        } catch (error) {
          captureError(
            error instanceof Error
              ? error
              : new Error('Name validation failed'),
            {
              component: 'Contact',
              action: 'validateName',
              extra: {
                value:
                  typeof value === 'string'
                    ? value.substring(0, 20)
                    : 'invalid',
              },
            },
            'low',
          );
          return true; // Allow submission if validation fails
        }
      },
      email: (value) => {
        try {
          const trimmed = value.trim();
          return (
            trimmed.length !== 0 &&
            (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(trimmed) ||
              trimmed.length > 70)
          );
        } catch (error) {
          captureError(
            error instanceof Error
              ? error
              : new Error('Email validation failed'),
            {
              component: 'Contact',
              action: 'validateEmail',
              extra: { hasValue: !!value },
            },
            'low',
          );
          return true; // Allow submission if validation fails
        }
      },
      subject: (value) => {
        try {
          const trimmed = value.trim();
          return trimmed.length < 3 || trimmed.length > 100;
        } catch (error) {
          captureError(
            error instanceof Error
              ? error
              : new Error('Subject validation failed'),
            {
              component: 'Contact',
              action: 'validateSubject',
              extra: { hasValue: !!value },
            },
            'low',
          );
          return true; // Allow submission if validation fails
        }
      },
      message: (value) => {
        try {
          return value.trim().length > 800;
        } catch (error) {
          captureError(
            error instanceof Error
              ? error
              : new Error('Message validation failed'),
            {
              component: 'Contact',
              action: 'validateMessage',
              extra: { hasValue: !!value },
            },
            'low',
          );
          return true; // Allow submission if validation fails
        }
      },
    },
  });

  const handleFormSubmit = () => {
    try {
      addBreadcrumb('Contact form submission started', 'form', {
        hasName: !!form.values.name,
        hasEmail: !!form.values.email,
        hasSubject: !!form.values.subject,
        hasMessage: !!form.values.message,
      });

      sendMail.mutate(form.values, {
        onSuccess: () => {
          try {
            notifications.show({
              title: 'Email sent',
              color: 'green',
              message:
                'Thank you for your message, we will get back to you as soon as possible',
            });
            addBreadcrumb('Contact form submission successful', 'form');
            form.reset();
          } catch (error) {
            captureError(
              error instanceof Error
                ? error
                : new Error('Failed to show success notification'),
              {
                component: 'Contact',
                action: 'handleSuccess',
              },
              'low',
            );
          }
        },
        onError: (error) => {
          try {
            captureError(
              error instanceof Error
                ? error
                : new Error('Contact form submission failed'),
              {
                component: 'Contact',
                action: 'submitForm',
                extra: {
                  hasName: !!form.values.name,
                  hasEmail: !!form.values.email,
                  hasSubject: !!form.values.subject,
                  messageLength: form.values.message.length,
                },
              },
              'medium',
            );

            notifications.show({
              title: 'Email not sent',
              color: 'red',
              message: 'Something went wrong, please try again later',
            });
          } catch (notificationError) {
            captureError(
              notificationError instanceof Error
                ? notificationError
                : new Error('Failed to show error notification'),
              {
                component: 'Contact',
                action: 'handleError',
              },
              'low',
            );
          }
        },
      });

      // Track form submission
      try {
        sendTrackEvent({
          event: EventType.CONTACT_FORM_SUBMISSION,
          userId,
        });
      } catch (trackingError) {
        captureError(
          trackingError instanceof Error
            ? trackingError
            : new Error('Failed to track contact form submission'),
          {
            component: 'Contact',
            action: 'trackSubmission',
            extra: { userId },
          },
          'low',
        );
      }
    } catch (error) {
      captureError(
        error instanceof Error
          ? error
          : new Error('Failed to handle contact form submission'),
        {
          component: 'Contact',
          action: 'handleFormSubmit',
        },
        'medium',
      );
    }
  };

  // Track page initialization
  if (!hasInitialized) {
    try {
      addBreadcrumb('Contact page initialized', 'page', {
        hasUsername: !!username,
        hasUserId: !!userId,
        contactFormEnabled: activeFeatureFlags.includes(
          FeatureFlagType.CONTACT_FORM,
        ),
      });
      setHasInitialized(true);
    } catch (error) {
      captureError(
        error instanceof Error
          ? error
          : new Error('Failed to initialize contact page'),
        {
          component: 'Contact',
          action: 'initialize',
        },
        'low',
      );
    }
  }

  const isContactFormEnabled = activeFeatureFlags.includes(
    FeatureFlagType.CONTACT_FORM,
  );

  return (
    <>
      <Meta title="Contact" />
      <Navbar />
      <Hero />
      <main className="flex flex-col items-center justify-center">
        <section className="container max-w-[800px] gap-12 px-4 mt-6 mb-6 md:mb-8">
          <Text className="mb-4">
            Do you have any questions, suggestions, or feedback? I would love to
            hear from you!
          </Text>
          <Text className="mb-4">
            Free Planning Poker is an open-source project, and I would be happy
            to receive contributions from the community. If you want to help,
            feel free reach out to me or to create a issue on GitHub.
          </Text>
          <a
            href="https://github.com/jkrumm/free-planning-poker/issues/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" color="gray">
              Create GitHub Issue
            </Button>
          </a>
        </section>
        <section className="container flex items-center justify-center max-w-[800px] w-full gap-12 px-4 mb-10 md:mb-20">
          <form
            className="w-full max-w-[800px] mt-3 mb-8"
            onSubmit={form.onSubmit(handleFormSubmit)}
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
                disabled={sendMail.isSuccess || sendMail.isPending}
              />
              <TextInput
                label="Email"
                placeholder="Your email"
                name="email"
                variant="filled"
                {...form.getInputProps('email')}
                disabled={sendMail.isSuccess || sendMail.isPending}
              />
            </SimpleGrid>

            <TextInput
              label="Subject"
              placeholder="Subject"
              mt="md"
              name="subject"
              variant="filled"
              {...form.getInputProps('subject')}
              disabled={sendMail.isSuccess || sendMail.isPending}
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
              disabled={sendMail.isSuccess || sendMail.isPending}
            />

            {!isContactFormEnabled && (
              <Alert
                icon={<IconAlertCircle size="1rem" />}
                title="Contact form disabled"
                color="orange"
                variant="outline"
                className="mx-auto my-8 w-full max-w-md"
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
                  sendMail.isPending ||
                  !isContactFormEnabled
                }
                variant="outline"
                color="gray"
                loading={sendMail.isPending}
              >
                Send message
              </Button>
            </Group>
          </form>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default Contact;
