'use client';

import React from 'react';

import { Button } from '@mantine/core';

import { type Action } from 'fpp-server/src/room.actions';
import { RoomStateStatus, type User } from 'fpp-server/src/room.entity';

import {
  getAverageFromUsers,
  getStackedEstimationsFromUsers,
} from 'fpp/utils/room.util';

import { useRoomStore } from 'fpp/store/room.store';

export const Table = ({
  roomId,
  userId,
  triggerAction,
}: {
  roomId: number;
  userId: string;
  triggerAction: (action: Action) => void;
}) => {
  const users = useRoomStore((store) => store.users);
  const status = useRoomStore((store) => store.status);

  return (
    <div className="table">
      <div className="card-place">
        {(function () {
          switch (status) {
            case RoomStateStatus.flipped:
              return <StackedEstimations users={users} />;
            case RoomStateStatus.flippable:
              return (
                <ShowVotesButton
                  roomId={roomId}
                  userId={userId}
                  triggerAction={triggerAction}
                />
              );
            case RoomStateStatus.estimating:
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
              className={`card players ${status === RoomStateStatus.flipped && 'flipped'} ${
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
  triggerAction,
}: {
  roomId: number;
  userId: string;
  triggerAction: (action: Action) => void;
}) {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <Button
        size="lg"
        className="center"
        onClick={() => {
          triggerAction({
            action: 'flip',
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
