'use client';

import React from 'react';

import type { AgChartOptions } from 'ag-charts-community';
import { AgCharts } from 'ag-charts-react';

import { renderer } from 'fpp/components/analytics/historical-chart-options';

class ReoccurringChartOptions {
  toOptions(): AgChartOptions {
    // Type assertion needed due to AG Charts v13 type inference issue with dictionary axes
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
            /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
            renderer: (params: any) =>
              renderer(params, 'Reoccurring Users', '#1971C2'),
            /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
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
            /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
            renderer: (params: any) =>
              renderer(params, 'Reoccurring Rooms', '#40C057'),
            /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AG Charts v13 type inference bug requires type assertion
    } as any as AgChartOptions;
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
