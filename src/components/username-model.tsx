import React, { useState } from "react";
import { Button, FocusTrap, Modal, TextInput } from "@mantine/core";

export const UsernameModel = ({
  modelOpen,
  setModelOpen,
  room,
  username,
  setUsername,
}: {
  modelOpen: boolean;
  setModelOpen: (modelOpen: boolean) => void;
  room: string;
  username: string | null;
  setUsername: (username: string) => void;
}) => {
  const [error, setError] = useState(false);

  return (
    <Modal
      opened={modelOpen}
      onClose={() => setModelOpen(!modelOpen)}
      withCloseButton={false}
      centered
      closeOnEscape={false}
      closeOnClickOutside={false}
    >
      <h1 className="m-0 mb-5">Join room {room && room.toUpperCase()}</h1>
      <FocusTrap active={true}>
        <form>
          <TextInput
            autoFocus
            data-autofocus
            label="Your Name"
            error={error && "Required"}
            size="xl"
            withAsterisk
            value={username || ""}
            onChange={(event) => {
              setError(false);
              setUsername(event.currentTarget.value.trim());
            }}
          />
          <Button
            variant="gradient"
            gradient={{ from: "blue", to: "cyan" }}
            size="xl"
            className={`my-8 w-full px-0`}
            type="submit"
            uppercase
            disabled={!username && username?.length === 0}
            onClick={async (e) => {
              e.preventDefault();
              if (!username) {
                setError(true);
              } else {
                setUsername(username);
                setModelOpen(false);
              }
            }}
          >
            Join room:&nbsp;<strong>{room}</strong>
          </Button>
        </form>
      </FocusTrap>
    </Modal>
  );
};
