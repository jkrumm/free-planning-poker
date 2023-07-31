import React, { useState } from "react";
import { Button, FocusTrap, Modal, TextInput } from "@mantine/core";
import { setUsername } from "fpp/store/local-storage";

export const UsernameModel = ({
  modelOpen,
  setModelOpen,
  room,
  username,
  setInputUsername,
}: {
  modelOpen: boolean;
  setModelOpen: (modelOpen: boolean) => void;
  room: string;
  username: string | null;
  setInputUsername: (username: string) => void;
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
      <h1 className="m-0 mb-5">Join room {room?.toUpperCase()}</h1>
      <FocusTrap active={true}>
        <form>
          <TextInput
            autoFocus
            data-autofocus
            label="Your Name"
            error={error && "Required"}
            size="xl"
            withAsterisk
            value={username ?? ""}
            onChange={(event) => {
              setError(false);
              setInputUsername(event.currentTarget.value.trim());
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
            onClick={(e) => {
              e.preventDefault();
              if (!username) {
                setError(true);
              } else {
                setInputUsername(username);
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
