'use client';

import React from 'react';

import { Button, Card, Group, Text } from '@mantine/core';

import { type Action } from 'fpp-server/src/room.actions';
import { RoomStateStatus, type User } from 'fpp-server/src/room.types';

import {
  getAverageFromUsers,
  getStackedEstimationsFromUsers,
} from 'fpp/utils/room.util';

interface CardListCardPlaceProps {
  roomId: number;
  userId: string;
  users: User[];
  status: keyof typeof RoomStateStatus;
  triggerAction: (action: Action) => void;
}

export const CardListCardPlace = ({
  roomId,
  userId,
  users,
  status,
  triggerAction,
}: CardListCardPlaceProps) => {
  const renderContent = () => {
    switch (status) {
      case RoomStateStatus.flipped:
        return (
          <Group
            gap="md"
            justify="space-around"
            wrap="nowrap"
            className="w-full"
          >
            <div className="flex gap-1">
              <CardListStackedEstimations
                users={users}
                triggerAction={triggerAction}
              />
            </div>
            <div className="min-w-[45px]">
              <Text size="lg" fw={700} c="white">
                ⌀ {getAverageFromUsers(users, triggerAction)}
              </Text>
            </div>
          </Group>
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
        return (
          <Text size="xl" fw={700} className="text-center">
            VOTE
          </Text>
        );
    }
  };

  return (
    <Card
      withBorder
      className="mb-2 px-1 md:px-4 pt-3 pb-1 md:pt-4 md:pb-2 min-h-[123px] flex items-center justify-center"
      style={{
        borderColor: '#424242',
        borderWidth: '2px',
        backgroundColor: 'transparent',
      }}
    >
      {renderContent()}
    </Card>
  );
};

// Custom StackedEstimations component that matches the card-list.tsx styling
function CardListStackedEstimations({
  users,
  triggerAction,
}: {
  users: User[];
  triggerAction: (action: Action) => void;
}) {
  const stackedEstimations = getStackedEstimationsFromUsers(
    users,
    triggerAction,
  );

  return (
    <>
      {stackedEstimations.map((item, index) => (
        <div
          key={index}
          className="flex flex-col items-center mr-0 md:mr-2 last:mr-0"
        >
          <div
            className="relative flex items-end"
            style={{ perspective: '1000px' }}
          >
            {Array.from({ length: item.amount }, (_, i) => (
              <div
                key={i}
                className=" bg-[#242424] border-[#424242] w-12 h-16 rounded border-2 flex items-center justify-center text-sm font-bold"
                style={{
                  marginLeft: i > 0 ? '-44px' : '0',
                  zIndex: item.amount + i,
                  transform: `translateY(${i * -3}px)`,
                }}
              >
                {item.number}
              </div>
            ))}
          </div>
          <Text size="xs" c="dimmed" className="mt-1">
            {item.amount}×
          </Text>
        </div>
      ))}
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
    <Button
      size="lg"
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
  );
}
