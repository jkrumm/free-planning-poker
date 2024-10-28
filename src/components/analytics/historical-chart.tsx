import React from 'react';

import { Card, Group, Switch } from '@mantine/core';

import { AgCharts } from 'ag-charts-react';

import { ChartOptions } from 'fpp/components/analytics/historical-chart-options';

export const HistoricalChart = ({
  historical,
}: {
  historical: {
    date: Date;
    estimations: number;
    acc_estimations: number;
    ma_estimations: number;
    votes: number;
    acc_votes: number;
    ma_votes: number;
    rooms: number;
    acc_rooms: number;
    ma_rooms: number;
    page_views: number;
    acc_page_views: number;
    ma_page_views: number;
    new_users: number;
    acc_new_users: number;
    ma_new_users: number;
  }[];
}) => {
  const [options, setOptions] = React.useState(ChartOptions.toOptions());

  return (
    <>
      <Card withBorder radius="md" padding="md" className="mb-12">
        <div className="md:flex justify-between">
          <Group className="pb-4 md:pb-0">
            <Switch
              label="Daily"
              className="w-[150px] md:w-auto"
              checked={ChartOptions.showDaily}
              onChange={() => setOptions(ChartOptions.toggleShowDaily())}
            />
            <Switch
              label="30-Day MA"
              className="w-[150px] md:w-auto"
              checked={ChartOptions.showMa}
              onChange={() => setOptions(ChartOptions.toggleShowMa())}
            />
            <Switch
              label="Accumulated"
              checked={ChartOptions.showAcc}
              onChange={() => setOptions(ChartOptions.toggleShowAcc())}
            />
          </Group>
          <Group className="pb-4 md:pb-0">
            <Switch
              label="Estimations"
              color="#40C057"
              className="w-[150px] md:w-auto"
              checked={ChartOptions.showEstimations}
              onChange={() => setOptions(ChartOptions.toggleEstimations())}
            />
            <Switch
              label="Votes"
              checked={ChartOptions.showVotes}
              onChange={() => setOptions(ChartOptions.toggleVotes())}
            />
            <Switch
              label="Rooms"
              className="w-[150px] md:w-auto"
              color="#8931B2"
              checked={ChartOptions.showRooms}
              onChange={() => setOptions(ChartOptions.toggleRooms())}
            />
            <Switch
              label="Page Views"
              className="w-[150px] md:w-auto"
              color="#FA5252"
              checked={ChartOptions.showPageViews}
              onChange={() => setOptions(ChartOptions.togglePageViews())}
            />
            <Switch
              label="Unique Users"
              color="#FAB005"
              checked={ChartOptions.showNewUsers}
              onChange={() => setOptions(ChartOptions.toggleNewUsers())}
            />
          </Group>
        </div>
      </Card>
      <div className="h-[600px] w-full">
        <AgCharts options={{ data: historical, ...options }} />
      </div>
    </>
  );
};
