import { type NextPage } from "next";
import Head from "next/head";
import React from "react";
import { Hero } from "fpp/components/hero";
import { Button, Group, SimpleGrid, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { getUsername } from "fpp/store/local-storage";
import { api } from "fpp/utils/api";
import { log } from "fpp/utils/console-log";
import { notifications } from "@mantine/notifications";

const Contact: NextPage = () => {
  const sendMail = api.contact.sendMail.useMutation();

  const form = useForm({
    initialValues: {
      name: getUsername() ?? "",
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
      <Head>
        <title>Planning Poker - Contact</title>
        <meta
          name="description"
          content="Estimate your story points faster and easier with this free agile scrum sprint planning poker app. Open source and privacy focused."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <meta property="og:title" content="Free Planning Poker" />
        <meta
          property="og:description"
          content="Estimate your story points faster and easier with this free agile scrum sprint planning poker app. Open source and privacy focused."
        />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:url" content="https://free-planning-poker.com/" />
        <meta
          property="og:image"
          content="https://free-planning-poker.com/free-planning-poker.jpg"
        />
        <meta
          property="og:image:secure_url"
          content="https://free-planning-poker.com/free-planning-poker.jpg"
        />
        <meta property="og:image:type" content="image/jpg" />
        <meta property="og:image:width" content="1034" />
        <meta property="og:image:height" content="612" />
        <meta property="og:image:alt" content="Free Planning Poker" />
        <meta charSet="utf-8" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#1971c2" />
        <meta name="msapplication-TileColor" content="#1a1b1e" />
        <meta name="theme-color" content="#1a1b1e" />
      </Head>
      <Hero />
      <main className="flex flex-col items-center justify-center">
        <div className="container flex items-center justify-center gap-12 px-4 pb-28 pt-12">
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
