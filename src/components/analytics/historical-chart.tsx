import React from 'react';

import { Card, Group, Switch } from '@mantine/core';

import { AgChartsReact } from 'ag-charts-react';

import { ChartOptions } from 'fpp/components/analytics/historical-chart-options';

export const HistoricalChart = ({
  historical,
}: {
  historical: {
    date: Date;
    estimations: number;
    acc_estimations: number;
    votes: number;
    acc_votes: number;
    page_views: number;
    acc_page_views: number;
    new_users: number;
    acc_new_users: number;
  }[];
}) => {
  const [options, setOptions] = React.useState(ChartOptions.toOptions());

  return (
    <>
      <Card withBorder radius="md" padding="md" className="mb-12">
        <div className="md:flex justify-between">
          <Group className="pb-4 md:pb-0">
            <Switch
              label="Daily amounts"
              className="w-[150px] md:w-auto"
              checked={ChartOptions.showDaily}
              onChange={() => setOptions(ChartOptions.toggleShowDaily())}
            />
            <Switch
              label="Accumulated amounts"
              checked={ChartOptions.showAcc}
              onChange={() => setOptions(ChartOptions.toggleShowAcc())}
            />
          </Group>
          <Group className="pb-4 md:pb-0">
            <Switch
              label="Estimations"
              color="#40C057"
              className="w-[150px] md:w-auto"
              checked={
                ChartOptions.showEstimations || ChartOptions.showAccEstimations
              }
              onChange={() => setOptions(ChartOptions.toggleEstimations())}
            />
            <Switch
              label="Votes"
              checked={ChartOptions.showVotes || ChartOptions.showAccVotes}
              onChange={() => setOptions(ChartOptions.toggleVotes())}
            />
          </Group>
          <Group>
            <Switch
              label="Page Views"
              className="w-[150px] md:w-auto"
              color="#FA5252"
              checked={
                ChartOptions.showPageViews || ChartOptions.showAccPageViews
              }
              onChange={() => setOptions(ChartOptions.togglePageViews())}
            />
            <Switch
              label="Unique Users"
              color="#FAB005"
              checked={
                ChartOptions.showNewUsers || ChartOptions.showAccNewUsers
              }
              onChange={() => setOptions(ChartOptions.toggleNewUsers())}
            />
          </Group>
        </div>
      </Card>
      <div className="h-[600px] w-full">
        <AgChartsReact options={{ data: historical, ...options }} />
      </div>
    </>
  );
};
