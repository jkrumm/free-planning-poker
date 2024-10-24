import React, { Suspense, lazy } from 'react';

import { type NextPage } from 'next';
import Image from 'next/image';

import { Alert, Text, Title } from '@mantine/core';

import { IconAlertCircle } from '@tabler/icons-react';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';

import { RouteType } from 'fpp/server/db/schema';

import { useTrackPageView } from 'fpp/hooks/use-tracking.hook';

import Contact from 'fpp/components/index/contact';
import Features from 'fpp/components/index/features';
import IndexFormSkeleton from 'fpp/components/index/form-skeleton';
import Privacy from 'fpp/components/index/privacy';
import { Hero } from 'fpp/components/layout/hero';
import Navbar from 'fpp/components/layout/navbar';
import { Meta } from 'fpp/components/meta';

const IndexForm = lazy(() => import('fpp/components/index/form'));

const Home: NextPage = () => {
  useTrackPageView(RouteType.HOME);
  const userId = useLocalstorageStore((state) => state.userId);

  return (
    <div className="homepage">
      <Meta />
      <Navbar />
      <Hero />
      <main className="flex flex-col items-center justify-center p-6">
        <div className="gradients"></div>
        <div className="mb-14 text-center">
          <Title order={2}>Estimate your Story Points Faster than ever</Title>
          <Title order={3} className="mt-5 font-normal opacity-70">
            Say goodbye to complicated planning poker tools and estimate in
            seconds with this user-friendly app.
            <br />
            No signups, open source and privacy focused.
          </Title>
        </div>
        <Suspense fallback={<IndexFormSkeleton />}>
          {userId ? <IndexForm /> : <IndexFormSkeleton />}
        </Suspense>
        <div className="mx-8 mb-10 md:hidden">
          <Alert
            icon={<IconAlertCircle size="1rem" />}
            title="Not supported on mobile devices"
            color="orange"
            variant="outline"
          >
            <Text>
              Free-Planning-Poker.com is not supported on mobile devices. Please
              use a larger device or increase the size of your browser window.
            </Text>
          </Alert>
        </div>
        <div className="gradient-image"></div>
        <div className="z-10 w-[1200px] max-w-full p-6">
          <section id="screenshot">
            <Image
              src="/images/fpp_screenshot.png"
              width={2852 / 2}
              height={1586 / 2}
              className="h-auto max-w-full rounded-lg border-4 border-solid border-[#2C2E33]"
              alt="Picture of the free planning poker app ui"
              placeholder="blur"
              blurDataURL={'/images/fpp_screenshot.png'}
              priority={true}
            />
          </section>
        </div>
        <div className="w-full max-w-[1050px] px-4">
          <Features />
          <Privacy />
          <Contact />
        </div>
      </main>
    </div>
  );
};

export default Home;
