import React from "react";
import { Button, Group, TextInput } from "@mantine/core";
import { IconArrowBadgeRightFilled } from "@tabler/icons-react";

const IndexFormSkeleton = () => {
  return (
    <div className="w-full px-4 pb-16">
      <Button
        variant="gradient"
        gradient={{ from: "blue", to: "cyan" }}
        size="xl"
        className={`mx-auto my-8 block md:w-[480px]`}
        type="button"
        role="button"
        aria-label="Join recent room"
        disabled={true}
      >
        Join recent room: &nbsp;
      </Button>
      <form className="mt-8 w-full">
        <div className="mx-auto max-w-[400px]">
          <div className="w-full">
            <TextInput label="Username" size="xl" disabled={true} />
            <Group className="flex-nowrap">
              <TextInput
                disabled={true}
                label="Room"
                // className={`${classes.buttonRight} my-6 w-full`}
                className={`my-6 w-full`}
                size="xl"
              />
              <Button
                disabled={true}
                role="button"
                aria-label="Join room"
                size="xl"
                // className={`${classes.buttonLeft} w-13 mt-11 px-4`}
                className={`w-13 mt-11 px-4`}
                type="submit"
              >
                <IconArrowBadgeRightFilled size={35} spacing={0} />
              </Button>
            </Group>
          </div>
        </div>
      </form>
    </div>
  );
};

export default IndexFormSkeleton;
