import Head from "next/head";
import React, { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { setLocalstorageRoom } from "~/store/local-storage";
import { configureAbly, useChannel, usePresence } from "@ably-labs/react-hooks";
import { v4 } from "uuid";
import { useWsStore, Voting } from "~/store/ws-store";
import { usePageStore } from "~/store/page-store";
import { Button, Switch } from "@mantine/core";
import { usePlausible } from "next-plausible";
import { PlausibleEvents } from "~/utils/plausible.events";
import { api } from "~/utils/api";
import { notifications } from "@mantine/notifications";

function getByValue(map: Map<string, string>, searchValue: string) {
  for (const [key, value] of map.entries()) {
    if (value === searchValue) return key;
  }
}

const fibonacci = [1, 2, 3, 5, 8, 13, 21, 34];

// const Room = () => {
//
// };
//
// const WsListener = () => {
//
// }

const Room = () => {
  const setRoom = api.room.setRoom.useMutation();

  let clientId = v4();
  configureAbly({
    authUrl: `${
      process.env.NEXT_PUBLIC_API_ROOT || "http://localhost:3000/"
    }api/ably-token`,
    clientId,
  });

  const plausible = usePlausible<PlausibleEvents>();

  const roomRef = useRef(null);
  const router = useRouter();
  const room = router.query.room as string;

  if (!room) {
    router.push(`/`).then(() => {
      return;
    });
  }

  const autoShow = useWsStore((store) => store.autoShow);
  const flipped = useWsStore((store) => store.flipped);
  const spectators = useWsStore((store) => store.spectators);
  const votes = useWsStore((store) => store.votes);
  const fullReset = useWsStore((store) => store.fullReset);
  const handleMessage = useWsStore((store) => store.handleMessage);
  const presencesMap = useWsStore((store) => store.presencesMap);
  const updatePresences = useWsStore((store) => store.updatePresences);

  const username = usePageStore((store) => store.username);

  if (username) {
    clientId = getByValue(presencesMap, username) || clientId;
  }

  useEffect(() => {
    plausible("entered", { props: { room } });
    if (!room || room === "undefined") {
      setLocalstorageRoom(null);
      router.push(`/`).then((r) => {
        return;
      });
    } else {
      fullReset();
      setLocalstorageRoom(room);
      try {
        setRoom.mutate({ room });
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const [channel] = useChannel(room, (message) => {
    console.log("RECEIVED MESSAGE", message);
    handleMessage(message);
  });

  if (presencesMap.size === 0) {
    channel.presence.get((err, presenceUpdates) => {
      if (!presenceUpdates?.length) {
        return;
      }
      console.log("FETCHED PRESENCE", presenceUpdates);
      presenceUpdates.forEach((presenceUpdate) => {
        updatePresences(presenceUpdate);
      });
    });
  }

  const [_, updateStatus] = usePresence(
    room,
    { username },
    (presenceUpdate) => {
      if (presenceUpdate.action === "enter") {
        channel.presence.update({
          username,
          voting:
            votes.find((vote) => vote.clientId === clientId)?.number || null,
          spectators: spectators.includes(clientId),
        });
      }
      console.log("RECEIVED PRESENCE", presenceUpdate);
      updatePresences(presenceUpdate);
    }
  );

  if (process.browser) {
    window.onbeforeunload = () => {
      channel.presence.leave({}, () => {
        console.log("LEFT CHANNEL");
        return;
      });
    };
  }

  function flip() {
    plausible("voted", { props: { players: votes.length, room } });
    channel.publish("flip", {});
  }

  return (
    <>
      <Head>
        <title>Planning Poker - {room}</title>
        <meta
          name="description"
          content="Estimate your story points faster and easier with this free agile scrum sprint planning poker app. Open source and privacy focused."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <meta property="og:title" content="Free Planning Poker" />
        <meta
          property="og:description"
          content="Estimate your story points faster and easier with this free agile scrum sprint planning poker app. Open source and privacy focused."
        />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:url" content="https://free-planning-poker.com/" />
        <meta
          property="og:image"
          content="https://free-planning-poker.com/free-planning-poker.jpg"
        />
        <meta
          property="og:image:secure_url"
          content="https://free-planning-poker.com/free-planning-poker.jpg"
        />
        <meta property="og:image:type" content="image/jpg" />
        <meta property="og:image:width" content="1034" />
        <meta property="og:image:height" content="612" />
        <meta property="og:image:alt" content="Free Planning Poker" />
        <meta charSet="utf-8" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#1971c2" />
        <meta name="msapplication-TileColor" content="#1a1b1e" />
        <meta name="theme-color" content="#1a1b1e" />
      </Head>
      <main className="relative flex max-h-screen min-h-screen max-w-[100vw] flex-col items-center justify-center overscroll-none">
        <Table
          votes={votes}
          spectators={spectators}
          flip={flip}
          flipped={flipped}
          username={username}
        />
        <div className="voting-bar">
          <Button.Group>
            {fibonacci.map((number) => (
              <Button
                disabled={spectators.includes(clientId) || !flipped}
                variant={
                  votes.some(
                    (item) =>
                      item.clientId === clientId && item.number === number
                  )
                    ? "filled"
                    : "default"
                }
                size={"lg"}
                key={number}
                onClick={() => {
                  if (!channel) return;
                  channel.presence.update({
                    username,
                    voting: number,
                    spectators: spectators.includes(clientId),
                  });
                }}
              >
                {number}
              </Button>
            ))}
          </Button.Group>
        </div>
        <div className="settings-bar">
          <Button
            variant="outline"
            color="gray"
            size="lg"
            className="room-name"
            compact
          >
            <h2
              className="uppercase"
              ref={roomRef}
              onClick={async () => {
                if (!window.location) {
                  return;
                }
                if ("clipboard" in navigator) {
                  await navigator.clipboard.writeText(
                    window.location.toString()
                  );
                } else {
                  document.execCommand(
                    "copy",
                    true,
                    window.location.toString()
                  );
                }
                notifications.show({
                  color: "green",
                  autoClose: 3000,
                  withCloseButton: true,
                  title: "Room url copied to clipboard",
                  message: "Share it with your team!",
                });
              }}
            >
              {room}
            </h2>
          </Button>
          <div>
            <Button
              variant={flipped ? "default" : "filled"}
              disabled={flipped}
              className={"mr-5"}
              onClick={() => {
                channel.publish("reset", {});
              }}
            >
              New Round
            </Button>
            <Button
              variant={"default"}
              onClick={async () => {
                setLocalstorageRoom(null);
                await router.push(`/`);
              }}
            >
              Leave Room
            </Button>
          </div>
        </div>
        <div className="switch-bar">
          <Switch
            className="mb-2 cursor-pointer"
            disabled={!flipped}
            label="Spectator"
            checked={spectators.includes(clientId)}
            onChange={(event) =>
              channel.presence.update({
                username,
                voting: null,
                spectator: event.currentTarget.checked,
              })
            }
          />
          <Switch
            label="Auto Show"
            disabled={true}
            className="cursor-pointer"
            checked={autoShow}
            onChange={(event) =>
              channel.publish("auto-show", {
                autoShow: event.currentTarget.checked,
              })
            }
          />
        </div>
      </main>
    </>
  );
};

export default Room;

const Table = ({
  votes,
  spectators,
  flip,
  flipped,
  username,
}: {
  votes: Voting[];
  spectators: string[];
  flip: () => void;
  flipped: boolean;
  username: string | null;
}) => {
  const presences = useWsStore((store) => store.presences);
  const presencesMap = useWsStore((store) => store.presencesMap);

  // const players = [
  //   { name: "Johannes", card: "1", status: "voted" },
  //   { name: "Jasmin", card: "9", status: "suspect" },
  //   { name: "Niklas", card: "13", status: "pending" },
  //   { name: "Laura", card: "31", status: "pending" },
  //   { name: "Dennis", card: "51", status: "voted" },
  //   { name: "Stephen", card: "16", status: "pending" },
  //   { name: "John", card: "88", status: "voted" },
  //   { name: "Thomas", card: "12", status: "voted" },
  // ];

  console.log("presences", presences);
  console.log("spectators", spectators);

  const players = presences.map((item) => {
    const vote = votes.find((vote) => vote.clientId === item);
    let status = "pending";
    if (spectators.includes(item)) {
      status = "spectator";
    } else if (vote) {
      status = "voted";
    }
    return {
      name: presencesMap.get(item),
      card: vote?.number || null,
      status,
    };
  });

  let voting: { number: number; amount: number }[] = [];
  votes.forEach((item) => {
    if (!item.number) return;
    const index = voting.findIndex((v) => v.number === item.number);
    if (index === -1) {
      voting.push({ number: item.number, amount: 1 });
    } else if (index > -1) {
      // @ts-ignore
      voting[index].amount++;
    }
  });
  voting = voting.filter((item) => item.number != null);

  const average =
    Math.round(
      (voting.reduce((acc, item) => {
        return acc + item.number * item.amount;
      }, 0) /
        voting.reduce((acc, item) => acc + item.amount, 0)) *
        10
    ) / 10 || null;

  voting = voting.sort((a, b) => b.amount - a.amount).slice(0, 4);
  if (average && average > 10) {
    voting = voting.slice(0, 3);
  }

  return (
    <div className="table">
      <div className="card-place">
        {!flipped &&
          voting.map((item, index) => (
            <div key={index} className={`card-wrapper amount-${item.amount}`}>
              {(function () {
                const cards = [];
                for (let i = 0; i < item.amount; i++) {
                  cards.push(<div className="card">{item.number}</div>);
                }
                return cards;
              })()}
            </div>
          ))}
        {!flipped && <div className="average">{average}</div>}
        {(function () {
          if (flipped) {
            if (
              players.some((item) => item.status !== "spectator") &&
              players
                .filter((item) => item.status !== "spectator")
                .every((item) => item.status === "voted")
            ) {
              return (
                <div className="relative flex h-full w-full items-center justify-center">
                  <Button size="lg" className="center" onClick={flip}>
                    Show Votes
                  </Button>
                </div>
              );
            }
            return <div className="vote">VOTE</div>;
          }
        })()}
      </div>

      <div className="players">
        {players.map(({ name, card, status }, index) => (
          <div key={index} className={`player player-${index + 1}`}>
            <div className={`avatar bg-gray-800 ${status}`} />
            <div className={`name ${name === username && "font-bold"}`}>
              {name}
            </div>
            <div className={`card ${flipped && "flipped"} ${status}`}>
              {card}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
