'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Button, HoverCard, Text } from '@mantine/core';

import { type Action } from 'fpp-server/src/room.actions';
import { RoomStateStatus, type User } from 'fpp-server/src/room.entity';

import {
  getAverageFromUsers,
  getStackedEstimationsFromUsers,
} from 'fpp/utils/room.util';

import { useRoomStore } from 'fpp/store/room.store';

import { UserHoverCard } from './user-hover-card';

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
              return (
                <StackedEstimations
                  users={users}
                  triggerAction={triggerAction}
                />
              );
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
              <UserHoverCard user={user} userId={userId} />
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

function StackedEstimations({
  users,
  triggerAction,
}: {
  users: User[];
  triggerAction: (action: Action) => void;
}) {
  return (
    <>
      {getStackedEstimationsFromUsers(users, triggerAction).map(
        (item, index) => (
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
        ),
      )}
      <div className="average">{getAverageFromUsers(users, triggerAction)}</div>
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
