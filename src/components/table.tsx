"use client";

import { useWsStore } from "fpp/store/ws.store";
import { Button } from "@mantine/core";
import React from "react";
import { usePlausible } from "next-plausible";
import { type PlausibleEvents } from "fpp/utils/plausible.events";
import { log } from "fpp/utils/console-log";

export const Table = ({
  room,
  username,
}: {
  room: string;
  username: string;
}) => {
  const channel = useWsStore((store) => store.channel);

  const votes = useWsStore((store) => store.votes);
  const flipped = useWsStore((store) => store.flipped);
  const spectators = useWsStore((store) => store.spectators);
  const presences = useWsStore((store) => store.presences);
  const presencesMap = useWsStore((store) => store.presencesMap);

  const plausible = usePlausible<PlausibleEvents>();

  function flip() {
    plausible("voted", {
      props: { players: votes.length, room },
    });
    if (channel) {
      log("FLIPPED", {});
      channel.publish("flip", {});
    }
  }

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
      card: vote?.number ?? null,
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
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
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
                  cards.push(
                    <div className="card" key={i}>
                      {item.number}
                    </div>
                  );
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
