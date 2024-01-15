"use client";

import React from "react";
import { api } from "fpp/utils/api";
import { type Logger } from "next-axiom";
import { useRoomStateStore } from "fpp/store/room-state.store";
import { Button } from "@mantine/core";

export const Table = ({
  roomId,
  userId,
  logger,
}: {
  roomId: number;
  userId: string;
  logger: Logger;
}) => {
  const users = useRoomStateStore((store) => store.users);
  const isFlipped = useRoomStateStore((store) => store.isFlipped);
  const isFlippable = useRoomStateStore((store) => store.isFlippable);
  const averageEstimation = useRoomStateStore(
    (store) => store.averageEstimation,
  );
  const stackedEstimations = useRoomStateStore(
    (store) => store.stackedEstimations,
  );

  const flipMutation = api.roomState.flip.useMutation();

  return (
    <div className="table">
      <div className="card-place">
        {isFlipped && (
          <>
            {stackedEstimations.slice(0, 4).map((item, index) => (
              <div key={index} className={`card-wrapper amount-${item.amount}`}>
                {(function () {
                  const cards = [];
                  for (let i = 0; i < item.amount; i++) {
                    cards.push(
                      <div className="card" key={i}>
                        {item.number}
                      </div>,
                    );
                  }
                  return cards;
                })()}
              </div>
            ))}
            <div className="average">{averageEstimation}</div>
          </>
        )}
        {!isFlipped && !isFlippable && <div className="vote">VOTE</div>}
        {!isFlipped && isFlippable && (
          <div className="relative flex h-full w-full items-center justify-center">
            <Button
              size="lg"
              className="center"
              onClick={() => {
                flipMutation.mutate({
                  roomId,
                  userId,
                });
              }}
            >
              Show Votes
            </Button>
          </div>
        )}
      </div>

      <div className="players">
        {users.map((user, index) => (
          <div key={index} className={`player player-${index + 1}`}>
            <div className={`avatar bg-gray-800 ${user.status}`} />
            <div className={`name ${user.id === userId && "font-bold"}`}>
              {user.name}
            </div>
            <div className={`card ${isFlipped && "flipped"} ${user.status}`}>
              {user.estimation}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
