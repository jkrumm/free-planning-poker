import React from 'react';

import { Button, Group, Text, TextInput, Title } from '@mantine/core';

import { IconArrowBadgeRightFilled } from '@tabler/icons-react';

const IndexFormSkeleton = () => {
  return (
    <>
      <div className="mb-10 text-center opacity-0">
        <Title order={2}>Estimate your Story Points fast</Title>
        <Title order={3} className="mt-5 font-normal opacity-70">
          Say goodbye to complicated planning poker tools and estimate in
          seconds with this user-friendly app.
          <br />
          No signups, open source and privacy focused.
        </Title>
      </div>
      <Group className="mb-8 hidden md:flex opacity-0">
        <Button
          color="#1971C2"
          size="xl"
          className={`left-0 mx-auto my-8 block w-[300px]`}
          type="button"
          role="button"
          aria-label="Start Planning"
        >
          Start Planning
        </Button>
        <form className="pl-8">
          <div className="mx-auto">
            <div className="w-full">
              <Group className="relative w-[300px] flex-nowrap" gap="0">
                <TextInput
                  placeholder="Join room"
                  className={`absolute my-4 w-[300px] rounded-md border-[2px] border-solid border-[#1971C2]`}
                  size="xl"
                />
                <Button
                  role="button"
                  aria-label="Join room"
                  size="xl"
                  className={`only-right-rounded absolute right-0 mr-[3px] h-[58px] px-4`}
                  type="submit"
                  disabled={true}
                >
                  <IconArrowBadgeRightFilled size={35} spacing={0} />
                </Button>
              </Group>
            </div>
          </div>
        </form>
      </Group>
      <div className="mb-6 text-center opacity-0">
        <Title order={4} className="text-neutral-300">
          Loved by Agile Teams Worldwide
        </Title>
        <div className="grid grid-cols-2 gap-6">
          <div className="p-4">
            <Text fz="sm" tt="uppercase" fw={700} c="dimmed">
              USERS
            </Text>
            <Text fz="lg" fw={500}>
              3500
            </Text>
          </div>
          <div className="p-4">
            <Text fz="sm" tt="uppercase" fw={700} c="dimmed">
              ESTIMATIONS
            </Text>
            <Text fz="lg" fw={500}>
              17000
            </Text>
          </div>
        </div>
      </div>
    </>
  );
};

export default IndexFormSkeleton;
