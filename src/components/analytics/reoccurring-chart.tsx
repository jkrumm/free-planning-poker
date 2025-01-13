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
          yKey: 'reoccurring_users',
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
          yKey: 'reoccurring_rooms',
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
          keys: ['reoccurring_users'],
          title: {
            text: 'Reoccurring Users',
          },
        },
        {
          type: 'number',
          position: 'right',
          keys: ['reoccurring_rooms'],
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
}: {
  reoccurring: {
    date: Date;
    reoccurring_users: number;
    reoccurring_rooms: number;
  }[];
}) => {
  return (
    <div>
      <AgCharts options={{ data: reoccurring, ...ChartOptions.toOptions() }} />
    </div>
  );
};
