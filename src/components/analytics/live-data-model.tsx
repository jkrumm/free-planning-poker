import React from 'react';

import { SimpleGrid } from '@mantine/core';

import { dateToTimestamp } from 'fpp/utils/time.util';

import { type ServerAnalytics } from 'fpp/server/api/routers/analytics.router';

import { StatsCard } from 'fpp/components/analytics/stats-card';

export const LiveDataModel = ({
  serverAnalytics,
}: {
  serverAnalytics: ServerAnalytics;
}) => {
  return (
    <>
      <SimpleGrid
        cols={{
          xs: 1,
          sm: 2,
          md: 2,
        }}
        spacing="lg"
      >
        <StatsCard
          name="Connected Users"
          value={serverAnalytics.connectedUsers}
        />
        <StatsCard name="Open Rooms" value={serverAnalytics.openRooms} />
      </SimpleGrid>
      {serverAnalytics.rooms.map((room, index) => (
        <div key={index} className="mt-5">
          <strong>Room {index + 1}</strong>
          <br />
          <SimpleGrid
            cols={{
              xs: 1,
              sm: 2,
              md: 4,
            }}
            className="mt-2"
            spacing="md"
          >
            <StatsCard name="User Count" value={room.userCount} />
            <StatsCard
              name="First Active"
              value={dateToTimestamp(room.firstActive)}
            />
            <StatsCard
              name="Last Active"
              value={dateToTimestamp(room.lastActive)}
            />
            <StatsCard
              name="Last Updated"
              value={dateToTimestamp(room.lastUpdated)}
            />
          </SimpleGrid>
          {room.users.map((user, index) => (
            <SimpleGrid
              cols={{
                xs: 1,
                sm: 2,
                md: 4,
              }}
              spacing="md"
              className="mt-4"
              key={index}
            >
              <StatsCard
                name="Estimation"
                value={user.estimation ?? 'Not estimated'}
              />
              <StatsCard
                name="Is Spectator"
                value={user.isSpectator ? 'Yes' : 'No'}
              />
              <StatsCard
                name="First Active"
                value={dateToTimestamp(user.firstActive)}
              />
              <StatsCard
                name="Last Active"
                value={dateToTimestamp(user.lastActive)}
              />
            </SimpleGrid>
          ))}
        </div>
      ))}
    </>
  );
};
