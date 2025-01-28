import React from 'react';

import { type NextPage } from 'next';
import dynamic from 'next/dynamic';
import Image from 'next/image';

import { Alert, Text, Title } from '@mantine/core';

import { IconAlertCircle } from '@tabler/icons-react';

import { RouteType } from 'fpp/server/db/schema';

import { useTrackPageView } from 'fpp/hooks/use-tracking.hook';

import Contact from 'fpp/components/index/contact';
import Features from 'fpp/components/index/features';
import IndexFormSkeleton from 'fpp/components/index/form-skeleton';
import Privacy from 'fpp/components/index/privacy';
import { Hero } from 'fpp/components/layout/hero';
import Navbar from 'fpp/components/layout/navbar';
import { Meta } from 'fpp/components/meta';

const IndexForm = dynamic(() => import('fpp/components/index/form'), {
  ssr: false,
  loading: () => <IndexFormSkeleton />,
});

const Home: NextPage = () => {
  useTrackPageView(RouteType.HOME);

  return (
    <div className="homepage">
      <Meta />
      <Navbar animate />
      <Hero />
      <main className="flex flex-col items-center justify-center p-6">
        {/* TODO: Use Spotlight https://ui.aceternity.com/components/spotlight-new */}
        <div className="gradients"></div>
        <IndexForm />
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
          <section
            id="screenshot"
            className="opacity-0 animate-fadeIn"
            style={{ animationDelay: `2000ms` }}
          >
            <Image
              src="/images/fpp_screenshot.png"
              width={2852 / 2.5}
              height={1586 / 2.5}
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
