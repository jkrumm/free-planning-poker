import { Suspense } from 'react';

import dynamic from 'next/dynamic';
import Link from 'next/link';

import { createServerSideHelpers } from '@trpc/react-query/server';
import type { CreateNextContextOptions } from '@trpc/server/adapters/next';

import {
  Button,
  Card,
  Collapse,
  Group,
  List,
  SimpleGrid,
  Text,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

import * as Sentry from '@sentry/nextjs';
import {
  IconArrowBadgeDownFilled,
  IconSquare,
  IconSquareCheck,
} from '@tabler/icons-react';
import superjson from 'superjson';

import { logMsg } from 'fpp/constants/logging.constant';

import { api } from 'fpp/utils/api';

import { appRouter } from 'fpp/server/api/root';
import { type Todo } from 'fpp/server/api/routers/roadmap.router';
import { createTRPCContext } from 'fpp/server/api/trpc';
import { RouteType } from 'fpp/server/db/schema';

import { useTrackPageView } from 'fpp/hooks/use-tracking.hook';

import Footer from 'fpp/components/layout/footer';
import { Hero } from 'fpp/components/layout/hero';
import Navbar from 'fpp/components/layout/navbar';
import { Meta } from 'fpp/components/meta';

export const getStaticProps = async (context: CreateNextContextOptions) => {
  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx: createTRPCContext(context),
    transformer: superjson,
  });

  await helpers.roadmap.getRoadmap.prefetch(undefined);

  return {
    props: { trpcState: helpers.dehydrate() },
    revalidate: 3600,
  };
};

const Roadmap = () => {
  useTrackPageView(RouteType.ROADMAP);

  const { data: roadmap } = api.roadmap.getRoadmap.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  if (!roadmap) {
    Sentry.captureException(new Error(logMsg.SSG_FAILED));
    return <div>Loading...</div>;
  }

  return (
    <>
      <Meta title="Roadmap" />
      <Navbar />
      <Hero />
      <main className="flex flex-col items-center justify-center">
        <section className="container max-w-[800px] gap-12 px-4 mt-6 mb-8">
          <Text className="mb-4">
            As I am working on this project on my own for now, I have only
            created a Wunderlist board to keep track of the tasks I want to
            implement. Below you can see the current state.
          </Text>
          <Text className="mb-4">
            Free Planning Poker is an open-source project, and I am always happy
            to receive contributions from the users of this app. If you want to
            help, feel free reach out to me or to create a pull request on
            GitHub.
          </Text>
          <Text className="mb-6">
            If you have any feature suggestions or want to report a bug, feel
            free to use the contact form or create an issue on GitHub.
          </Text>
          <Group className="w-full justify-center gap-4">
            <Link href="/contact">
              <Button variant="outline" color="gray">
                Contact
              </Button>
            </Link>
            <a
              href="https://github.com/jkrumm/free-planning-poker/issues/new"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" color="gray">
                Create GitHub Issue
              </Button>
            </a>
          </Group>
        </section>
        <section className="container max-w-[1400px] gap-12 px-4 mb-28 mt-10">
          <SimpleGrid
            cols={{
              sm: 1,
              md: 3,
            }}
            spacing="xl"
          >
            <RoadmapSection title="Todo" todos={roadmap.todo} />
            <RoadmapSection title="In Progess" todos={roadmap.inProgress} />
            <RoadmapSection title="Done" todos={roadmap.done} />
          </SimpleGrid>
        </section>
      </main>
      <Footer />
    </>
  );
};

const RoadmapSection = ({ title, todos }: { title: string; todos: Todo[] }) => {
  return (
    <div>
      <Title order={2} className="mb-4 pl-1">
        {title}
      </Title>
      {todos.map((todo, index) => (
        <RoadmapCard todo={todo} key={index} />
      ))}
    </div>
  );
};

const Markdown = dynamic(() => import('fpp/components/markdown'), {
  ssr: false,
});

const RoadmapCard = ({ todo }: { todo: Todo }) => {
  const { title, description, subtasks } = todo;
  const [opened, { toggle }] = useDisclosure(false);

  return (
    <Card p={0} withBorder radius="sm" className="mb-3">
      {!description && subtasks.length === 0 ? (
        <div className="p-2">
          <Text>{title}</Text>
        </div>
      ) : (
        <>
          <Card.Section
            inheritPadding
            withBorder={opened}
            className="border-t-0 p-2 m-0 cursor-pointer"
            onClick={toggle}
          >
            <Group className="flex-nowrap">
              <IconArrowBadgeDownFilled
                size={26}
                style={{
                  opacity: 0.5,
                  transition: 'transform 300ms ease',
                  transform: opened ? 'rotate(180deg)' : 'rotate(0)',
                }}
              />
              <Text>{title}</Text>
            </Group>
          </Card.Section>
          <Collapse in={opened} transitionDuration={300}>
            <Card.Section className="p-6 py-4">
              {subtasks.length > 0 && (
                <div className="my-2">
                  <Title order={4} size="sm">
                    Subtasks
                  </Title>
                  <List className="pr-5 roadmap-list">
                    {subtasks.map((subtask, index) => (
                      <List.Item
                        key={index}
                        icon={
                          subtask.done ? <IconSquareCheck /> : <IconSquare />
                        }
                        className="my-3"
                      >
                        <Text fz="md" className="mb-1">
                          {subtask.title}
                        </Text>
                        {subtask.description && (
                          <Text fz="sm" className="overflow-auto rounded-lg">
                            <Suspense fallback={<p>{subtask.description}</p>}>
                              <Markdown description={subtask.description} />
                            </Suspense>
                          </Text>
                        )}
                      </List.Item>
                    ))}
                  </List>
                </div>
              )}
              {description && (
                <div className="my-2">
                  {subtasks.length > 0 && (
                    <Title order={3} size="sm">
                      Description
                    </Title>
                  )}
                  <Text fz="sm" className="overflow-auto rounded-lg p-2">
                    <Suspense fallback={<p>{description}</p>}>
                      <Markdown description={description} />
                    </Suspense>
                  </Text>
                </div>
              )}
            </Card.Section>
          </Collapse>
        </>
      )}
    </Card>
  );
};

export default Roadmap;
