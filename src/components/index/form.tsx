import { useForm } from "@mantine/form";
import { generate } from "random-words";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import React, { useEffect, useState } from "react";
import {
  Autocomplete,
  Button,
  createStyles,
  Group,
  TextInput,
} from "@mantine/core";
import { IconArrowBadgeRightFilled } from "@tabler/icons-react";
import { useRouter } from "next/router";
import { type ClientLog } from "fpp/constants/error.constant";
import { logMsg, roomEvent } from "fpp/constants/logging.constant";
import { type Logger } from "next-axiom";

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

const IndexForm = ({
  randomRoom,
  activeRooms,
  logger,
}: {
  randomRoom: string | undefined;
  activeRooms: string[];
  logger: Logger;
}) => {
  const router = useRouter();
  const { classes } = useStyles();

  const visitorId = useLocalstorageStore((state) => state.visitorId);

  const room = useLocalstorageStore((state) => state.room);
  const setRoom = useLocalstorageStore((state) => state.setRoom);
  const username = useLocalstorageStore((state) => state.username);
  const setUsername = useLocalstorageStore((state) => state.setUsername);

  useEffect(() => {
    if (!room || room === "null" || room === "undefined") {
      setRoom(null);
    } else {
      router
        .push(`/room/${room}`)
        .then(() => ({}))
        .catch(() => ({}));
    }
  }, [room]);

  const [recentRoom, setRecentRoom] = useState<string | null>(null);
  useEffect(() => {
    const recentRoom = localStorage.getItem("recentRoom");
    if (recentRoom) {
      setRecentRoom(recentRoom);
    }
  }, []);

  const form = useForm({
    initialValues: {
      username: username ?? "",
      room: randomRoom ?? generate({ minLength: 3, exactly: 1 })[0] ?? "",
    },
    validate: {
      username: (value) =>
        value.replace(/[^A-Za-z]/g, "").length < 3 ||
        value.replace(/[^A-Za-z]/g, "").length > 15,
      room: (value) =>
        value.replace(/[^A-Za-z]/g, "").length < 3 ||
        value.replace(/[^A-Za-z]/g, "").length > 15,
    },
  });

  const [usernameInvalid, setUsernameInvalid] = useState<boolean>(false);

  useEffect(() => {
    setUsernameInvalid(
      !form.values.username ||
        form.values.username.replace(/[^A-Za-z]/g, "").length < 3
    );
  }, [form.values.username]);

  return (
    <div className="w-full px-4 pb-16">
      <Button
        variant="gradient"
        gradient={{ from: "blue", to: "cyan" }}
        size="xl"
        className={`mx-auto my-8 block md:w-[480px]`}
        type="button"
        uppercase
        role="recent-roome"
        disabled={!recentRoom || usernameInvalid}
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onClick={async (e) => {
          setUsername(form.values.username);
          setRoom(recentRoom);
          e.preventDefault();
          logger.info(logMsg.TRACK_ROOM_EVENT, {
            visitorId,
            room: recentRoom,
            event: roomEvent.ENTER_EXISTING_ROOM,
          });
          await router.push(`/room/${recentRoom}`);
        }}
      >
        Join recent room &nbsp;<strong>{recentRoom}</strong>
      </Button>
      <form
        className="mt-8 w-full"
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onSubmit={form.onSubmit(async () => {
          setUsername(form.values.username);
          const roomName = form.values.room
            .replace(/[^A-Za-z]/g, "")
            .toLowerCase();

          const logPayload: ClientLog = {
            visitorId,
            room: roomName,
          };

          if (activeRooms.includes(roomName)) {
            logger.info(logMsg.TRACK_ROOM_EVENT, {
              ...logPayload,
              event: roomEvent.ENTER_EXISTING_ROOM,
            });
          } else if (roomName === randomRoom) {
            logger.info(logMsg.TRACK_ROOM_EVENT, {
              ...logPayload,
              event: roomEvent.ENTER_RANDOM_ROOM,
            });
          } else {
            logger.info(logMsg.TRACK_ROOM_EVENT, {
              ...logPayload,
              event: roomEvent.ENTER_NEW_ROOM,
            });
          }
          setRoom(roomName);
          await router.push(`/room/${roomName}`);
        })}
      >
        <div className="mx-auto max-w-[400px]">
          <div className="w-full">
            <TextInput
              label="Username"
              size="xl"
              {...form.getInputProps("username")}
            />

            <Group noWrap spacing={0}>
              <Autocomplete
                disabled={usernameInvalid}
                label="Room"
                className={`${classes.buttonRight} my-6 w-full`}
                size="xl"
                limit={3}
                {...form.getInputProps("room")}
                data={form.values.room.length > 1 ? activeRooms : []}
              />
              <Button
                disabled={usernameInvalid}
                role="join-room"
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

export default IndexForm;
