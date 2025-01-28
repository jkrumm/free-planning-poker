import React from 'react';

import { Button, Group, TextInput } from '@mantine/core';

import { IconArrowBadgeRightFilled } from '@tabler/icons-react';

const IndexFormSkeleton = () => {
  return (
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
  );
};

export default IndexFormSkeleton;
