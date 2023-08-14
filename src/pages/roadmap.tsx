import React from "react";
import { api } from "fpp/utils/api";
import { useTrackPageView } from "fpp/hooks/use-tracking.hook";
import { Card, Collapse, Group, SimpleGrid, Text, Title } from "@mantine/core";
import { RouteType } from "@prisma/client";
import { createServerSideHelpers } from "@trpc/react-query/server";
import { appRouter } from "fpp/server/api/root";
import { createTRPCContext } from "fpp/server/api/trpc";
import { type CreateNextContextOptions } from "@trpc/server/adapters/next";
import { Meta } from "fpp/components/meta";
import { Hero } from "fpp/components/layout/hero";
import { type Todo } from "fpp/server/api/routers/roadmap";
import { useDisclosure } from "@mantine/hooks";
import { IconArrowBadgeDownFilled } from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import superjson from "superjson";

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
    // TODO: sentry
    return <div>Loading...</div>;
  }

  return (
    <>
      <Meta title="Roadmap" />
      <Hero />
      <main className="flex flex-col items-center justify-center">
        <div className="container max-w-[1200px] gap-12 px-4 pb-28 pt-8">
          <SimpleGrid
            cols={3}
            breakpoints={[{ maxWidth: "md", cols: 1 }]}
            spacing="xl"
          >
            <RoadmapSection title="Todo" todos={roadmap.todo} />
            <RoadmapSection title="In Progess" todos={roadmap.inProgress} />
            <RoadmapSection title="Done" todos={roadmap.done} />
          </SimpleGrid>
        </div>
      </main>
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
        <RoadmapCard
          title={todo.title}
          description={todo.description}
          key={index}
        />
      ))}
    </div>
  );
};

const RoadmapCard = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => {
  const [opened, { toggle }] = useDisclosure(false);

  return (
    <Card p={0} withBorder radius="sm" className="mb-3">
      {description === "" ? (
        <div className="p-2">
          <Text>{title}</Text>
        </div>
      ) : (
        <>
          <Card.Section
            inheritPadding
            withBorder={opened}
            className="border-t-0 px-6 py-2"
            onClick={toggle}
          >
            <Group noWrap position="apart">
              <Text>{title}</Text>
              <IconArrowBadgeDownFilled
                size={26}
                style={{
                  opacity: 0.5,
                  transition: "transform 300ms ease",
                  transform: opened ? "rotate(180deg)" : "rotate(0)",
                }}
              />
            </Group>
          </Card.Section>
          <Collapse in={opened} transitionDuration={300}>
            <Card.Section className="px-6 py-2">
              <Text
                fz="sm"
                className="overflow-auto rounded-lg border border-[#141517] bg-[#212529] p-3"
              >
                <ReactMarkdown className="react-markdown">
                  {description}
                </ReactMarkdown>
              </Text>
            </Card.Section>
          </Collapse>
        </>
      )}
    </Card>
  );
};

export default Roadmap;
