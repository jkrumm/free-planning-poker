import { Button, Group, Text, TextInput, Title } from '@mantine/core';

import { IconArrowBadgeRightFilled } from '@tabler/icons-react';

const IndexFormSkeleton = () => {
  return (
    <>
      <div className="mb-14 text-center">
        <Title order={2} className="mb-4">
          Estimate your Story Points fast
        </Title>
        <Title order={3} className="font-normal opacity-70">
          Say goodbye to complicated planning poker tools and estimate in
          seconds with this user-friendly app.
          <br />
          No signups, open source and privacy focused.
        </Title>
      </div>
      <Group className="mb-16 md:flex">
        <Button
          color="#1971C2"
          size="xl"
          className={`left-0 mx-auto block w-[300px] bg-[linear-gradient(110deg,#2e2e2e,45%,#272727,55%,#2e2e2e)] border-[1px] border-solid border-[#424242]`}
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
                  className={`join-room-input absolute my-4 w-[300px] rounded-md border-[0px] border-solid border-[#272727]`}
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
      <div className="mb-3 text-center">
        <Title order={4} className="mb-0">
          Loved by Agile Teams Worldwide
        </Title>
        <div className="grid grid-cols-2 gap-6">
          <div className="p-4">
            <Text fz="sm" tt="uppercase" fw={700} c="dimmed">
              USERS
            </Text>
            <Text fz="lg" fw={500} className="mono">
              6000
            </Text>
          </div>
          <div className="p-4">
            <Text fz="sm" tt="uppercase" fw={700} c="dimmed">
              ESTIMATIONS
            </Text>
            <Text fz="lg" fw={500} className="mono">
              30000
            </Text>
          </div>
        </div>
      </div>
    </>
  );
};

export default IndexFormSkeleton;
