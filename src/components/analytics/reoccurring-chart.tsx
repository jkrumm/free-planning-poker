'use client';

import React from 'react';

import type {
  AgCartesianChartOptions,
  AgCartesianSeriesTooltipRendererParams,
} from 'ag-charts-community';
import { AgCharts } from 'ag-charts-react';

import { renderer } from 'fpp/components/analytics/historical-chart-options';

// Data structure for reoccurring chart
export interface ReoccurringChartData {
  date: Date;
  users: number;
  rooms: number;
}

class ReoccurringChartOptions {
  toOptions(): AgCartesianChartOptions {
    // Note: AG Charts v13 runtime supports yAxis on series, but TypeScript types don't include it yet
    // Using double type assertion to work around incomplete type definitions
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
          yAxis: 'y',
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
            renderer: (params: AgCartesianSeriesTooltipRendererParams) =>
              renderer(params, 'Reoccurring Users', '#1971C2'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'rooms',
          yAxis: 'yRight',
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
            renderer: (params: AgCartesianSeriesTooltipRendererParams) =>
              renderer(params, 'Reoccurring Rooms', '#40C057'),
          },
        },
      ],
      axes: {
        x: {
          type: 'time',
          position: 'bottom',
        },
        y: {
          type: 'number',
          position: 'left',
          title: {
            text: 'Reoccurring Users',
          },
        },
        yRight: {
          type: 'number',
          position: 'right',
          title: {
            text: 'Reoccurring Rooms',
          },
        },
      },
    } as unknown as AgCartesianChartOptions;
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
