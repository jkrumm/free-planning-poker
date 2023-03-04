import Head from "next/head";
import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { setLocalstorageRoom } from "~/store/local-storage";
import { configureAbly, useChannel, usePresence } from "@ably-labs/react-hooks";
import { v4 } from "uuid";
import { useWsStore } from "~/store/ws-store";
import { usePageStore } from "~/store/page-store";

const Room = () => {
  configureAbly({
    authUrl: `${process.env.NEXT_PUBLIC_API_ROOT}api/ably-token`,
    clientId: v4(),
  });

  const router = useRouter();
  // const room = router.query.room as string;

  // if (room || room !== "undefined") {
  //   api.room.setRoom.useQuery({ room });
  // }

  const messages = useWsStore((store) => store.messages);
  const addMessage = useWsStore((store) => store.addMessage);
  const presences = useWsStore((store) => store.presences);
  const presencesMap = useWsStore((store) => store.presencesMap);
  const updatePresences = useWsStore((store) => store.updatePresences);

  const username = usePageStore((store) => store.username);

  useEffect(() => {
    // if (!room || room === "undefined") {
    //   setLocalstorageRoom(null);
    //   router.push(`/`);
    //   return;
    // }
    // setLocalstorageRoom(room);
  }, []);

  const [channel] = useChannel("your-channel-name", (message) => {
    console.log("RECEIVED MESSAGE", message);
    addMessage(message.data.text);
  });

  channel.presence.get((err, presenceUpdates) => {
    if (!presenceUpdates?.length) {
      return;
    }
    console.log("FETCHED PRESENCE", presenceUpdates);
    presenceUpdates.forEach((presenceUpdate) => {
      updatePresences(presenceUpdate);
    });
  });

  const [_, updateStatus] = usePresence(
    "your-channel-name",
    { username },
    (presenceUpdate) => {
      console.log("RECEIVED PRESENCE", presenceUpdate);
      updatePresences(presenceUpdate);
    }
  );

  if (process.browser) {
    window.onbeforeunload = async () => {
      console.log("LEFT CHANNEL");
      await channel.presence.leave();
    };
  }

  return (
    <>
      <Head>
        <title>Planning Poker</title>
        <meta name="description" content="Generated by create-t3-app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16 ">
          <Link href={"/"}>HOME</Link>
          <h1>Messages</h1>
          <p>{JSON.stringify(messages)}</p>
          <br />
          <h1>Presences</h1>
          <div>
            {presences.map((item) => (
              <div key={`clientId-${item}`}>{presencesMap.get(item)}</div>
            ))}
          </div>
          {/*<Messages messages={messages} />*/}
          <button
            onClick={async () => {
              // await actions.sendMessage();
              channel.publish("test-message", { text: username });
            }}
          >
            SEND MESSAGE
          </button>

          <button
            onClick={async () => {
              setLocalstorageRoom(null);
              await router.push(`/`);
            }}
          >
            LEAVE ROOM
          </button>
        </div>
      </main>
    </>
  );
};

export default Room;

const Messages: React.FC<{ messages: string[] }> = ({ messages }) => {
  return (
    <div>
      {messages.map((item, index) => (
        <div key={index}>{item}</div>
      ))}
    </div>
  );
};
