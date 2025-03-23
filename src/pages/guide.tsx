import { type NextPage } from 'next';

import { Text, Title } from '@mantine/core';

import { RouteType } from 'fpp/server/db/schema';

import { useTrackPageView } from 'fpp/hooks/use-tracking.hook';

import PointsTable from 'fpp/components/index/points-table';
import Footer from 'fpp/components/layout/footer';
import { Hero } from 'fpp/components/layout/hero';
import Navbar from 'fpp/components/layout/navbar';
import { Meta } from 'fpp/components/meta';

const Guide: NextPage = () => {
  useTrackPageView(RouteType.GUIDE);

  return (
    <>
      <Meta title="Guide" />
      <Navbar />
      <Hero />
      <main>
        <div className="container mx-auto max-w-[1200px] px-4 sm:px-6 md:px-4 pb-12 pt-8">
          <article id="master-the-art-of-planning-poker">
            <header>
              <Title order={2} className="text-center">
                Master the Art of Planning Poker: An Agile Approach to
                Estimation
              </Title>
            </header>
            <section className="mx-auto block max-w-[700px] text-justify">
              <Title order={3}>TL;DR</Title>
              <Text component="p">
                Discover how Planning Poker, an Agile estimation technique,
                helps teams efficiently plan sprints using story points. Learn
                about its process, the role of the Fibonacci sequence, and the
                benefits of anonymity and gamification in achieving accurate
                task estimations.
              </Text>

              <Title order={3}>The Essence of Planning Poker</Title>
              <Text component="p">
                Agile methodologies like <b>Scrum, Kanban, and Jira</b>{' '}
                emphasize iterative development and effective task estimation.{' '}
                Planning Poker is a widely used technique that combines
                <b>team collaboration, game mechanics</b>, and the Fibonacci
                sequence to achieve precise workload estimates.
              </Text>

              <Title order={4}>Why Sprint Planning Matters</Title>
              <Text component="p">
                Effective sprint planning ensures productive use of team
                resources over time. Story points are crucial as they provide a
                way to measure{' '}
                <b>team capacity, plan upcoming sprints, and track progress</b>.
                They enable tools like Velocity and Burndown charts, helping in
                comparing team performance and enhancing overall productivity.
              </Text>

              <Title order={4}>How Planning Poker Works</Title>
              <Text component="p">
                In Planning Poker, tasks are assigned <b>Fibonacci numbers</b>{' '}
                (1, 2, 3, 5, 8, 13, 21) to estimate their complexity and time
                requirements. This sequence mirrors the uncertainty and risk
                associated with task estimation. Transforming abstract
                complexity into numerical values is useful for prioritizing
                backlog items and rationalizing efforts.
              </Text>

              <Title order={3}>The Power of Anonymity and Gamification</Title>
              <Text component="p">
                In Planning Poker, team members vote anonymously, which enhances
                objectivity and promotes a <b>diversity of viewpoints</b>. The
                integration of gamification increases engagement and ensures
                that task estimates are <b>unbiased</b> and accurate.
              </Text>

              <Title order={3}>
                Interpreting Estimations and Splitting Tasks
              </Title>
              <Text component="p">
                Once votes are revealed, the highest and lowest estimators
                explain their reasoning, providing valuable insights into task
                complexities. Tasks estimated at 13 points or more are typically
                split into smaller,{' '}
                <b>
                  more manageable tasks to prevent sprint overload and improve
                  visibility
                </b>
                .
              </Text>

              <Title order={3}>Insights from Voting Metrics</Title>
              <Text component="p">
                Key metrics like minimum, maximum, average, and vote count offer
                valuable insights. A higher average often suggests that teams
                prefer conservative estimates, helping cushion against
                unforeseen complexities and ensuring timely sprint completion.
              </Text>
            </section>

            <section className="my-[80px]">
              <Title order={3} className="mb-[30px]">
                Fibonacci Sequence for Task Estimation: A Quick Guide
              </Title>
              <PointsTable />
            </section>

            <footer className="mx-auto my-[30px] max-w-[700px] text-center">
              <Text component="p" size="lg">
                Embrace collective intelligence, gamification, and the Fibonacci
                sequence with Planning Poker to set your Agile projects on the
                path to success.
              </Text>
            </footer>
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default Guide;
