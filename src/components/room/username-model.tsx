import React, { useState } from "react";
import { Button, FocusTrap, Modal, TextInput } from "@mantine/core";
import { useLocalstorageStore } from "fpp/store/local-storage.store";

export const UsernameModel = ({
  modelOpen,
  setModelOpen,
  room,
}: {
  modelOpen: boolean;
  setModelOpen: (modelOpen: boolean) => void;
  room: string;
}) => {
  const [error, setError] = useState(false);

  const [inputUsername, setInputUsername] = useState("");

  const setUsername = useLocalstorageStore((store) => store.setUsername);

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
            value={inputUsername}
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
            disabled={
              !inputUsername ||
              inputUsername?.replace(/[^A-Za-z]/g, "").length < 3 ||
              inputUsername?.replace(/[^A-Za-z]/g, "").length > 15
            }
            onClick={(e) => {
              e.preventDefault();
              if (
                !inputUsername ||
                inputUsername?.replace(/[^A-Za-z]/g, "").length < 3 ||
                inputUsername?.replace(/[^A-Za-z]/g, "").length > 15
              ) {
                setError(true);
              } else {
                setUsername(inputUsername);
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
