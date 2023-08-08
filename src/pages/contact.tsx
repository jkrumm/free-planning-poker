import { type NextPage } from "next";
import React from "react";
import { Hero } from "fpp/components/layout/hero";
import { Button, Group, SimpleGrid, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { api } from "fpp/utils/api";
import { log } from "fpp/utils/console-log";
import { notifications } from "@mantine/notifications";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import {
  type TrackPageViewMutation,
  useTrackPageView,
} from "fpp/utils/use-tracking.hooks";
import { RouteType } from "@prisma/client";
import { EventType } from ".prisma/client";
import { Meta } from "fpp/components/meta";

const Contact: NextPage = () => {
  const username = useLocalstorageStore((state) => state.username);

  const visitorId = useLocalstorageStore((state) => state.visitorId);
  const trackPageViewMutation = api.tracking.trackPageView.useMutation()
    .mutate as TrackPageViewMutation;
  useTrackPageView(RouteType.CONTACT, trackPageViewMutation);
  const sendEvent = api.tracking.trackEvent.useMutation();

  const sendMail = api.contact.sendMail.useMutation();

  const form = useForm({
    initialValues: {
      name: username ?? "",
      email: "",
      subject: "",
      message: "",
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
              log("SEND EMAIL", form.values);
              sendMail.mutate(form.values, {
                onSuccess: () => {
                  notifications.show({
                    title: "Email sent",
                    color: "green",
                    message:
                      "Thank you for your message, we will get back to you as soon as possible",
                  });
                },
                onError: () => {
                  notifications.show({
                    title: "Email not sent",
                    color: "red",
                    message: "Something went wrong, please try again later",
                  });
                },
              });
              sendEvent.mutate({
                visitorId,
                type: EventType.CONTACT_FORM_SUBMISSION,
              });
            })}
          >
            <SimpleGrid
              cols={2}
              mt="xl"
              breakpoints={[{ maxWidth: "sm", cols: 1 }]}
            >
              <TextInput
                label="Name"
                placeholder="Your name"
                name="name"
                variant="filled"
                {...form.getInputProps("name")}
                disabled={sendMail.isSuccess}
              />
              <TextInput
                label="Email"
                placeholder="Your email"
                name="email"
                variant="filled"
                {...form.getInputProps("email")}
                disabled={sendMail.isSuccess}
              />
            </SimpleGrid>

            <TextInput
              label="Subject"
              placeholder="Subject"
              mt="md"
              name="subject"
              variant="filled"
              {...form.getInputProps("subject")}
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
              {...form.getInputProps("message")}
              disabled={sendMail.isSuccess}
            />

            <Group position="center" mt="xl">
              <Button type="submit" size="md" disabled={sendMail.isSuccess}>
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
