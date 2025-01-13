'use client';

import React from 'react';

import type { AgChartOptions } from 'ag-charts-community';
import { AgCharts } from 'ag-charts-react';

import { renderer } from 'fpp/components/analytics/historical-chart-options';

class ReoccurringChartOptions {
  toOptions(): AgChartOptions {
    return {
      theme: 'ag-polychroma-dark',
      background: {
        fill: '#242424',
      },
      height: 400,
      legend: {
        enabled: false,
      },
      navigator: {
        enabled: false,
      },
      tooltip: {
        enabled: true,
      },
      series: [
        {
          type: 'line',
          xKey: 'date',
          yKey: 'users',
          yName: 'Reoccurring Users',
          strokeWidth: 2,
          stroke: '#1971C2',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params) =>
              renderer(params, 'Reoccurring Users', '#1971C2'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'rooms',
          yName: 'Reoccurring Rooms',
          strokeWidth: 2,
          stroke: '#40C057',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params) =>
              renderer(params, 'Reoccurring Rooms', '#40C057'),
          },
        },
      ],
      axes: [
        {
          type: 'time',
          position: 'bottom',
        },
        {
          type: 'number',
          position: 'left',
          keys: ['users'],
          title: {
            text: 'Reoccurring Users',
          },
        },
        {
          type: 'number',
          position: 'right',
          keys: ['rooms'],
          title: {
            text: 'Reoccurring Rooms',
          },
        },
      ],
    };
  }
}

const ChartOptions = new ReoccurringChartOptions();

export const ReoccurringChart = ({
  reoccurring,
  reduceReoccurring,
}: {
  reoccurring: {
    date: Date;
    reoccurring_users: number;
    reoccurring_rooms: number;
    adjusted_reoccurring_users: number;
    adjusted_reoccurring_rooms: number;
  }[];
  reduceReoccurring: boolean;
}) => {
  const data = reoccurring.map((item) => ({
    date: item.date,
    users: reduceReoccurring
      ? item.adjusted_reoccurring_users
      : item.reoccurring_users,
    rooms: reduceReoccurring
      ? item.adjusted_reoccurring_rooms
      : item.reoccurring_rooms,
  }));

  return (
    <div>
      <AgCharts options={{ data, ...ChartOptions.toOptions() }} />
    </div>
  );
};
