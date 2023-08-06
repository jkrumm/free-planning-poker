import { Button, createStyles, Group, TextInput } from "@mantine/core";
import { IconArrowBadgeRightFilled } from "@tabler/icons-react";
import React from "react";

const useStyles = createStyles(() => ({
  buttonRight: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  buttonLeft: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
}));

const IndexFormPlaceholder = () => {
  const { classes } = useStyles();
  return (
    <div className="w-full px-4 pb-16">
      <Button
        variant="gradient"
        gradient={{ from: "blue", to: "cyan" }}
        size="xl"
        className={`mx-auto my-8 block w-[480px]`}
        type="button"
        uppercase
        disabled
      >
        Join recent room
      </Button>
      <form className="mt-8 w-full">
        <div className="mx-auto max-w-[400px]">
          <div className="w-full">
            <TextInput label="Username" size="xl" />

            <Group noWrap spacing={0}>
              <TextInput
                disabled
                label="Room"
                className={`${classes.buttonLeft} w-13 mt-11 px-4`}
                size="xl"
              />
              <Button
                disabled
                size="xl"
                className={`${classes.buttonLeft} w-13 mt-11 px-4`}
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

export default IndexFormPlaceholder;
