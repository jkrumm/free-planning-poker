import React from 'react';

import Image from 'next/image';
import Link from 'next/link';

import { Button, Title } from '@mantine/core';

export const Features = () => {
  return (
    <section id="features" className="mt-20">
      <Title order={2} className="text-center">
        Powerful Yet Simple
      </Title>
      <Title order={3} className="mt-5 font-normal text-center opacity-70">
        Essential Features for Effective Sprint Planning
      </Title>
      <div className="feature-grid md:grid grid-cols-10 mt-12 grid-rows-6 gap-7">
        <div className="col-span-6 row-span-3 mb-8 md:mb-0">
          <div className="bg-[#242424] w-full rounded-t-md p-2">
            <Image
              src="/images/fpp_control.png"
              width={699 * 0.8}
              height={122 * 0.8}
              className="h-auto w-full rounded-t-md"
              alt="Picture of the controls in the planning poker app"
              placeholder="blur"
              blurDataURL={'/images/fpp_control.png'}
              priority={false}
            />
          </div>
          <div className="p-3">
            <p>
              <strong>Share Room URL</strong> - Click the room name to copy the
              URL.
            </p>
            <p>
              <strong>Room Reset</strong> - Reset all votes with a single tap.
            </p>
            <p>
              <strong>Spectator Mode</strong> - For those who are not involved
              in estimations.
            </p>
            <p>
              <strong>Auto Show</strong> - Automatically reveal estimations once
              everyone has voted.
            </p>
          </div>
        </div>
        <div className="col-span-4 row-span-7 col-start-7 mb-8 md:mb-0">
          <div className="bg-[#242424] w-full rounded-t-md p-2">
            <Image
              src="/images/fpp_room_stats.png"
              width={390 * 0.8}
              height={590 * 0.8}
              className="h-auto max-w-full mx-auto md:ml-auto block rounded-t-md"
              alt="Picture of the room stats in the planning poker app"
              placeholder="blur"
              blurDataURL={'/images/fpp_room_stats.png'}
              priority={false}
            />
          </div>
          <div className="p-3">
            <p>
              <strong>Voting analytics</strong> - Gain insights into
              participation, efficiency, and trends in your voting sessions. To
              improve your sprint planning in the future.
            </p>
          </div>
        </div>
        <div className="col-span-3 row-span-4 row-start-4 mb-8 md:mb-0">
          <div className="bg-[#242424] w-full rounded-t-md p-2">
            <Image
              src="/images/fpp_user_settings.png"
              width={390 * 0.8}
              height={590 * 0.8}
              className="h-auto max-w-full mx-auto block rounded-t-md"
              alt="Picture of the room stats in the planning poker app"
              placeholder="blur"
              blurDataURL={'/images/fpp_user_settings.png'}
              priority={false}
            />
          </div>
          <div className="p-3">
            <p>
              <strong>User Settings</strong> Change your username and toggle
              sounds and popup notifications.
            </p>
          </div>
        </div>
        <div className="col-span-3 row-span-4 col-start-4 row-start-4">
          <div className="roadmap" />
          <div className="p-3">
            <p>
              <strong>Roadmap</strong> - There is much more to come!
            </p>
            <Link href="/roadmap">
              <Button variant="default" fullWidth className="mt-4">
                Go to Roadmap
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;
