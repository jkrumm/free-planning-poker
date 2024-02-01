'use client';

import React from 'react';

import { Button } from '@mantine/core';

import { type Logger } from 'next-axiom';

import { api } from 'fpp/utils/api';

import { useRoomStateStore } from 'fpp/store/room-state.store';

import {
  type User,
  roomStateStatus,
} from 'fpp/server/room-state/room-state.entity';
import {
  getAverageFromUsers,
  getStackedEstimationsFromUsers,
} from 'fpp/server/room-state/room-state.utils';

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
  const status = useRoomStateStore((store) => store.status);

  return (
    <div className="table">
      <div className="card-place">
        {(function () {
          switch (status) {
            case roomStateStatus.flipped:
              return <StackedEstimations users={users} />;
            case roomStateStatus.flippable:
              return <ShowVotesButton roomId={roomId} userId={userId} />;
            case roomStateStatus.estimating:
            default:
              return <div className="vote">VOTE</div>;
          }
        })()}
      </div>

      <div className="players">
        {users.map((user, index) => (
          <div key={index} className={`player player-${index + 1}`}>
            <div className={`avatar bg-gray-800 ${user.status}`} />
            <div className={`name ${user.id === userId && 'font-bold'}`}>
              {user.name}
            </div>
            <div
              className={`card players ${status === roomStateStatus.flipped && 'flipped'} ${
                user.status
              }`}
            >
              {user.estimation}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function StackedEstimations({ users }: { users: User[] }) {
  return (
    <>
      {getStackedEstimationsFromUsers(users).map((item, index) => (
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
      <div className="average">{getAverageFromUsers(users)}</div>
    </>
  );
}

function ShowVotesButton({
  roomId,
  userId,
}: {
  roomId: number;
  userId: string;
}) {
  const flipMutation = api.roomState.flip.useMutation();

  return (
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
  );
}
